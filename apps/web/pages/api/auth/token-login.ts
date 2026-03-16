import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { encode } from "next-auth/jwt";

import { checkIfUserBelongsToActiveTeam } from "@calcom/features/auth/lib/next-auth-options";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { defaultCookies } from "@calcom/lib/default-cookies";
import { ProfileRepository } from "@calcom/lib/server/repository/profile";
import { prisma } from "@calcom/prisma";

// In-memory nonce store to prevent replay attacks.
// Each nonce is kept for 60 seconds then cleaned up.
const usedNonces = new Map<string, number>();

function cleanupNonces() {
  const now = Date.now();
  for (const [nonce, timestamp] of usedNonces) {
    if (now - timestamp > 60_000) {
      usedNonces.delete(nonce);
    }
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupNonces, 30_000);

interface TokenPayload {
  email: string;
  exp: number;
  nonce: string;
}

function verifyToken(tokenString: string, secret: string): TokenPayload | null {
  const parts = tokenString.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signatureHex] = parts;

  // Verify HMAC signature
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");

  // Length check before timingSafeEqual (which throws on mismatched lengths)
  if (signatureHex.length !== expectedSig.length) return null;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signatureHex, "hex"), Buffer.from(expectedSig, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }

  // Decode and parse payload
  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.MOMMATES_AUTH_SECRET;
  if (!secret) {
    console.error("[token-login] MOMMATES_AUTH_SECRET is not configured");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (!nextAuthSecret) {
    console.error("[token-login] NEXTAUTH_SECRET is not configured");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const tokenString = req.query.token as string;
  if (!tokenString) {
    return res.status(400).json({ error: "Missing token parameter" });
  }

  // Verify the HMAC signature
  const payload = verifyToken(tokenString, secret);
  if (!payload) {
    return res.status(401).json({ error: "Invalid token signature" });
  }

  // Check expiry
  if (Date.now() > payload.exp) {
    return res.status(401).json({ error: "Token expired" });
  }

  // Check nonce (prevent replay)
  if (usedNonces.has(payload.nonce)) {
    return res.status(401).json({ error: "Token already used" });
  }
  usedNonces.set(payload.nonce, Date.now());

  // Look up user by email
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      role: true,
      locale: true,
      teams: {
        include: { team: { select: { metadata: true } } },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Determine user profile
  const allProfiles = await ProfileRepository.findAllProfilesForUserIncludingMovedUser(user);
  const profile = allProfiles.length > 0 ? allProfiles[0] : null;
  const upId = profile?.upId ?? `usr-${user.id}`;

  // Check if user belongs to any active team
  const belongsToActiveTeam = checkIfUserBelongsToActiveTeam(user);

  // Build the JWT token matching NextAuth's expected structure
  const jwtToken = {
    id: user.id,
    sub: String(user.id),
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    locale: user.locale ?? "en",
    belongsToActiveTeam,
    profileId: profile?.id ?? null,
    upId,
    orgAwareUsername: user.username,
    org: null,
    iat: Math.floor(Date.now() / 1000),
  };

  // Encode the session JWT using NextAuth's encode function
  const sessionToken = await encode({
    token: jwtToken,
    secret: nextAuthSecret,
    maxAge: 30 * 24 * 60 * 60, // 30 days, matching NextAuth default
  });

  // Determine cookie settings
  const useSecureCookies = WEBAPP_URL?.startsWith("https://");
  const cookies = defaultCookies(useSecureCookies);
  const { name: cookieName, options: cookieOptions } = cookies.sessionToken;

  // Set the session cookie
  const cookieParts = [
    `${cookieName}=${sessionToken}`,
    `Path=${cookieOptions.path ?? "/"}`,
    cookieOptions.httpOnly ? "HttpOnly" : "",
    cookieOptions.secure ? "Secure" : "",
    cookieOptions.sameSite ? `SameSite=${cookieOptions.sameSite}` : "",
    cookieOptions.domain ? `Domain=${cookieOptions.domain}` : "",
    `Max-Age=${30 * 24 * 60 * 60}`,
  ]
    .filter(Boolean)
    .join("; ");

  res.setHeader("Set-Cookie", cookieParts);

  // Redirect to the calendar dashboard
  const redirectUrl = req.query.redirect as string;
  const safeRedirect = redirectUrl && redirectUrl.startsWith("/") ? redirectUrl : "/event-types";

  return res.redirect(302, safeRedirect);
}
