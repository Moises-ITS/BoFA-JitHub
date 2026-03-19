// ─────────────────────────────────────────────────────────────────────────────
// CampusNavbar — Dedicated navbar for the Campus Network (nodes) screen
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./CampusNavbar.css";

type GraphMode = "free" | "locked" | "path";

interface CampusNavbarProps {
  readonly mode: GraphMode;
  readonly userConnCount: number;
  readonly onExitMode: () => void;
  readonly onOpenProfile: () => void;
}

export default function CampusNavbar({
  mode,
  userConnCount,
  onExitMode,
  onOpenProfile,
}: CampusNavbarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const modeBadge =
    mode === "locked"
      ? "🔒 Locked"
      : mode === "path"
      ? "👤 Path"
      : "🌐 Explore";

  return (
    <nav className="navbar">
      <div className="navLogo">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="9" fill="#FF6B35" />
          <line x1="18" y1="18" x2="18" y2="6.5"  stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18" y1="18" x2="27" y2="10.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18" y1="18" x2="28" y2="22"   stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18" y1="18" x2="18" y2="29.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18" y1="18" x2="8"  y2="22"   stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="18" y1="18" x2="9"  y2="10.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="18"   cy="6"    r="3" fill="white" />
          <circle cx="27.5" cy="9.5"  r="3" fill="white" />
          <circle cx="28.5" cy="22.5" r="3" fill="white" />
          <circle cx="18"   cy="30"   r="3" fill="white" />
          <circle cx="7.5"  cy="22.5" r="3" fill="white" />
          <circle cx="8.5"  cy="9.5"  r="3" fill="white" />
          <circle cx="18"   cy="18"   r="4" fill="white" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span>JitHub</span>
          <span className="navTagline">Map your network · Discover your opportunities</span>
        </div>
      </div>
      <div className="navRight">
        <span className={`modeBadge mode-${mode}`}>{modeBadge}</span>
        {mode !== "free" && (
          <button className="exitModeBtn" onClick={onExitMode}>← Free Explore</button>
        )}
        <span className="navChip">{userConnCount} Connections</span>
        <button
          type="button"
          className="profileAvatarBtn"
          onClick={onOpenProfile}
          title="Edit profile"
        >
          {user?.name?.charAt(0).toUpperCase() ?? "?"}
        </button>
        <button
          type="button"
          className="logoutBtn"
          onClick={() => {
            navigate("/", { replace: true });
          }}
        >
          Home
        </button>
      </div>
    </nav>
  );
}
