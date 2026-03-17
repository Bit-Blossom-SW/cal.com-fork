import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";

import { hashPassword } from "@calcom/features/auth/lib/hashPassword";
import { UserRepository } from "@calcom/lib/server/repository/user";
import { prisma } from "@calcom/prisma";
import { CreationSource, MembershipRole, IdentityProvider } from "@calcom/prisma/enums";

/**
 * POST /api/auth/create-member
 *
 * Creates a new user in cal.com and adds them to a team.
 * Authenticated via MOMMATES_AUTH_SECRET (server-to-server only).
 *
 * Body: { email, name?, teamId?, password? }
 * - If password is not provided, one is generated
 * - If teamId is not provided, defaults to team 1
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify shared secret
  const secret = process.env.MOMMATES_AUTH_SECRET;
  if (!secret) {
    console.error("[create-member] MOMMATES_AUTH_SECRET is not configured");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  const providedSecret = authHeader.slice(7);

  // Constant-time comparison
  if (
    providedSecret.length !== secret.length ||
    !crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(secret))
  ) {
    return res.status(401).json({ error: "Invalid authorization" });
  }

  const { email, name, teamId, password } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const memberTeamId = teamId || 1;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, username: true },
    });

    if (existingUser) {
      // User exists — just ensure team membership
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_teamId: { userId: existingUser.id, teamId: memberTeamId },
        },
      });

      if (!existingMembership) {
        await prisma.membership.create({
          data: {
            userId: existingUser.id,
            teamId: memberTeamId,
            role: MembershipRole.MEMBER,
            accepted: true,
          },
        });
      }

      return res.status(200).json({
        success: true,
        created: false,
        message: "User already exists, membership ensured",
        user: {
          id: existingUser.id,
          email: existingUser.email,
          username: existingUser.username,
        },
      });
    }

    // Generate password if not provided
    const userPassword = password || crypto.randomBytes(16).toString("base64url");
    const hashedPassword = await hashPassword(userPassword);

    // Generate username from email (before the @)
    let baseUsername = normalizedEmail
      .split("@")[0]
      .replace(/[^a-z0-9-_]/g, "")
      .toLowerCase();
    if (!baseUsername) baseUsername = "user";

    // Ensure username is unique
    let username = baseUsername;
    let suffix = 1;
    while (await prisma.user.findFirst({ where: { username, organizationId: null } })) {
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    // Create user with default schedule via UserRepository
    const user = await UserRepository.create({
      email: normalizedEmail,
      username,
      name: name || null,
      hashedPassword,
      organizationId: null,
      creationSource: CreationSource.WEBAPP,
      locked: false,
      emailVerified: new Date(),
      identityProvider: IdentityProvider.CAL,
    });

    // Create team membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        teamId: memberTeamId,
        role: MembershipRole.MEMBER,
        accepted: true,
      },
    });

    console.log(`[create-member] Created user ${normalizedEmail} (id: ${user.id}) with team ${memberTeamId}`);

    return res.status(201).json({
      success: true,
      created: true,
      user: {
        id: user.id,
        email: normalizedEmail,
        username,
      },
      // Only return password if we generated it (so the caller can store it)
      ...(password ? {} : { generatedPassword: userPassword }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-member] Error:", message);
    return res.status(500).json({ error: "Failed to create member" });
  }
}
