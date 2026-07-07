import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Bell } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import NodeProfilePopup from "./NodeProfilePopup"
import { search as nodeSearch, primeCache } from "@/hooks/useNodeSearch"

import { API_BASE_URL as API } from "@/lib/api"

type PendingRequest = {
  id: number
  from_user_id: string
  from_name: string | null
  from_email: string | null
  from_major: string | null
  created_at: string
}

type InboxUpdate = {
  id: number
  kind: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  related_user_id: string | null
  related_user_name: string | null
}

type NotificationsPayload = {
  unreadCount: number
  pendingRequests: PendingRequest[]
  updates: InboxUpdate[]
}

export function Topbar() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [popupNodeId, setPopupNodeId] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationsPayload>({
    unreadCount: 0,
    pendingRequests: [],
    updates: [],
  })
  const searchRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const searchGroups = query.length >= 1 ? nodeSearch(query) : []
  const hasResults = searchGroups.some(group => group.results.length > 0)

  useEffect(() => { void primeCache(token) }, [token])

  const fetchNotifications = useCallback(async () => {
    if (!token || !user?.id) return
    setNotificationsLoading(true)
    try {
      const res = await fetch(`${API}/api/connections/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json() as NotificationsPayload
      setNotifications(data)
    } catch {
      // no-op
    } finally {
      setNotificationsLoading(false)
    }
  }, [token, user?.id])

  useEffect(() => {
    if (!token || !user?.id) return
    void fetchNotifications()
    const timer = window.setInterval(() => {
      void fetchNotifications()
    }, 20000)
    return () => window.clearInterval(timer)
  }, [token, user?.id, fetchNotifications])

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setQuery("")
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [searchOpen, notificationsOpen])

  const handleSearchKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchOpen(false); setQuery("") }
  }, [])

  const handleResultClick = useCallback((id: string) => {
    setSearchOpen(false)
    setQuery("")
    setPopupNodeId(id)
  }, [])

  const handleAcceptRequest = useCallback(async (fromUserId: string) => {
    if (!token) return
    try {
      const res = await fetch(`${API}/api/connections/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fromUserId }),
      })
      if (res.ok) window.dispatchEvent(new CustomEvent("jithub:connections-changed"))
    } catch {
      // no-op
    }
    await fetchNotifications()
  }, [token, fetchNotifications])

  const handleRejectRequest = useCallback(async (fromUserId: string) => {
    if (!token) return
    try {
      await fetch(`${API}/api/connections/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fromUserId }),
      })
    } catch {
      // no-op
    }
    await fetchNotifications()
  }, [token, fetchNotifications])

  const handleMarkAllRead = useCallback(async () => {
    if (!token) return
    try {
      await fetch(`${API}/api/connections/notifications/mark-read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ markAll: true }),
      })
    } catch {
      // no-op
    }
    await fetchNotifications()
  }, [token, fetchNotifications])

  const name = user?.name ?? ""
  const ucid = user?.email?.split("@")[0] ?? ""
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).join("") || "?"

  return (
    <>
      <NodeProfilePopup nodeId={popupNodeId} onClose={() => setPopupNodeId(null)} />

      <header
        className="fixed top-0 left-20 right-0 h-16 backdrop-blur-xl px-6 flex items-center justify-between z-40"
        style={{ backgroundColor: "var(--bg-overlay)", borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3">
            <img src="/njit-logo-transparent.png" alt="NJIT" className="h-7 w-auto object-contain shrink-0" />
            <span aria-hidden className="text-sm font-medium" style={{ color: "color-mix(in srgb, var(--text-muted) 70%, var(--border-default) 30%)" }}>|</span>
            <h1 className="text-xl font-semibold bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--text-primary) 0%, var(--text-muted) 100%)" }}>JitHub</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div ref={searchRef} className="relative w-96 hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKey}
              placeholder="Search students, clubs, companies..."
              className="w-full h-10 pl-10 pr-4 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-primary)", boxShadow: "var(--shadow-inset)" }}
            />

            {searchOpen && query.length >= 1 && (
              <div className="absolute top-full mt-1 left-0 right-0 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto" style={{ backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
                {hasResults ? (
                  searchGroups.map(group => (
                    <div key={group.type}>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{group.label}</div>
                      {group.results.map(node => (
                        <button key={node.id} onClick={() => handleResultClick(node.id)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{group.label}</span>
                          <span>{node.label}</span>
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>No results for "{query}"</div>
                )}
              </div>
            )}
          </div>

          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "#dc2626",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 5px",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  {notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-[420px] rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="text-sm font-semibold text-white">Notifications</div>
                  <button
                    type="button"
                    onClick={() => void handleMarkAllRead()}
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Mark updates read
                  </button>
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  <div
                    className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] font-semibold"
                    style={{ color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    Connection Requests
                  </div>
                  {notifications.pendingRequests.length === 0 ? (
                    <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                      No pending requests
                    </div>
                  ) : notifications.pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="px-4 py-3"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="text-sm text-white font-medium">
                        {req.from_name || req.from_email || req.from_user_id}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        sent a connection request
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleAcceptRequest(req.from_user_id)}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold"
                          style={{ backgroundColor: "rgba(34,197,94,0.2)", color: "#86efac" }}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectRequest(req.from_user_id)}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold"
                          style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}

                  <div
                    className="px-4 py-2 text-[11px] uppercase tracking-[0.08em] font-semibold"
                    style={{ color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    Inbox Updates
                  </div>
                  {notifications.updates.length === 0 ? (
                    <div className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                      No updates yet
                    </div>
                  ) : notifications.updates.map((item) => (
                    <div
                      key={item.id}
                      className="px-4 py-3"
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        backgroundColor: item.is_read ? "transparent" : "rgba(59,130,246,0.08)",
                      }}
                    >
                      <div className="text-sm text-white font-medium">{item.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {item.message}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  {notificationsLoading && (
                    <div className="px-4 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      Refreshing...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-4" style={{ borderLeft: "1px solid var(--border-default)" }}>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{name}</p>
              {ucid && <p className="text-xs" style={{ color: "var(--text-muted)" }}>UCID: {ucid}</p>}
            </div>

            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shadow-lg" style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}>{initials}</div>

            <button onClick={() => { logout(); navigate("/") }} className="px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-all duration-150 font-medium whitespace-nowrap">Sign out</button>
          </div>
        </div>
      </header>
    </>
  )
}
