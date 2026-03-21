// ─────────────────────────────────────────────────────────────────────────────
// NodeProfilePopup.tsx
// Full-profile animated modal opened from Home search results.
// Fetches public profile data from /api/auth/users/:id/profile.
// Shows major, bio, interests, clubs, LinkedIn, and Add Connection action.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { getNodeById } from "../../hooks/useNodeSearch";

const API = import.meta.env.VITE_API_URL ?? "";

const TYPE_COLOR: Record<string, string> = {
  student:   "#60a5fa",
  club:      "#34d399",
  company:   "#fb923c",
  professor: "#a78bfa",
  interest:  "#fbbf24",
};
const TYPE_EMOJI: Record<string, string> = {
  student:   "🎓",
  club:      "🏛️",
  company:   "🏢",
  professor: "👨‍🏫",
  interest:  "💡",
};
const TYPE_LABEL: Record<string, string> = {
  student: "Student", club: "Club", company: "Company",
  professor: "Professor", interest: "Interest",
};

type ConnStatus = "none" | "pending-sent" | "pending-received" | "connected";

interface PublicProfile {
  id:             string;
  name:           string;
  major:          string;
  graduationYear: number;
  bio:            string | null;
  clubs:          string[];
  companies:      string[];
  interests:      string[];
  linkedinUrl:    string | null;
}

interface Props {
  nodeId:  string | null;
  onClose: () => void;
}

