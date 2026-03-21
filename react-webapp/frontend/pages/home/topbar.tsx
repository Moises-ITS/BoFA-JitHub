import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import NodeProfilePopup from "./NodeProfilePopup";
import { search as nodeSearch, primeCache } from "../../hooks/useNodeSearch";

export function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [popupNodeId, setPopupNodeId] = useState<string | null>(null);

  // ── Search state ──────────────────────────────────────────────────────────
  const [query, setQuery]             = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchGroups                  = query.length >= 1 ? nodeSearch(query) : [];
  const hasResults                    = searchGroups.some(g => g.results.length > 0);
  const searchRef                     = useRef<HTMLDivElement>(null);

  // Warm the cache early so first keystroke is instant
  useEffect(() => { primeCache() }, []);

  // Close search on outside click
  useEffect(() => {
    if (!searchOpen) return;
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen]);

  const handleSearchKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setSearchOpen(false); setQuery(""); }
  }, []);

  const handleResultClick = useCallback((id: string) => {
    setSearchOpen(false);
    setQuery("");
    setPopupNodeId(id);
  }, []);

  const name = user?.name ?? "";
  const ucid = user?.email?.split("@")[0] ?? "";
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).join("") || "?";

  return (
    <>
    <NodeProfilePopup nodeId={popupNodeId} onClose={() => setPopupNodeId(null)} />
    <header className="fixed top-0 left-20 right-0 h-16 bg-[#0F0F0F]/80 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-[#9CA3AF] bg-clip-text text-transparent">
          JitHub
        </h1>
        <div className="hidden md:flex items-center gap-2 text-xs text-[#9CA3AF]">
          <div className="w-1 h-1 rounded-full bg-[#C0392B]" />
          <span>NJIT Student OS</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div ref={searchRef} className="relative w-96 hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKey}
            placeholder="Search students, clubs, companies…"
            className="w-full h-10 pl-10 pr-4 bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C0392B]/40 focus:border-[#C0392B]/40"
          />
          {/* Search dropdown */}
          {searchOpen && query.length >= 1 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              {hasResults ? searchGroups.map(group => (
                <div key={group.type}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider border-b border-white/5">
                    {group.emoji} {group.label}
                  </div>
                  {group.results.map(node => (
                    <button
                      key={node.id}
                      onClick={() => handleResultClick(node.id)}
                      className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <span className="text-[#9CA3AF] text-xs">{group.emoji}</span>
                      <span>{node.label}</span>
                    </button>
                  ))}
                </div>
              )) : (
                <div className="px-4 py-3 text-sm text-[#6B7280]">No results for "{query}"</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{name}</p>
            {ucid && <p className="text-xs text-[#9CA3AF]">UCID: {ucid}</p>}
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C0392B] to-[#E67E22] flex items-center justify-center text-white font-medium shadow-lg">
            {initials}
          </div>
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-all duration-150 font-medium whitespace-nowrap"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
