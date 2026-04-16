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

// ── Topic extraction ───────────────────────────────────────────────────────────
const TOPIC_MAP: [RegExp, string][] = [
  [/hackathon|hack[- ]?a?thon/i,                      "hackathons"],
  [/network(ing)?|meet people|connect with people/i,  "networking"],
  [/internship|co-?op|\bjob\b|career|recruit|hiring/i,"career"],
  [/research|lab\b|professor|faculty/i,               "research"],
  [/free food|snack|food/i,                           "free food"],
  [/study|homework|tutor|academic/i,                  "academics"],
  [/\bclub\b|org(anization)?|\bjoin\b/i,              "clubs"],
  [/social|hang(ing)?|party|fun/i,                    "social"],
  [/tech|coding|programming|software|\bcs\b/i,        "tech/CS"],
  [/art|design|creative|music|performance/i,          "arts"],
  [/sport|athletic|gym|fitness/i,                     "sports"],
  [/culture|cultural|diversity|identity/i,            "culture"],
  [/volunteer|community service/i,                    "community service"],
];

function extractTopics(text: string): string[] {
  return TOPIC_MAP.filter(([re]) => re.test(text)).map(([, topic]) => topic);
}

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
  if (action.type === "connect" && !action.label?.trim()) {
    action.label = action.user_name?.trim() || "Connect";
  }

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
          whiteSpace: "pre-wrap",
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

  const storageKey = `jiti_chat_${user?.id ?? "guest"}`;

  const [messages, setMessages]       = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(`jiti_chat_${user?.id ?? "guest"}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [rsvpMap, setRsvpMap] = useState<Record<number, string | null>>({});
  const [rsvpingId, setRsvpingId] = useState<number | null>(null);
  const [chatInterests, setChatInterests] = useState<string[]>([]);

  // Load persisted chat interests on mount
  useEffect(() => {
    if (!token) return;
    fetch(`${AUTH_API}/api/chat-memory`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((rows: { topic: string }[]) => setChatInterests(rows.map(r => r.topic)))
      .catch(() => {});
  }, [token]); // eslint-disable-line

  const cachedEventsRef = useRef<any[]>([]);
  const scrollRef       = useRef<HTMLDivElement>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); }
    catch { /* storage full — silent */ }
  }, [messages, storageKey]);

  // Auto-scroll to bottom whenever messages or loading state change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(storageKey);
  }

  function isContextRelevant(text: string): boolean {
    return /event|club|org|connect|network|people|trending|popular|semester|happening|rsvp|attend|hackathon|workshop|panel|social|recruit|intern|research|food|talk|meet|who should|what'?s? (going|up|on)|top|shpe|ieee|acm|wics|nsbe|swe|greek|fraternity|sorority/i.test(text);
  }

  function emptyContext() {
    return { upcoming_events: [], trending_events: [], recommendations: [] };
  }

  function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 5000): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer))
      .catch(() => null);
  }

  async function fetchContext() {
    const [upcomingRes, trendingRes, recsRes] = await Promise.all([
      fetchWithTimeout(`${EVENTS_API}/events/upcoming?limit=12`),
      fetchWithTimeout(`${EVENTS_API}/events/top-risers?limit=10`),
      token
        ? fetchWithTimeout(`${AUTH_API}/api/connections/recommendations`, { headers: { Authorization: `Bearer ${token}` } })
        : Promise.resolve(null),
    ]);

    const upcoming     = upcomingRes?.ok     ? await upcomingRes.json()     : [];
    const trending     = trendingRes?.ok     ? await trendingRes.json()     : [];
    const recsRaw      = recsRes?.ok         ? await recsRes.json()         : [];

    const upcomingList = (upcoming.events ?? upcoming).slice(0, 12);

    const trendingList = (trending.events ?? trending).slice(0, 10);

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
      const context = isContextRelevant(text) ? await fetchContext() : emptyContext();
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

      const profile: UserProfile = {
        major:       user?.major ?? "",
        interests:   user?.interests ?? [],
        clubs:       user?.clubs ?? [],
        skills:      user?.skills ?? [],
        looking_for: user?.looking_for ?? [],
        year:        user?.year ?? null,
      };

      // Record any topics found in this message (fire-and-forget)
      const newTopics = extractTopics(text);
      if (newTopics.length > 0 && token) {
        fetch(`${AUTH_API}/api/chat-memory/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ topics: newTopics }),
        }).then(() => {
          // Optimistically merge new topics into local state
          setChatInterests(prev => {
            const merged = [...prev];
            for (const t of newTopics) if (!merged.includes(t)) merged.push(t);
            return merged;
          });
        }).catch(() => {});
      }

      const body = JSON.stringify({
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
            chat_interests:  chatInterests,
          },
        },
      });

      const res = await fetch(`${EVENTS_API}/sandbox/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      // Add empty assistant bubble we'll fill as tokens arrive
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", actions: [] }]);
      setLoading(false); // hide typing indicator — we're streaming now

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "text") {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + event.text } : m
              ));
            } else if (event.type === "done") {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, actions: event.actions ?? [] } : m
              ));
            } else if (event.type === "error") {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `Error: ${event.message}`, error: true } : m
              ));
            }
          } catch { /* malformed chunk */ }
        }
      }
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
    if (cached) { setSelectedEvent(cached); } else {
      try {
        const res = await fetch(`${EVENTS_API}/events/${eventId}`);
        if (res.ok) {
          const event = await res.json();
          cachedEventsRef.current = [...cachedEventsRef.current, event];
          setSelectedEvent(event);
        }
      } catch { /* silent */ }
    }
    // Load RSVP status from DB if user is logged in
    if (user) {
      try {
        const res = await fetch(`${EVENTS_API}/rsvp/batch-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, event_ids: [eventId] }),
        });
        if (res.ok) {
          const data: Record<string, string> = await res.json();
          setRsvpMap(prev => ({ ...prev, [eventId]: data[String(eventId)] ?? null }));
        }
      } catch { /* silent */ }
    }
  }

  async function handleConnect(action: ChatAction) {
    if (!action.user_id || !token) return;
    setConnectingId(action.user_id);
    try {
      await fetch(`${AUTH_API}/api/connections/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: action.user_id }),
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
      await fetch(`${AUTH_API}/api/connections/by-user/${action.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnectedIds(prev => { const next = new Set(prev); next.delete(action.user_id!); return next; });
    } finally {
      setConnectingId(null);
    }
  }

  async function handleRsvp(eventId: number) {
    if (!user) return;
    const current = rsvpMap[eventId] ?? null;
    const newStatus = current === "going" ? null : "going";
    setRsvpMap(prev => ({ ...prev, [eventId]: newStatus }));
    setRsvpingId(eventId);
    try {
      if (newStatus === null) {
        await fetch(`${EVENTS_API}/rsvp/${eventId}/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      } else {
        await fetch(`${EVENTS_API}/rsvp/${eventId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id, user_name: user.name,
            user_major: user.major ?? null,
            status: "going",
          }),
        });
      }
    } catch {
      setRsvpMap(prev => ({ ...prev, [eventId]: current }));
    } finally {
      setRsvpingId(null);
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
          <span style={{ fontSize: "11px", color: "#4B5563", marginLeft: "2px" }}>Claude Haiku</span>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              style={{ marginLeft: "auto", fontSize: "12px", color: "#4B5563", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#9CA3AF")}
              onMouseLeave={e => (e.currentTarget.style.color = "#4B5563")}
            >
              Clear
            </button>
          )}
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
          rsvpStatus={selectedEvent ? (rsvpMap[selectedEvent.event_id] ?? null) : null}
          onRsvpToggle={handleRsvp}
          profile={profile}
          onClose={() => setSelectedEvent(null)}
          forceReadOnly={false}
        />
      )}
    </>
  );
}
