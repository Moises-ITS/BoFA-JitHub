import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { Home, Calendar, Briefcase, FlaskConical, Network, User, Bot, Activity } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const baseNavItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Calendar, label: "Events", path: "/events" },
  { icon: Briefcase, label: "Opportunities", path: "/opportunities" },
  { icon: FlaskConical, label: "Research", path: "/research" },
  { icon: Network, label: "Campus Network", path: "/network" },
  { icon: Bot, label: "Sandbox", path: "/sandbox" },
  { icon: User, label: "Profile", path: "/profile" },
];


export function Sidebar() {
  const { user } = useAuth();
  const navItems = user?.is_eboard
    ? [...baseNavItems, { icon: Activity, label: "EDEN", path: "/eden" }]
    : baseNavItems;
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-6 z-50"
      style={{ backgroundColor: "var(--bg-canvas)", borderRight: "1px solid var(--border-default)" }}
    >
      <div className="mb-8">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}
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
            <circle cx="24" cy="7" r="3.5" fill="white" />
            <circle cx="24" cy="41" r="3.5" fill="white" />
            <circle cx="8" cy="13" r="3.5" fill="white" />
            <circle cx="40" cy="35" r="3.5" fill="white" />
            <circle cx="40" cy="13" r="3.5" fill="white" />
            <circle cx="8" cy="35" r="3.5" fill="white" />
          </svg>
        </motion.div>
      </div>

      <nav className="flex-1 flex flex-col gap-2 w-full px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="group relative flex flex-col items-center gap-1 py-3 rounded-xl transition-all hover:bg-white/5 hover:text-white"
            style={({ isActive }) => ({
              color: isActive ? "var(--brand-primary)" : "var(--text-muted)",
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl"
                    style={{ backgroundColor: "var(--brand-primary-soft)" }}
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
