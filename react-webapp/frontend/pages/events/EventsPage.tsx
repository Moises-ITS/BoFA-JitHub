import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { TrendingUp, Zap, Flame } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { format } from "date-fns";
import { HeatmapCalendar } from "./components/heatmap-calendar";
import {
  CATEGORY_STYLE, fmt12, ClubAvatar, matchScore, EventDetailModal,
} from "./components/EventDetailModal";
import type { UserProfile, AttendeeInfo } from "./components/EventDetailModal";

const API = import.meta.env.VITE_EVENTS_API_URL ?? "http://localhost:8000";
const AUTH_API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// ─── Category filters ────────────────────────────────────────────────────────
const FILTERS = [
  { label: "Fundraising",          value: "fundraiser" },
  { label: "Exposure",             value: "exposure" },
  { label: "Volunteering",         value: "volunteering" },
  { label: "Workshop",             value: "workshop" },
  { label: "Panel / Info Session", value: "info session" },
  { label: "Site Tour",            value: "site tour" },
  { label: "Recruiting",           value: "recruiting" },
  { label: "GBM",                  value: "general meeting" },
  { label: "Social",               value: "social" },
  { label: "Conference",           value: "conference" },
  { label: "Study Support",        value: "study support" },
  { label: "Hackathon",            value: "hackathon" },
];

