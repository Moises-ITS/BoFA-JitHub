import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Send } from "lucide-react";

const JITI_AVATAR = "/jiti.png";
import { useAuth } from "../../context/AuthContext";
import { EventDetailModal, type UserProfile, type AttendeeInfo } from "../events/components/EventDetailModal";

const EVENTS_API = import.meta.env.VITE_EVENTS_API_URL ?? "http://localhost:8000";
const AUTH_API   = import.meta.env.VITE_API_URL         ?? "http://localhost:3001";

const STARTERS = [
  "What events are happening this week?",
  "Who should I connect with?",
  "What's trending on campus?",
  "Find me a hackathon",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatAction {
  type: "view_event" | "connect" | "view_profile";
  label: string;
  event_id?: number;
  user_id?: string;
  user_name?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
  error?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-end", gap: "8px" }}>
      <img src={JITI_AVATAR} alt="JITI" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      <div style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "18px 18px 18px 4px", padding: "14px 18px", display: "flex", gap: "5px", alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
            style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#6B7280" }}
          />
        ))}
      </div>
    </div>
  );
}

function StarterPrompts({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px", padding: "40px 0" }}>
      <div style={{ textAlign: "center" }}>
        <img src={JITI_AVATAR} alt="" style={{ width: "72px", height: "72px", borderRadius: "50%", objectFit: "cover", display: "block", margin: "0 auto 12px" }} />
        <p style={{ color: "#E5E7EB", fontSize: "16px", fontWeight: 500, margin: 0 }}>Ask me anything about NJIT</p>
        <p style={{ color: "#6B7280", fontSize: "13px", marginTop: "6px", margin: "6px 0 0" }}>Events, connections, clubs — I know it all.</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", maxWidth: "480px" }}>
        {STARTERS.map(s => (
          <motion.button key={s} whileHover={{ scale: 1.03 }} onClick={() => onSelect(s)}
            style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", color: "#E5E7EB", cursor: "pointer", whiteSpace: "nowrap", outline: "none" }}>
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ActionPill({ action, onViewEvent, onConnect, onDisconnect, isConnected, isConnecting }: {
  action: ChatAction;
  onViewEvent: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnected: boolean;
  isConnecting: boolean;
}) {
  if (action.type === "view_event") {
    return (
      <motion.button whileHover={{ scale: 1.03 }} onClick={onViewEvent}
        style={{ backgroundColor: "rgba(192,57,43,0.15)", border: "1px solid rgba(192,57,43,0.35)", color: "#E74C3C", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 500, cursor: "pointer", outline: "none" }}>
        {action.label}
      </motion.button>
    );
  }
  if (action.type === "connect") {
    return (
      <motion.button
        whileHover={{ scale: isConnecting ? 1 : 1.03 }}
        onClick={isConnecting ? undefined : isConnected ? onDisconnect : onConnect}
        disabled={isConnecting}
        style={{ backgroundColor: isConnected ? "rgba(46,204,113,0.1)" : "rgba(255,255,255,0.06)", border: `1px solid ${isConnected ? "rgba(46,204,113,0.3)" : "rgba(255,255,255,0.15)"}`, color: isConnected ? "#2ECC71" : "#9CA3AF", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 500, cursor: isConnecting ? "not-allowed" : "pointer", outline: "none" }}>
        {isConnecting ? "…" : isConnected ? "✓ Connected" : action.label}
      </motion.button>
    );
  }
  return null;
}

function MessageBubble({ message, onViewEvent, onConnect, onDisconnect, connectedIds, connectingId }: {
  message: Message;
  onViewEvent: (eventId: number) => void;
  onConnect: (action: ChatAction) => void;
  onDisconnect: (action: ChatAction) => void;
  connectedIds: Set<string>;
  connectingId: string | null;
}) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-end", gap: "8px" }}>
      {!isUser && <img src={JITI_AVATAR} alt="JITI" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
      <div style={{ maxWidth: "75%" }}>
        <div style={{
          backgroundColor: isUser ? "#C0392B" : (message.error ? "rgba(192,57,43,0.15)" : "#1A1A1A"),
          border: isUser ? "none" : `1px solid ${message.error ? "rgba(192,57,43,0.3)" : "rgba(255,255,255,0.1)"}`,
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "12px 16px",
          color: "#E5E7EB",
          fontSize: "14px",
          lineHeight: "1.6",
        }}>
          {message.content}
        </div>
        {message.actions && message.actions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
            {message.actions.map((action, i) => (
              <ActionPill
                key={i}
                action={action}
                onViewEvent={() => action.event_id != null && onViewEvent(action.event_id)}
                onConnect={() => onConnect(action)}
                onDisconnect={() => onDisconnect(action)}
                isConnected={!!(action.user_id && connectedIds.has(action.user_id))}
                isConnecting={action.user_id === connectingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InputBar({ value, onChange, onSend, disabled }: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !disabled) {
      e.preventDefault();
      if (value.trim()) onSend();
    }
  }
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Ask about events, connections, clubs…"
        rows={1}
        disabled={disabled}
        style={{ flex: 1, backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "#E5E7EB", resize: "none", outline: "none", lineHeight: "1.5", maxHeight: "120px", fontFamily: "inherit" }}
      />
      <motion.button
        whileHover={{ scale: disabled || !value.trim() ? 1 : 1.05 }}
        whileTap={{ scale: disabled || !value.trim() ? 1 : 0.95 }}
        onClick={onSend}
        disabled={disabled || !value.trim()}
        style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: disabled || !value.trim() ? "rgba(192,57,43,0.3)" : "#C0392B", border: "none", cursor: disabled || !value.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Send size={18} color="white" />
      </motion.button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SandboxPage() {
  const { user, token } = useAuth();

  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const cachedEventsRef = useRef<any[]>([]);
  const scrollRef       = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages or loading state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function fetchContext() {
    const [upcomingRes, trendingRes, recsRes] = await Promise.all([
      fetch(`${EVENTS_API}/events/upcoming?limit=12`).catch(() => null),
      fetch(`${EVENTS_API}/events/trending?limit=5`).catch(() => null),
      token
        ? fetch(`${AUTH_API}/api/connections/recommendations`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const upcoming     = upcomingRes?.ok     ? await upcomingRes.json()     : [];
    const trending     = trendingRes?.ok     ? await trendingRes.json()     : [];
    const recsRaw      = recsRes?.ok         ? await recsRes.json()         : [];

    const upcomingList = (upcoming.events ?? upcoming).slice(0, 12);

    // Filter trending to current semester only (Spring = Jan–May, Fall = Sep–Dec)
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const semStart = m <= 5 ? `${y}-01-01` : `${y}-09-01`;
    const semEnd   = m <= 5 ? `${y}-05-31` : `${y}-12-31`;
    const trendingList = (trending.events ?? trending)
      .filter((e: any) => !e.date || (e.date >= semStart && e.date <= semEnd))
      .slice(0, 5);

    // Cache full event objects for EventDetailModal
    cachedEventsRef.current = [...upcomingList, ...trendingList];

    return {
      upcoming_events: upcomingList.map((e: any) => ({
        event_id: e.event_id, event_name: e.event_name, event_category: e.event_category,
        date: e.date, club_name: e.club_name, campus_location: e.campus_location,
        has_free_food: e.has_free_food ?? false, virtual: e.virtual ?? false,
      })),
      trending_events: trendingList.map((e: any) => ({
        event_id: e.event_id, event_name: e.event_name, event_category: e.event_category,
        date: e.date, club_name: e.club_name, campus_location: e.campus_location,
        has_free_food: e.has_free_food ?? false, virtual: e.virtual ?? false,
      })),
      recommendations: (Array.isArray(recsRaw) ? recsRaw : []).slice(0, 5).map((r: any) => ({
        id: r.id, name: r.name, major: r.major, year: r.year ?? null,
        score: r.score ?? 0,
        shared_clubs: Array.isArray(r.sharedClubs) ? r.sharedClubs : Array.isArray(r.shared_clubs) ? r.shared_clubs : [],
        shared_interests: Array.isArray(r.sharedInterests) ? r.sharedInterests : Array.isArray(r.shared_interests) ? r.shared_interests : [],
        shared_skills: Array.isArray(r.sharedSkills) ? r.sharedSkills : Array.isArray(r.shared_skills) ? r.shared_skills : [],
        looking_for: Array.isArray(r.lookingFor) ? r.lookingFor : Array.isArray(r.looking_for) ? r.looking_for : [],
      })),
    };
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const context = await fetchContext();
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

      const profile: UserProfile = {
        major:       user?.major ?? "",
        interests:   user?.interests ?? [],
        clubs:       user?.clubs ?? [],
        skills:      user?.skills ?? [],
        looking_for: user?.looking_for ?? [],
        year:        user?.year ?? null,
      };

      const res = await fetch(`${EVENTS_API}/sandbox/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          context: {
            ...context,
            profile: {
              name:            user?.name ?? "Student",
              major:           profile.major,
              year:            profile.year,
              interests:       profile.interests,
              clubs:           profile.clubs,
              skills:          profile.skills,
              looking_for:     profile.looking_for,
              graduation_year: user?.graduationYear ?? null,
            },
          },
        }),
      });

      const data = await res.json();
      const raw = (data.message ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: raw || "Something went wrong.",
        actions: data.actions ?? [],
        error: !raw,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Couldn't reach the server. Make sure the EDEN backend is running.",
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewEvent(eventId: number) {
    const cached = cachedEventsRef.current.find(e => e.event_id === eventId);
    if (cached) { setSelectedEvent(cached); return; }
    // Past events aren't in the cache — fetch from API
    try {
      const res = await fetch(`${EVENTS_API}/events/${eventId}`);
      if (res.ok) {
        const event = await res.json();
        cachedEventsRef.current = [...cachedEventsRef.current, event];
        setSelectedEvent(event);
      }
    } catch { /* silent */ }
  }

  async function handleConnect(action: ChatAction) {
    if (!action.user_id || !token) return;
    setConnectingId(action.user_id);
    try {
      await fetch(`${AUTH_API}/api/connections/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: action.user_id }),
      });
      setConnectedIds(prev => new Set([...prev, action.user_id!]));
    } finally {
      setConnectingId(null);
    }
  }

  async function handleDisconnect(action: ChatAction) {
    if (!action.user_id || !token) return;
    setConnectingId(action.user_id);
    try {
      await fetch(`${AUTH_API}/api/connections/${action.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnectedIds(prev => { const next = new Set(prev); next.delete(action.user_id!); return next; });
    } finally {
      setConnectingId(null);
    }
  }

  const profile: UserProfile = {
    major: user?.major ?? "", interests: user?.interests ?? [], clubs: user?.clubs ?? [],
    skills: user?.skills ?? [], looking_for: user?.looking_for ?? [], year: user?.year ?? null,
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px - 48px)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, paddingBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: "10px" }}>
          <img src={JITI_AVATAR} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }} />
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#fff", margin: 0 }}>Sandbox</h1>
          <span style={{ fontSize: "11px", color: "#4B5563", marginLeft: "2px" }}>GPT-4o-mini</span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 0", display: "flex", flexDirection: "column", gap: "14px" }}>
          {messages.length === 0 && !loading
            ? <StarterPrompts onSelect={sendMessage} />
            : messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onViewEvent={handleViewEvent}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  connectedIds={connectedIds}
                  connectingId={connectingId}
                />
              ))
          }
          {loading && <TypingIndicator />}
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px" }}>
          <InputBar value={input} onChange={setInput} onSend={() => sendMessage(input)} disabled={loading} />
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          attendees={null as unknown as AttendeeInfo}
          connectionIds={new Set()}
          rsvpStatus={null}
          onRsvpToggle={undefined}
          profile={profile}
          onClose={() => setSelectedEvent(null)}
          forceReadOnly={false}
        />
      )}
    </>
  );
}
