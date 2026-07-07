import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { TrendingUp, Zap, Flame, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { HeatmapCalendar } from "./components/heatmap-calendar";
import { EventDetailModal } from "./components/EventDetailModal";
import { ClubAvatar } from "./components/ClubAvatar";
import { CATEGORY_STYLE, CLUB_EMOJIS, fmt12, getEventCategories } from "./utils/eventFormatting";
import { matchScore, type UserProfile } from "./utils/eventScoring";
import SubmitEventModal, { type CommunityEventInput } from "./components/SubmitEventModal";
import type { AttendeeInfo } from "./components/EventDetailModal";
import {
  type ClubDirectoryEntry,
  eventMatchesQuery,
  getClubOptionLabel,
} from "./utils/clubMatching";

import { apiFetch, EDEN_API_BASE_URL as API } from "@/lib/api";

function eventWebSocketUrl() {
  try {
    const url = new URL(API);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/events/ws";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

// ─── Category filters ────────────────────────────────────────────────────────
const FILTERS = [
  { label: "Fundraising", value: "fundraiser" },
  { label: "Exposure", value: "exposure" },
  { label: "Volunteering", value: "volunteering" },
  { label: "Workshop", value: "workshop" },
  { label: "Panel / Info Session", value: "info session" },
  { label: "Site Tour", value: "site tour" },
  { label: "Recruiting", value: "recruiting" },
  { label: "GBM", value: "general meeting" },
  { label: "Social", value: "social" },
  { label: "Conference", value: "conference" },
  { label: "Study Support", value: "study support" },
  { label: "Hackathon", value: "hackathon" },
];

function MatchSignal({ score }: { score: number }) {
  if (score < 0) return null;
  const [color, title] =
    score >= 70 ? ["var(--status-success)", "Strong match"] :
      score >= 40 ? ["var(--status-warning)", "Moderate match"] :
        ["var(--status-error)", "Weak match"];
  return (
    <span
      title={title}
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      className="w-2.5 h-2.5 rounded-full shrink-0 inline-block"
    />
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useEvents(endpoint: string | null, refreshKey = 0) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(Boolean(endpoint));

  useEffect(() => {
    let cancelled = false;

    if (!endpoint) {
      setData([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);

    fetch(`${API}${endpoint}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData(d.events ?? d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, refreshKey]);

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
  const isGoing = rsvpStatus === "going";
  const friendsGoing = attendees?.preview.filter(p => connectionIds?.has(p.user_id)).length ?? 0;
  const eventCategories = getEventCategories(event);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.015 }}
      whileHover={{ x: 4 }}
      onClick={() => onSelect?.(event)}
      className="rounded-xl p-5 transition-all cursor-pointer"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex gap-4">
        <ClubAvatar clubId={event.club_id} clubName={event.club_name} index={index} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-semibold text-white">{event.event_name}</h3>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{event.club_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              <MatchSignal score={score} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {eventCategories.map((category) => {
              const catStyle = CATEGORY_STYLE[category] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" };
              return (
                <span
                  key={category}
                  className="text-xs px-2 py-0.5 rounded-md font-medium capitalize"
                  style={{ backgroundColor: catStyle.bg, color: catStyle.color }}
                >
                  {category}
                </span>
              );
            })}
            {event.has_free_food && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: "var(--accent-events-soft)", color: "var(--accent-events)" }}>Free Food</span>}
            {event.virtual && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: "var(--accent-orgs-soft)", color: "var(--accent-orgs)" }}>Virtual</span>}
          </div>
          <p className="text-sm text-white mt-2">
            {event.date ? format(new Date(event.date + "T00:00:00"), "EEE, MMM d") : "Date TBD"}
            {event.start_time ? ` at ${fmt12(event.start_time.slice(0, 5))}` : ""}
          </p>

          {friendsGoing > 0 && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--status-success)", display: "flex", alignItems: "center", gap: "5px" }}>
              <span>👥</span>
              <span>{friendsGoing === 1 ? "1 of your connections is going" : `${friendsGoing} of your connections are going`}</span>
            </div>
          )}

          {onRsvpToggle && (
            <div className="flex items-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onRsvpToggle(event.event_id)}
                style={{
                  border: `1px solid ${isGoing ? "rgba(63,199,141,0.28)" : "var(--border-default)"}`,
                  backgroundColor: isGoing ? "var(--status-success-soft)" : "transparent",
                  color: isGoing ? "var(--status-success)" : "var(--text-muted)",
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
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "default" }}>
                    {attendees.count} going
                  </span>
                  {tooltipVisible && attendees.preview.length > 0 && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, backgroundColor: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "8px", padding: "8px 10px", minWidth: "160px", zIndex: 50, pointerEvents: "none" }}>
                      {attendees.preview.map((p, idx) => (
                        <div key={idx} style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: "1.7" }}>
                          {p.user_name}
                          {p.user_major && <span style={{ color: "var(--text-muted)" }}> · {p.user_major}</span>}
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

function RankingAvatar({
  clubId,
  clubName,
  index,
  size = 28,
}: {
  clubId?: number;
  clubName: string;
  index: number;
  size?: number;
}) {
  const [failed, setFailed] = useState(clubId == null);

  if (clubId != null && !failed) {
    return (
      <img
        src={`/club_pics/${clubId}.jpg`}
        alt={clubName}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="rounded-lg object-cover shrink-0"
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        fontSize: Math.max(14, size * 0.55),
        backgroundColor: "rgba(255,255,255,0.05)",
      }}
      className="rounded-lg flex items-center justify-center shrink-0"
      aria-label={clubName}
    >
      {CLUB_EMOJIS[index % CLUB_EMOJIS.length]}
    </div>
  );
}

function TrendingPodium({ clubs }: { clubs: any[] }) {
  if (clubs.length < 3) return null;
  const podium = [
    { club: clubs[1], rank: 2, height: 58, bg: "rgba(255,255,255,0.08)", border: "var(--border-default)", delay: 0.02 },
    { club: clubs[0], rank: 1, height: 88, bg: "var(--brand-primary-soft)", border: "var(--brand-primary-soft-strong)", delay: 0 },
    { club: clubs[2], rank: 3, height: 40, bg: "var(--accent-events-soft)", border: "rgba(226,154,59,0.28)", delay: 0.04 },
  ];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", padding: "8px 0 0" }}>
      {podium.map(({ club, rank, height, bg, border, delay }, i) => (
        <div key={rank} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ textAlign: "center", marginBottom: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <RankingAvatar clubId={club.club_id} clubName={club.club_name} index={i} size={34} />
            <p style={{ color: "#fff", fontSize: "10px", fontWeight: 600, lineHeight: 1.3, margin: 0, wordBreak: "break-word" as const }}>{club.club_name}</p>
            <p style={{ color: "var(--text-subtle)", fontSize: "9px", margin: "2px 0 0" }}>❤️ {club.total_likes}</p>
          </div>
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height, opacity: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 18, delay }}
            style={{ width: "100%", backgroundColor: bg, border: `1px solid ${border}`, borderRadius: "6px 6px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div style={{ paddingTop: "8px", paddingBottom: "8px" }}>
              <RankingAvatar clubId={club.club_id} clubName={club.club_name} index={i} size={26} />
            </div>
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
      transition={{ delay: index * 0.02 }}
      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
    >
      <RankingAvatar clubId={club.club_id} clubName={club.club_name} index={index} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{club.club_name}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{club.event_count} events</p>
      </div>
      {showScore
        ? <span className="text-xs shrink-0 font-medium" style={{ color: "var(--accent-events)" }}>{club.avg_score}x</span>
        : <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>❤️ {club.total_likes}</span>}
    </motion.div>
  );
}

function TopEventRow({ event, index, onSelect }: { event: any; index: number; onSelect: (e: any) => void }) {
  const primaryCategory = getEventCategories(event)[0];
  const catStyle = primaryCategory ? (CATEGORY_STYLE[primaryCategory] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }) : null;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={() => onSelect(event)}
      style={{ display: "flex", alignItems: "flex-start", gap: "10px", paddingTop: "10px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}
      className="last:border-0 hover:opacity-80 transition-opacity"
    >
      <div style={{ marginTop: "1px" }}>
        <RankingAvatar clubId={event.club_id} clubName={event.club_name} index={index} size={24} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 500, margin: "0 0 3px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{event.event_name}</p>
        <p style={{ color: "var(--text-subtle)", fontSize: "11px", margin: 0 }}>{event.club_name}</p>
      </div>
      {primaryCategory && catStyle && (
        <span style={{ backgroundColor: catStyle.bg, color: catStyle.color, fontSize: "10px", padding: "2px 7px", borderRadius: "4px", flexShrink: 0, marginTop: "2px", textTransform: "capitalize" as const }}>{primaryCategory}</span>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const { user, token } = useAuth();
  const profile = useMemo<UserProfile>(() => ({
    major: user?.major ?? "",
    interests: user?.interests ?? [],
    clubs: user?.clubs ?? [],
    skills: user?.skills ?? [],
    looking_for: user?.looking_for ?? [],
    year: user?.year ?? null,
  }), [user?.major, user?.interests, user?.clubs, user?.skills, user?.looking_for, user?.year]);
  const [view, setView] = useState<"upcoming" | "trending" | "top-match">("upcoming");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [clubOptions, setClubOptions] = useState<ClubDirectoryEntry[]>([]);

  const upcomingUrl = activeFilter
    ? `/events/upcoming?limit=50&category=${encodeURIComponent(activeFilter)}`
    : "/events/upcoming?limit=50";
  const trendingUrl = view === "trending" ? "/events/trending?limit=50&upcoming_only=true" : null;

  const { data: upcomingRaw, loading: upcomingLoading } = useEvents(upcomingUrl, refreshNonce);
  const { data: trendingEvents, loading: trendingLoading } = useEvents(trendingUrl, refreshNonce);
  const { data: sidebarTrending } = useEvents("/events/clubs/trending?limit=5", refreshNonce);
  const { data: topRisers } = useEvents("/events/clubs/top-risers?limit=5", refreshNonce);
  const { data: topEvents } = useEvents("/events/top-risers?limit=5", refreshNonce);

  const [rsvpMap, setRsvpMap] = useState<Record<number, string | null>>({});
  const [attendeeMap, setAttendeeMap] = useState<Record<number, AttendeeInfo>>({});
  const [connectionIds, setConnectionIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedEventCanRsvp, setSelectedEventCanRsvp] = useState(true);
  const [modalAttendees, setModalAttendees] = useState<AttendeeInfo | null>(null);
  const selectedEventId = selectedEvent?.event_id ?? null;

  useEffect(() => {
    const wsUrl = eventWebSocketUrl();
    if (!wsUrl) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closedByPage = false;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "event.created") {
            setRefreshNonce((prev) => prev + 1);
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };
      socket.onclose = () => {
        socket = null;
        if (!closedByPage) {
          reconnectTimer = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      closedByPage = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setClubsLoading(true);

    fetch(`${API}/clubs`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const clubs = Array.isArray(data) ? [...data as ClubDirectoryEntry[]] : [];
        clubs.sort((left, right) => getClubOptionLabel(left).localeCompare(getClubOptionLabel(right)));
        setClubOptions(clubs);
      })
      .catch(() => {
        if (!cancelled) {
          setClubOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClubsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClub = useMemo(
    () => clubOptions.find((club) => String(club.club_id) === selectedClubId) ?? null,
    [clubOptions, selectedClubId],
  );
  const selectedEventAttendees = selectedEventId ? attendeeMap[selectedEventId] : null;

  useEffect(() => {
    if (!selectedEventId) return;

    let cancelled = false;

    fetch(`${API}/events/${selectedEventId}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || data?.error) return;
        setSelectedEvent((prev: any) => (
          prev?.event_id === selectedEventId
            ? { ...prev, ...data }
            : prev
        ));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) {
      setModalAttendees(null);
      return;
    }

    if (selectedEventAttendees) {
      setModalAttendees(selectedEventAttendees);
      return;
    }

    let cancelled = false;

    fetch(`${API}/rsvp/${selectedEventId}/attendees`)
      .then(r => r.json())
      .then((data: AttendeeInfo) => {
        if (cancelled) return;
        setAttendeeMap((prev) => ({ ...prev, [selectedEventId]: data }));
        setModalAttendees(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedEventAttendees, selectedEventId]);

  useEffect(() => {
    if (!user?.id || !token) return;

    let cancelled = false;

    apiFetch<{ id: string }[]>("/api/connections", token)
      .then(({ ok, data }) => {
        if (!cancelled && ok && Array.isArray(data)) {
          setConnectionIds(new Set(data.map((connection) => connection.id)));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  const displayEvents = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let baseEvents: any[] = [];
    if (view === "trending") {
      baseEvents = trendingEvents.filter((e: any) => !e.date || e.date >= today);
    } else if (view === "top-match") {
      baseEvents = [...upcomingRaw]
        .map(e => ({ ...e, _score: matchScore(e, profile) }))
        .filter(e => e._score >= 0)
        .sort((a, b) => b._score - a._score);
    } else {
      baseEvents = upcomingRaw;
    }

    if (selectedClub) {
      baseEvents = baseEvents.filter((event: any) => event.club_id === selectedClub.club_id);
    }

    if (searchQuery.trim()) {
      baseEvents = baseEvents.filter((event: any) => eventMatchesQuery(event, searchQuery));
    }

    return baseEvents;
  }, [view, trendingEvents, upcomingRaw, profile, searchQuery, selectedClub]);
  const displayEventIds = useMemo(
    () => displayEvents.map((event: any) => event.event_id),
    [displayEvents],
  );
  const displayEventIdsKey = useMemo(
    () => displayEventIds.join(","),
    [displayEventIds],
  );
  const loading = view === "trending" ? trendingLoading : upcomingLoading;

  useEffect(() => {
    if (!displayEventIds.length) return;

    let cancelled = false;

    fetch(`${API}/rsvp/batch-attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_ids: displayEventIds }),
    })
      .then(r => r.json())
      .then((data: Record<string, AttendeeInfo>) => {
        if (cancelled) return;
        const nextEntries = Object.fromEntries(
          displayEventIds.map((eventId) => [eventId, data[String(eventId)] ?? { count: 0, preview: [] }]),
        ) as Record<number, AttendeeInfo>;
        setAttendeeMap((prev) => ({ ...prev, ...nextEntries }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [displayEventIds, displayEventIdsKey]);

  useEffect(() => {
    if (!displayEventIds.length || !user?.id) return;

    let cancelled = false;

    fetch(`${API}/rsvp/batch-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, event_ids: displayEventIds }),
    })
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (cancelled) return;
        setRsvpMap(prev => ({
          ...prev,
          ...Object.fromEntries(Object.entries(data).map(([k, v]) => [Number(k), v])),
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [displayEventIds, displayEventIdsKey, user?.id]);

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
      .catch(() => { });
  }

  async function handleCreateEvent(payload: CommunityEventInput) {
    setSubmitLoading(true);
    try {
      const res = await fetch(`${API}/events/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail ?? body.error ?? "Could not create event");
      }

      setView("upcoming");
      setActiveFilter(null);
      setSearchQuery("");
      setSelectedClubId("");
      setSelectedEvent(body);
      setSelectedEventCanRsvp(true);
      setModalAttendees({ count: 0, preview: [] });
      setRefreshNonce((prev) => prev + 1);
      setSubmitOpen(false);
    } finally {
      setSubmitLoading(false);
    }
  }

  const VIEW_TABS = [
    { key: "upcoming", label: "Upcoming" },
    { key: "trending", label: "Trending" },
    { key: "top-match", label: "Top Match" },
  ] as const;

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-1">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--brand-gradient)" }}>Events</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1" style={{ width: "fit-content", border: "1px solid var(--border-default)" }}>
                {VIEW_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={`text-sm px-4 py-1.5 rounded-md font-medium transition-all ${view === key
                        ? "text-white"
                        : "hover:text-white"
                      }`}
                    style={view === key ? { backgroundColor: "var(--brand-primary)" } : { color: "var(--text-muted)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div
                style={{
                  position: "relative",
                  minWidth: "min(100%, 280px)",
                }}
              >
                <Search
                  className="w-4 h-4"
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events or clubs"
                  className="text-sm text-white rounded-lg py-2 pr-3 focus:outline-none"
                  style={{
                    width: "100%",
                    paddingLeft: "36px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                  }}
                />
              </div>

              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="text-sm text-white rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
                style={{ colorScheme: "dark", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
              >
                <option value="">{clubsLoading ? "Loading clubs..." : "All clubs"}</option>
                {clubOptions.map((club) => (
                  <option key={club.club_id} value={String(club.club_id)}>
                    {getClubOptionLabel(club)}
                  </option>
                ))}
              </select>

              {view === "upcoming" && (
                <select
                  value={activeFilter ?? ""}
                  onChange={(e) => setActiveFilter(e.target.value || null)}
                  className="text-sm text-white rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
                  style={{ colorScheme: "dark", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
                >
                  <option value="">All categories</option>
                  {FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => setSubmitOpen(true)}
                className="rounded-lg px-3 py-2 text-xs font-semibold transition-transform hover:-translate-y-0.5 whitespace-nowrap"
                style={{
                  border: "1px solid rgba(204, 0, 0, 0.24)",
                  background: "linear-gradient(135deg, rgba(215, 25, 32, 0.16), rgba(215, 25, 32, 0.08))",
                  color: "#f7d7d9",
                }}
              >
                Submit Event
              </button>
            </div>

            {loading && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>}
            {!loading && displayEvents.length === 0 && (
              <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                <p className="text-4xl mb-3">📅</p>
                <p className="font-medium text-white">
                  {view === "top-match" ? "Set up your profile to see matches" : "No events found"}
                </p>
                <p className="text-sm mt-1">
                  {view === "top-match"
                    ? "Add your major, interests, and clubs in your profile."
                    : (activeFilter || selectedClubId || searchQuery.trim())
                      ? "Try adjusting your search or filters."
                      : "Check back soon."}
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
            <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "24px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: "12px" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
                <h3 className="font-semibold text-white text-sm">Trending This Semester</h3>
              </div>
              <TrendingPodium clubs={sidebarTrending} />
              {sidebarTrending.length > 3 && (
                <div style={{ marginTop: "18px", borderTop: "1px solid var(--border-default)", paddingTop: "14px" }}>
                  {sidebarTrending.slice(3).map((c, i) => <SidebarClubRow key={c.club_name} club={c} index={i + 3} />)}
                </div>
              )}
            </div>
            <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "24px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: "16px" }}>
                <Zap className="w-4 h-4" style={{ color: "var(--accent-events)" }} />
                <h3 className="font-semibold text-white text-sm">Top Risers This Semester</h3>
              </div>
              {topRisers.map((c, i) => <SidebarClubRow key={c.club_name} club={c} index={i} showScore />)}
            </div>
            <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px", padding: "24px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: "4px" }}>
                <Flame className="w-4 h-4" style={{ color: "var(--status-error)" }} />
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

      <SubmitEventModal
        open={submitOpen}
        submitting={submitLoading}
        categories={FILTERS}
        clubs={clubOptions}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleCreateEvent}
      />
    </>
  );
}
