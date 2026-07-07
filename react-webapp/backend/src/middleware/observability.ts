import type { NextFunction, Request, Response } from "express"

type Bucket = { count: number; firstTs: number; lastWarnTs: number }
const trafficBuckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000
const WARN_THRESHOLD = 240

function trimPath(path: string): string {
  return path.length > 180 ? `${path.slice(0, 180)}…` : path
}

export function observeApiTraffic(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? "unknown"
  const now = Date.now()
  const key = `${ip}:${req.method}`
  const current = trafficBuckets.get(key)
  if (!current || now - current.firstTs > WINDOW_MS) {
    trafficBuckets.set(key, { count: 1, firstTs: now, lastWarnTs: 0 })
  } else {
    current.count += 1
    if (current.count >= WARN_THRESHOLD && now - current.lastWarnTs > WINDOW_MS) {
      current.lastWarnTs = now
      console.warn("[security][traffic-anomaly]", {
        ip,
        method: req.method,
        countPerMinute: current.count,
        path: trimPath(req.originalUrl),
        userAgent: req.get("user-agent") ?? "",
      })
    }
  }

  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.warn("[security][api-error]", {
        status: res.statusCode,
        method: req.method,
        path: trimPath(req.originalUrl),
        ip,
        userId: (req as Request & { userId?: string }).userId ?? null,
      })
    }
  })

  next()
}
