import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Basic health check
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_CALCOM_VERSION || "unknown",
      environment: process.env.NODE_ENV || "unknown",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: "Health check failed",
    });
  }
}
