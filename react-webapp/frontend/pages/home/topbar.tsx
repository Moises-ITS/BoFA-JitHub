import { motion } from "motion/react";
import { Search, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function Topbar() {
  const { user } = useAuth();
  const name = user?.name ?? "";
  const ucid = user?.email?.split("@")[0] ?? "";
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).join("") || "?";

  return (
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
        <div className="relative w-96 hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search events, opportunities, people..."
            className="w-full h-10 pl-10 pr-4 bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C0392B]/40 focus:border-[#C0392B]/40"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5 text-[#9CA3AF]" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C0392B] rounded-full" />
        </motion.button>

        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white">{name}</p>
            {ucid && <p className="text-xs text-[#9CA3AF]">UCID: {ucid}</p>}
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C0392B] to-[#E67E22] flex items-center justify-center text-white font-medium shadow-lg">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
