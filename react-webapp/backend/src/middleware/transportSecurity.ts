import type { NextFunction, Request, Response } from "express"

function isLocalHost(host: string): boolean {
  return host.includes("localhost") || host.includes("127.0.0.1")
}

export function enforceHttps(req: Request, res: Response, next: NextFunction) {
  const nodeEnv = process.env.NODE_ENV ?? "development"
  const enforce = process.env.ENFORCE_HTTPS === "true" || nodeEnv === "production"
  if (!enforce) return next()

  const host = req.get("host") ?? ""
  if (isLocalHost(host)) return next()

  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim()
  const secure = req.secure || proto === "https"
  if (secure) return next()

  res.status(426).json({ error: "HTTPS is required" })
}