export default function NodeProfilePopup({ nodeId, onClose }: Props) {
  const { user, token } = useAuth();

  const cachedNode = nodeId ? getNodeById(nodeId) : null;
  const nodeType   = cachedNode?.type ?? "student";
  const isStudent  = nodeType === "student";
  const isOwnNode  = nodeId === user?.id;

  const [profile,    setProfile]    = useState<PublicProfile | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>("none");
  const [connLoading, setConnLoading] = useState(false);

  // Fetch profile + connection status when nodeId changes
  useEffect(() => {
    if (!nodeId) { setProfile(null); setConnStatus("none"); return; }
    setLoading(true);
    setProfile(null);
    setConnStatus("none");

    fetch(`${API}/api/auth/users/${nodeId}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: PublicProfile | null) => setProfile(data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    if (isStudent && !isOwnNode) {
      fetch(`${API}/api/connections/status?userId=${nodeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : { status: "none" })
        .then(data => {
          if (data.status === "accepted")                                   setConnStatus("connected");
          else if (data.status === "pending" && data.direction === "sent")     setConnStatus("pending-sent");
          else if (data.status === "pending" && data.direction === "received") setConnStatus("pending-received");
          else setConnStatus("none");
        })
        .catch(() => setConnStatus("none"));
    }
  }, [nodeId, token, isStudent, isOwnNode]);

  // Escape key close
  useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nodeId, onClose]);

  const sendRequest = useCallback(async () => {
    if (!nodeId) return;
    setConnLoading(true);
    try {
      const res = await fetch(`${API}/api/connections/request`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ toUserId: nodeId }),
      });
      if (res.ok) setConnStatus("pending-sent");
    } catch { /* silent */ }
    setConnLoading(false);
  }, [nodeId, token]);

  const displayName = profile?.name ?? cachedNode?.label ?? "…";
  const color       = TYPE_COLOR[nodeType] ?? "#9CA3AF";
  const emoji       = TYPE_EMOJI[nodeType] ?? "•";
  const typeLabel   = TYPE_LABEL[nodeType] ?? nodeType;
  const initials    = displayName.split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

  return (
    <AnimatePresence>
      {nodeId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="npp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 9998, backdropFilter: "blur(3px)",
            }}
          />

          {/* Centering wrapper — flex handles position; FM handles scale/fade only */}
          <div style={{
            position: "fixed", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, pointerEvents: "none",
          }}>
          {/* Modal */}
          <motion.div
            key="npp-modal"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{    opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{
              pointerEvents: "all",
              width:         "min(560px, calc(100vw - 48px))",
              maxHeight:     "min(85vh, calc(100vh - 48px))",
              background:    "#111827",
              border:        "1px solid rgba(255,255,255,0.1)",
              borderRadius:  18,
              boxShadow:     "0 28px 80px rgba(0,0,0,0.9)",
              display:       "flex",
              flexDirection: "column",
              overflow:      "hidden",
            }}
          >
            {/* Color stripe */}
            <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, transparent)`, flexShrink: 0 }} />

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: "absolute", top: 14, right: 14,
                background: "none", border: "none", color: "#6B7280",
                fontSize: "1rem", cursor: "pointer", padding: "4px 8px", borderRadius: 6,
                zIndex: 1,
              }}
            >
              ✕
            </button>

            {/* Scrollable body */}
            <div style={{ overflowY: "auto", flex: 1, padding: "22px 26px 0" }}>

              {/* Avatar + name + type row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${color}88, ${color})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.4rem", fontWeight: 800, color: "#fff",
                  boxShadow: `0 0 24px ${color}44`,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F0F0F0", marginBottom: 4 }}>
                    {displayName}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 9px", borderRadius: 10,
                      background: `${color}18`, color, border: `1px solid ${color}44`,
                      fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                    }}>
                      {emoji} {typeLabel}
                    </span>
                    {profile?.major && (
                      <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>
                        {profile.major}
                        {profile.graduationYear ? ` · Class of ${profile.graduationYear}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {loading && (
                <div style={{ fontSize: "0.82rem", color: "#4B5563", padding: "8px 0 16px" }}>
                  Loading profile…
                </div>
              )}

              {/* Bio */}
              {profile?.bio && (
                <div style={{
                  fontSize: "0.82rem", color: "#94A3B8", lineHeight: 1.6,
                  padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)",
                }}>
                  {profile.bio}
                </div>
              )}

              {/* Interests */}
              {profile && profile.interests.length > 0 && (
                <div style={{ padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1.2px", color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>
                    Interests
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {profile.interests.map(i => (
                      <span key={i} style={{
                        padding: "3px 10px", borderRadius: 20,
                        background: "rgba(251,191,36,0.1)", color: "#fbbf24",
                        border: "1px solid rgba(251,191,36,0.2)",
                        fontSize: "0.72rem", fontWeight: 500,
                      }}>
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clubs */}
              {profile && profile.clubs.length > 0 && (
                <div style={{ padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1.2px", color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>
                    Clubs
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {profile.clubs.map(c => (
                      <span key={c} style={{
                        padding: "3px 10px", borderRadius: 20,
                        background: "rgba(52,211,153,0.1)", color: "#34d399",
                        border: "1px solid rgba(52,211,153,0.2)",
                        fontSize: "0.72rem", fontWeight: 500,
                      }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies / Experience */}
              {profile && profile.companies.length > 0 && (
                <div style={{ padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1.2px", color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>
                    Experience
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {profile.companies.map(c => (
                      <span key={c} style={{
                        padding: "3px 10px", borderRadius: 20,
                        background: "rgba(251,146,60,0.1)", color: "#fb923c",
                        border: "1px solid rgba(251,146,60,0.2)",
                        fontSize: "0.72rem", fontWeight: 500,
                      }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {profile?.linkedinUrl && (
                <div style={{ padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <a
                    href={profile.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "0.8rem", color: "#60a5fa", textDecoration: "none" }}
                  >
                    LinkedIn ↗
                  </a>
                </div>
              )}

              {/* Spacer before footer */}
              <div style={{ height: 8 }} />
            </div>

            {/* Footer — connection action for other students only */}
            {isStudent && !isOwnNode && (
              <div style={{
                padding: "14px 26px 20px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                display: "flex", gap: 10, flexShrink: 0,
              }}>
                {connStatus === "none" && (
                  <button
                    onClick={sendRequest}
                    disabled={connLoading}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 9,
                      background: "linear-gradient(135deg, #C0392B, #E74C3C)",
                      border: "none", color: "#fff",
                      fontSize: "0.84rem", fontWeight: 600,
                      cursor: connLoading ? "default" : "pointer",
                      opacity: connLoading ? 0.6 : 1,
                      fontFamily: "inherit",
                      boxShadow: "0 2px 12px rgba(192,57,43,0.3)",
                    }}
                  >
                    {connLoading ? "Sending…" : "+ Add Connection"}
                  </button>
                )}
                {connStatus === "pending-sent" && (
                  <span style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, textAlign: "center",
                    background: "rgba(234,179,8,0.12)", color: "#fbbf24",
                    border: "1px solid rgba(234,179,8,0.25)",
                    fontSize: "0.82rem", fontWeight: 600,
                  }}>
                    Request Sent
                  </span>
                )}
                {connStatus === "pending-received" && (
                  <span style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, textAlign: "center",
                    background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.25)",
                    fontSize: "0.82rem", fontWeight: 500,
                  }}>
                    Wants to connect with you
                  </span>
                )}
                {connStatus === "connected" && (
                  <span style={{
                    flex: 1, padding: "9px 0", borderRadius: 9, textAlign: "center",
                    background: "rgba(34,197,94,0.12)", color: "#4ade80",
                    border: "1px solid rgba(34,197,94,0.25)",
                    fontSize: "0.82rem", fontWeight: 600,
                  }}>
                    ✓ Connected
                  </span>
                )}
              </div>
            )}
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
