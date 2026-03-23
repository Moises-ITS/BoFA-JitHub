import { motion } from "motion/react";
import { Search, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function Topbar() {
  const { user } = useAuth();
  const name = user?.name ?? "";
  const ucid = user?.email?.split("@")[0] ?? "";
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).join("") || "?";

  return (
    <header
      className="fixed top-0 left-20 right-0 h-16 backdrop-blur-xl px-6 flex items-center justify-between z-40"
      style={{ backgroundColor: "var(--bg-overlay)", borderBottom: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center gap-4">
        <h1
          className="text-xl font-semibold bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(90deg, var(--text-primary) 0%, var(--text-muted) 100%)" }}
        >
          JitHub
        </h1>
        <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
          <span>NJIT Student OS</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-96 hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search events, opportunities, people..."
            className="w-full h-10 pl-10 pr-4 rounded-lg text-sm text-white focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              boxShadow: "none",
            }}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
        </motion.button>

        <div className="flex items-center gap-3 pl-4" style={{ borderLeft: "1px solid var(--border-default)" }}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{name}</p>
            {ucid && <p className="text-xs" style={{ color: "var(--text-muted)" }}>UCID: {ucid}</p>}
          </div>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shadow-lg"
            style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
