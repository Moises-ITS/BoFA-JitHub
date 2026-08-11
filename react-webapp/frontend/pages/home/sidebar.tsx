import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { Home, Calendar, Users, Briefcase, Network, User, Flag } from "lucide-react";

const baseNavItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: Calendar, label: "Events", path: "/events" },
  // Directly below Events and above Opportunities (AC 1). Active-tab highlight
  // and styling come from the shared .map below — nothing else in this file
  // needed to change (AC 3).
  { icon: Users, label: "Organizations", path: "/organizations" },
  { icon: Briefcase, label: "Opportunities", path: "/opportunities" },
  // Quarantined: hide the Research section button until the section is ready for users.
  // { icon: FlaskConical, label: "Research", path: "/research" },
  { icon: Network, label: "Campus Network", path: "/network" },
  // Removed: the /sandbox Jiti AI chat is being rebuilt from scratch — see
  // docs/JITI-SANDBOX.md for the full documentation of the previous system.
  { icon: User, label: "Profile", path: "/profile" },
  { icon: Flag, label: "Report Issue", path: "/report-issue" },
];


export function Sidebar() {
  // EDEN (e-board analytics) is PARKED for v2 — see pages/eden/README.md.
  // An e-board-only link used to render here (via useAuth().user.is_eboard),
  // but no /eden route exists, so clicking it silently bounced users to the
  // landing page. Don't show a door that opens onto a wall.
  const navItems = baseNavItems;
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-20 flex flex-col items-center py-6 z-50"
      style={{ backgroundColor: "var(--bg-canvas)", borderRight: "1px solid var(--border-default)" }}
    >
      <div className="mb-8">
        {/* The JitHub mark lives in public/jithub-logo.svg (gradient square
            included) and doubles as the favicon — one asset, no drifting
            copies. It used to be an inline SVG private to this file. */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="w-12 h-12 rounded-xl shadow-lg"
          style={{ boxShadow: "var(--shadow-brand)" }}
        >
          <img src="/jithub-logo.svg" alt="JitHub" className="w-12 h-12" />
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
                <span className="text-[10px] font-medium relative z-10 w-full text-center leading-tight min-h-[20px] flex items-center justify-center">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
