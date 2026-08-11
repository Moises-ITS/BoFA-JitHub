/**
 * eventsSocket.ts — the live events feed (`/api/events/ws`).
 *
 * Clients connect once from the Events page and receive:
 *   { type: "event.created", event: {...} }        — a student submitted an event
 *   { type: "rsvp.changed", event_id, count, preview } — someone toggled "going"
 *
 * DESIGN NOTES
 * ------------
 * - Attached to the SAME http.Server as Express via an explicit `upgrade`
 *   handler rather than `new WebSocketServer({ server })`. Being explicit means
 *   an upgrade to any other path is rejected here instead of being silently
 *   accepted, and it keeps this path from colliding with any future WS feature.
 * - Payloads carry the full state they describe, never a delta. A client that
 *   was mid-reconnect when a message went out would otherwise drift permanently
 *   out of sync, and there is no sequence number to detect that.
 * - `clients` is per-process. With more than one backend instance, a broadcast
 *   only reaches the students connected to the instance that produced it. The
 *   Express app already has Redis (see lib/redis.ts) — route broadcasts through
 *   a Redis pub/sub channel before scaling past one instance.
 */

import type { Server as HttpServer } from "http"
import { WebSocketServer, WebSocket } from "ws"

export const EVENTS_WS_PATH = "/api/events/ws"

let wss: WebSocketServer | null = null

/**
 * Heartbeat. Idle WebSockets are silently dropped by proxies (Railway and most
 * load balancers cut at ~60s of inactivity), and a half-open socket looks alive
 * to the server forever — it accumulates in `clients` and every broadcast pays
 * to write into a dead pipe. Pinging every 30s both keeps healthy connections
 * open through the proxy and gives us a liveness signal to reap the rest.
 */
const HEARTBEAT_MS = 30_000

interface TrackedSocket extends WebSocket {
  isAlive?: boolean
}

export function attachEventsSocket(server: HttpServer): WebSocketServer {
  if (wss) return wss

  wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (req, socket, head) => {
    // req.url is a path, not an absolute URL, so it needs a dummy base to parse.
    const pathname = new URL(req.url ?? "", "http://localhost").pathname
    if (pathname !== EVENTS_WS_PATH) {
      // Nothing else on this server speaks WebSocket. Refuse explicitly rather
      // than leaving the socket hanging open until the client times out.
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n")
      socket.destroy()
      return
    }
    wss!.handleUpgrade(req, socket, head, ws => wss!.emit("connection", ws, req))
  })

  wss.on("connection", (ws: TrackedSocket) => {
    ws.isAlive = true
    ws.on("pong", () => { ws.isAlive = true })
    // The client never sends us anything; an error handler is still required,
    // because an unhandled 'error' event on a socket is fatal to the process.
    ws.on("error", () => { ws.terminate() })
  })

  const heartbeat = setInterval(() => {
    for (const client of wss!.clients as Set<TrackedSocket>) {
      if (client.isAlive === false) {
        client.terminate()
        continue
      }
      client.isAlive = false
      client.ping()
    }
  }, HEARTBEAT_MS)

  // Without unref() this timer alone keeps the event loop alive and the process
  // never exits on SIGTERM — the redeploy hangs until the platform hard-kills it.
  heartbeat.unref()
  wss.on("close", () => clearInterval(heartbeat))

  console.log(`[realtime] events websocket listening at ${EVENTS_WS_PATH}`)
  return wss
}

/** Fan a payload out to every connected Events page. Never throws. */
export function broadcastEvent(payload: Record<string, unknown>): void {
  if (!wss || wss.clients.size === 0) return
  const message = JSON.stringify(payload)
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue
    try {
      client.send(message)
    } catch (err) {
      console.error("[realtime] broadcast failed for one client:", err)
    }
  }
}

/**
 * Graceful-shutdown hook (also a test seam).
 *
 * wss.close() only stops NEW connections; existing sockets stay open, and
 * http.Server#close() waits on them forever. Each client is closed explicitly
 * with 1001 "going away", which is also the client's cue that this was a
 * deliberate restart worth reconnecting to.
 */
export function closeEventsSocket(): void {
  if (!wss) return
  for (const client of wss.clients) {
    client.close(1001, "server shutting down")
  }
  wss.close()
  wss = null
}
