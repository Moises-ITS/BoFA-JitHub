import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { Home, Calendar, Briefcase, Network, Microscope, User } from "lucide-react";

const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Calendar, label: "Events", path: "/events" },
  { icon: Briefcase, label: "Opportunities", path: "/opportunities" },
  { icon: Network, label: "Campus Network", path: "/network" },
  { icon: Microscope, label: "Research", path: "/research" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-[#0F0F0F] border-r border-white/10 flex flex-col items-center py-6 z-50">
      <div className="mb-8">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-12 h-12 rounded-xl bg-[#E67E22] flex items-center justify-center shadow-lg shadow-[#E67E22]/30"
        >
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
            {/* Center node */}
            <circle cx="24" cy="24" r="5" fill="white" />
            {/* Spokes */}
            <line x1="24" y1="19" x2="24" y2="10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="24" y1="29" x2="24" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="19" y1="21" x2="11" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="29" y1="27" x2="37" y2="33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="29" y1="21" x2="37" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="19" y1="27" x2="11" y2="33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            {/* Outer nodes */}
            <circle cx="24" cy="7"  r="3.5" fill="white" />
            <circle cx="24" cy="41" r="3.5" fill="white" />
            <circle cx="8"  cy="13" r="3.5" fill="white" />
            <circle cx="40" cy="35" r="3.5" fill="white" />
            <circle cx="40" cy="13" r="3.5" fill="white" />
            <circle cx="8"  cy="35" r="3.5" fill="white" />
          </svg>
        </motion.div>
      </div>

      <nav className="flex-1 flex flex-col gap-2 w-full px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `group relative flex flex-col items-center gap-1 py-3 rounded-xl transition-all ${
                isActive
                  ? "bg-[#C0392B]/10 text-[#C0392B]"
                  : "text-[#9CA3AF] hover:bg-white/5 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#C0392B]/10 rounded-xl"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <item.icon className="w-5 h-5 relative z-10" />
                <span className="text-[10px] font-medium relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