function MatchSignal({ score }: { score: number }) {
  if (score < 0) return null;
  const [color, title] =
    score >= 70 ? ["#2ECC71", "Strong match"] :
    score >= 40 ? ["#F39C12", "Moderate match"] :
                  ["#E74C3C", "Weak match"];
  return (
    <span
      title={title}
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
    />
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useEvents(endpoint: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((d) => { setData(d.events ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [endpoint]);
  return { data, loading };
}

function EventCard({
  event, index, profile, rsvpStatus, attendees, onRsvpToggle, connectionIds, onSelect,
}: {
  event: any; index: number; profile: UserProfile;
  rsvpStatus?: string | null;
  attendees?: AttendeeInfo;
  onRsvpToggle?: (eventId: number) => void;
  connectionIds?: Set<string>;
  onSelect?: (event: any) => void;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const score = matchScore(event, profile);
  const catStyle = CATEGORY_STYLE[event.event_category] ?? { bg: "rgba(255,255,255,0.07)", color: "#9CA3AF" };
  const isGoing = rsvpStatus === "going";
  const friendsGoing = attendees?.preview.filter(p => connectionIds?.has(p.user_id)).length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ x: 4 }}
      onClick={() => onSelect?.(event)}
      className="bg-[#1A1A1A] border border-white/10 rounded-xl p-5 hover:border-white/20 hover:bg-[#222222] transition-all cursor-pointer"
    >
      <div className="flex gap-4">
        <ClubAvatar clubId={event.club_id} clubName={event.club_name} index={index} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-semibold text-white">{event.event_name}</h3>
              <p className="text-sm text-[#9CA3AF]">{event.club_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <MatchSignal score={score} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {event.event_category && (
              <span className="text-xs px-2 py-0.5 rounded-md font-medium capitalize"
                style={{ backgroundColor: catStyle.bg, color: catStyle.color }}>
                {event.event_category}
              </span>
            )}
            {event.has_free_food && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: "rgba(230,126,34,0.2)", color: "#F39C12" }}>Free Food</span>}
            {event.virtual && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: "rgba(155,89,182,0.2)", color: "#BB8FCE" }}>Virtual</span>}
          </div>
          <p className="text-sm text-white mt-2">
            {event.date ? format(new Date(event.date + "T00:00:00"), "EEE, MMM d") : "Date TBD"}
            {event.start_time ? ` at ${fmt12(event.start_time.slice(0, 5))}` : ""}
          </p>

          {friendsGoing > 0 && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#2ECC71", display: "flex", alignItems: "center", gap: "5px" }}>
              <span>👥</span>
              <span>{friendsGoing === 1 ? "1 of your connections is going" : `${friendsGoing} of your connections are going`}</span>
            </div>
          )}

          {onRsvpToggle && (
            <div className="flex items-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onRsvpToggle(event.event_id)}
                style={{
                  border: `1px solid ${isGoing ? "#2ECC71" : "rgba(255,255,255,0.15)"}`,
                  backgroundColor: isGoing ? "rgba(46,204,113,0.12)" : "transparent",
                  color: isGoing ? "#2ECC71" : "#9CA3AF",
                  borderRadius: "8px", padding: "4px 10px",
                  fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {isGoing ? "✓ Going" : "Are you going?"}
              </button>
              {attendees && attendees.count > 0 && (
                <div
                  style={{ position: "relative" }}
                  onMouseEnter={() => setTooltipVisible(true)}
                  onMouseLeave={() => setTooltipVisible(false)}
                >
                  <span style={{ fontSize: "12px", color: "#9CA3AF", cursor: "default" }}>
                    {attendees.count} going
                  </span>
                  {tooltipVisible && attendees.preview.length > 0 && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, backgroundColor: "#2A2A2A", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "8px 10px", minWidth: "160px", zIndex: 50, pointerEvents: "none" }}>
                      {attendees.preview.map((p, idx) => (
                        <div key={idx} style={{ fontSize: "12px", color: "#E5E7EB", lineHeight: "1.7" }}>
                          {p.user_name}
                          {p.user_major && <span style={{ color: "#9CA3AF" }}> · {p.user_major}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TrendingPodium({ clubs }: { clubs: any[] }) {
  if (clubs.length < 3) return null;
  const podium = [
    { club: clubs[1], rank: 2, height: 58, bg: "rgba(189,195,199,0.15)", border: "rgba(189,195,199,0.3)", color: "#BDC3C7", delay: 0.05 },
    { club: clubs[0], rank: 1, height: 88, bg: "rgba(192,57,43,0.2)",    border: "rgba(230,126,34,0.5)",  color: "#E67E22",  delay: 0 },
    { club: clubs[2], rank: 3, height: 40, bg: "rgba(160,82,45,0.15)",   border: "rgba(160,82,45,0.3)",   color: "#CD853F",  delay: 0.1 },
  ];
  const medals = ["🥈", "🥇", "🥉"];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", padding: "8px 0 0" }}>
      {podium.map(({ club, rank, height, bg, border, color, delay }, i) => (
        <div key={rank} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            <div style={{ fontSize: "18px", marginBottom: "3px" }}>{medals[i]}</div>
            <p style={{ color: "#fff", fontSize: "10px", fontWeight: 600, lineHeight: 1.3, margin: 0, wordBreak: "break-word" as const }}>{club.club_name}</p>
            <p style={{ color: "#6B7280", fontSize: "9px", margin: "2px 0 0" }}>❤️ {club.total_likes}</p>
          </div>
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 18, delay }}
            style={{ width: "100%", backgroundColor: bg, border: `1px solid ${border}`, borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ color, fontSize: "13px", fontWeight: 700 }}>{rank}</span>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

function SidebarClubRow({ club, index, showScore }: { club: any; index: number; showScore?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
        index === 0 ? "bg-gradient-to-br from-[#C0392B] to-[#E74C3C] text-white" :
        index === 1 ? "bg-white/10 text-white" : "bg-white/5 text-[#9CA3AF]"
      }`}>{index + 1}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{club.club_name}</p>
        <p className="text-xs text-[#9CA3AF]">{club.event_count} events</p>
      </div>
      {showScore
        ? <span className="text-xs text-[#E67E22] shrink-0 font-medium">{club.avg_score}x</span>
        : <span className="text-xs text-[#9CA3AF] shrink-0">❤️ {club.total_likes}</span>}
    </motion.div>
  );
}

function TopEventRow({ event, index, onSelect }: { event: any; index: number; onSelect: (e: any) => void }) {
  const catStyle = CATEGORY_STYLE[event.event_category] ?? { bg: "rgba(255,255,255,0.07)", color: "#9CA3AF" };
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onSelect(event)}
      style={{ display: "flex", alignItems: "flex-start", gap: "10px", paddingTop: "10px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
      className="last:border-0 hover:opacity-80 transition-opacity"
    >
      <div style={{ width: "22px", height: "22px", borderRadius: "6px", backgroundColor: index === 0 ? "rgba(192,57,43,0.25)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: index === 0 ? "#E74C3C" : "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#E5E7EB", fontSize: "13px", fontWeight: 500, margin: "0 0 3px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{event.event_name}</p>
        <p style={{ color: "#6B7280", fontSize: "11px", margin: 0 }}>{event.club_name}</p>
      </div>
      {event.event_category && (
        <span style={{ backgroundColor: catStyle.bg, color: catStyle.color, fontSize: "10px", padding: "2px 7px", borderRadius: "4px", flexShrink: 0, marginTop: "2px", textTransform: "capitalize" as const }}>{event.event_category}</span>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const { user, token } = useAuth();
  const profile: UserProfile = {
    major: user?.major ?? "",
    interests: user?.interests ?? [],
    clubs: user?.clubs ?? [],
  };
  const [view, setView] = useState<"upcoming" | "trending" | "top-match">("upcoming");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const upcomingUrl = activeFilter
    ? `/events/upcoming?limit=50&category=${encodeURIComponent(activeFilter)}`
    : "/events/upcoming?limit=50";

  const { data: upcomingRaw, loading: upcomingLoading } = useEvents(upcomingUrl);
  const { data: trendingEvents, loading: trendingLoading } = useEvents("/events/trending?limit=50&upcoming_only=true");
  const { data: sidebarTrending } = useEvents("/events/clubs/trending?limit=5");
  const { data: topRisers } = useEvents("/events/clubs/top-risers?limit=5");
  const { data: topEvents } = useEvents("/events/top-risers?limit=5");

  const [rsvpMap, setRsvpMap] = useState<Record<number, string | null>>({});
  const [attendeeMap, setAttendeeMap] = useState<Record<number, AttendeeInfo>>({});
  const [connectionIds, setConnectionIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedEventCanRsvp, setSelectedEventCanRsvp] = useState(true);
  const [modalAttendees, setModalAttendees] = useState<AttendeeInfo | null>(null);

  useEffect(() => {
    if (!selectedEvent) { setModalAttendees(null); return; }
    fetch(`${API}/rsvp/${selectedEvent.event_id}/attendees`)
      .then(r => r.json())
      .then(setModalAttendees)
      .catch(() => {});
  }, [selectedEvent]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${AUTH_API}/api/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: { id: string }[]) => setConnectionIds(new Set(data.map(c => c.id))))
      .catch(() => {});
  }, [user?.id]);

  const displayEvents = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    if (view === "trending")
      return trendingEvents.filter((e: any) => !e.date || e.date >= today);
    if (view === "top-match") {
      return [...upcomingRaw]
        .map(e => ({ ...e, _score: matchScore(e, profile) }))
        .filter(e => e._score >= 0)
        .sort((a, b) => b._score - a._score);
    }
    return upcomingRaw;
  }, [view, trendingEvents, upcomingRaw, user]);
  const loading = view === "trending" ? trendingLoading : upcomingLoading;

  useEffect(() => {
    if (!displayEvents.length) return;
    displayEvents.forEach((event: any) => {
      fetch(`${API}/rsvp/${event.event_id}/attendees`)
        .then(r => r.json())
        .then((data: AttendeeInfo) => {
          if (data.count > 0)
            setAttendeeMap(prev => ({ ...prev, [event.event_id]: data }));
        })
        .catch(() => {});
    });
  }, [displayEvents]);

  useEffect(() => {
    if (!displayEvents.length || !user?.id) return;
    fetch(`${API}/rsvp/batch-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, event_ids: displayEvents.map((e: any) => e.event_id) }),
    })
      .then(r => r.json())
      .then((data: Record<string, string>) =>
        setRsvpMap(prev => ({
          ...prev,
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [Number(k), v])),
        }))
      )
      .catch(() => {});
  }, [displayEvents, user?.id]);

  async function handleRsvpToggle(eventId: number) {
    if (!user) return;
    const current = rsvpMap[eventId] ?? null;
    const newStatus = current === "going" ? null : "going";
    setRsvpMap(prev => ({ ...prev, [eventId]: newStatus }));
    try {
      if (newStatus === null) {
        await fetch(`${API}/rsvp/${eventId}/${encodeURIComponent(user.id)}`, { method: "DELETE" });
      } else {
        await fetch(`${API}/rsvp/${eventId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id, user_name: user.name,
            user_major: user.major ?? null,
            user_interests: JSON.stringify(user.interests ?? []),
            user_clubs: JSON.stringify(user.clubs ?? []),
            status: "going",
          }),
        });
      }
    } catch {
      setRsvpMap(prev => ({ ...prev, [eventId]: current }));
    }
    fetch(`${API}/rsvp/${eventId}/attendees`)
      .then(r => r.json())
      .then((data: AttendeeInfo) => {
        setAttendeeMap(prev => ({ ...prev, [eventId]: data }));
        if (selectedEvent?.event_id === eventId) setModalAttendees(data);
      })
      .catch(() => {});
  }

  const VIEW_TABS = [
    { key: "upcoming",  label: "Upcoming" },
    { key: "trending",  label: "Trending" },
    { key: "top-match", label: "Top Match" },
  ] as const;

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">
          <span className="bg-gradient-to-r from-[#C0392B] to-[#E67E22] bg-clip-text text-transparent">Events</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">

          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1" style={{ width: "fit-content" }}>
            {VIEW_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`text-sm px-4 py-1.5 rounded-md font-medium transition-all ${
                  view === key
                    ? "bg-[#C0392B] text-white"
                    : "text-[#9CA3AF] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "upcoming" && (
            <select
              value={activeFilter ?? ""}
              onChange={(e) => setActiveFilter(e.target.value || null)}
              className="text-sm bg-[#1A1A1A] border border-white/10 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-white/30 cursor-pointer"
              style={{ colorScheme: "dark" }}
            >
              <option value="">All categories</option>
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          )}

          {loading && <p className="text-[#9CA3AF] text-sm">Loading...</p>}
          {!loading && displayEvents.length === 0 && (
            <div className="text-center py-16 text-[#9CA3AF]">
              <p className="text-4xl mb-3">📅</p>
              <p className="font-medium text-white">
                {view === "top-match" ? "Set up your profile to see matches" : "No events found"}
              </p>
              <p className="text-sm mt-1">
                {view === "top-match" ? "Add your major, interests, and clubs in your profile." : activeFilter ? "Try a different category." : "Check back soon."}
              </p>
            </div>
          )}
          {displayEvents.map((event, i) => (
            <EventCard
              key={event.event_id}
              event={event}
              index={i}
              profile={profile}
              rsvpStatus={rsvpMap[event.event_id] ?? null}
              attendees={attendeeMap[event.event_id]}
              onRsvpToggle={user ? handleRsvpToggle : undefined}
              connectionIds={connectionIds}
              onSelect={(e) => { setSelectedEvent(e); setSelectedEventCanRsvp(true); }}
            />
          ))}
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          <HeatmapCalendar />
          <div style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "24px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: "12px" }}>
              <TrendingUp className="w-4 h-4 text-[#C0392B]" />
              <h3 className="font-semibold text-white text-sm">Trending This Semester</h3>
            </div>
            <TrendingPodium clubs={sidebarTrending} />
            {sidebarTrending.length > 3 && (
              <div style={{ marginTop: "18px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "14px" }}>
                {sidebarTrending.slice(3).map((c, i) => <SidebarClubRow key={c.club_name} club={c} index={i + 3} />)}
              </div>
            )}
          </div>
          <div style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "24px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: "16px" }}>
              <Zap className="w-4 h-4 text-[#E67E22]" />
              <h3 className="font-semibold text-white text-sm">Top Risers This Semester</h3>
            </div>
            {topRisers.map((c, i) => <SidebarClubRow key={c.club_name} club={c} index={i} showScore />)}
          </div>
          <div style={{ backgroundColor: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "24px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: "4px" }}>
              <Flame className="w-4 h-4 text-[#E74C3C]" />
              <h3 className="font-semibold text-white text-sm">Top Events of the Semester</h3>
            </div>
            <div>
              {topEvents.map((event, i) => (
                <TopEventRow key={event.event_id} event={event} index={i} onSelect={(e) => { setSelectedEvent(e); setSelectedEventCanRsvp(false); }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {selectedEvent && (
      <EventDetailModal
        event={selectedEvent}
        attendees={modalAttendees}
        connectionIds={connectionIds}
        rsvpStatus={rsvpMap[selectedEvent.event_id] ?? null}
        onRsvpToggle={user && selectedEventCanRsvp ? handleRsvpToggle : undefined}
        profile={profile}
        onClose={() => setSelectedEvent(null)}
        forceReadOnly={!selectedEventCanRsvp}
      />
    )}
    </>
  );
}
