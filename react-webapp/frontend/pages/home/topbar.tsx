import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import NodeProfilePopup from "./NodeProfilePopup"
import { search as nodeSearch, primeCache } from "../../hooks/useNodeSearch"

export function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [popupNodeId, setPopupNodeId] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const searchGroups = query.length >= 1 ? nodeSearch(query) : []
  const hasResults = searchGroups.some(group => group.results.length > 0)

  useEffect(() => { void primeCache() }, [])

  useEffect(() => {
    if (!searchOpen) return
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [searchOpen])

  const handleSearchKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchOpen(false); setQuery("") }
  }, [])

  const handleResultClick = useCallback((id: string) => {
    setSearchOpen(false)
    setQuery("")
    setPopupNodeId(id)
  }, [])

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
