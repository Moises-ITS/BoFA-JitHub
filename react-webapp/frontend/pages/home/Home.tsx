import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Calendar, Briefcase, Network, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
// Live opportunities come from the same hook the /opportunities page uses, so
// the home spotlight card and the full page can never disagree about what the
// "top match" is. (This replaced a hardcoded mock list that showed every
// student identical fake data.)
import { useOpportunities } from "../opportunities/hooks/useOpportunities";
import { OPPORTUNITY_TYPE_ICON } from "../opportunities/types/opportunities";
import { DeadlineChip } from "./deadline-chip";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import {
  CATEGORY_STYLE, EventDetailModal, fmt12, CLUB_EMOJIS,
} from "../events/components/EventDetailModal";
import type { AttendeeInfo, UserProfile } from "../events/components/EventDetailModal";

import { API_BASE_URL as AUTH_API, EDEN_API_BASE_URL as EVENTS_API } from "@/lib/api";
const HOME_CACHE_KEY = "jithub.home-overview.v1";
const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

type HomeOverviewCache = {
  fetchedAt: number;
  topEvents: any[];
  trendingClubs: any[];
};

function readHomeOverviewCache(): HomeOverviewCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeOverviewCache;
    if (!parsed || !Array.isArray(parsed.topEvents) || !Array.isArray(parsed.trendingClubs) || typeof parsed.fetchedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > HOME_CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeHomeOverviewCache(payload: Omit<HomeOverviewCache, "fetchedAt">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({
      ...payload,
      fetchedAt: Date.now(),
    }));
  } catch {
    /* ignore storage issues */
  }
}

function ClubAvatar({ clubId, clubName, index }: { clubId: number; clubName: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed)
    return <img src={`/club_pics/${clubId}.jpg`} alt={clubName} onError={() => setFailed(true)} className="w-10 h-10 rounded-lg object-cover shrink-0" />;
  return <div className="text-3xl shrink-0 w-10 h-10 flex items-center justify-center">{CLUB_EMOJIS[index % CLUB_EMOJIS.length]}</div>;
}

function TrendingClubAvatar({ clubId, clubName, index }: { clubId?: number; clubName: string; index: number }) {
  const [failed, setFailed] = useState(false);

  if (clubId && !failed) {
    return (
      <img
        src={`/club_pics/${clubId}.jpg`}
        alt={clubName}
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-lg object-cover shrink-0"
      />
    );
  }

  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
      style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      aria-label={clubName}
    >
      {CLUB_EMOJIS[index % CLUB_EMOJIS.length]}
    </div>
  );
}

// change_pct: positive = up, negative = down, null = not yet available
function ClubChangePct({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs" style={{ color: "var(--text-subtle)" }}>—</span>;
  const color = pct >= 0 ? "var(--status-success)" : "var(--status-error)";
  const sign = pct >= 0 ? "+" : "";
  return (
    <span style={{ color, fontSize: "11px", fontWeight: 600 }}>
      {sign}{Math.round(pct)}%
    </span>
  );
}

const FREE_FOOD_BADGE = {
  backgroundColor: "var(--accent-events-soft)",
  color: "var(--accent-events)",
};

const VIRTUAL_BADGE = {
  backgroundColor: "var(--accent-orgs-soft)",
  color: "var(--accent-orgs)",
};

export default function Home() {
  const { user, token } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "";
  // sortedFiltered defaults to best-match order, so [0] is genuinely the
  // strongest lead for this student, not an arbitrary first row.
  const { sortedFiltered: opportunities, counts: opportunityCounts } = useOpportunities();
  const topOpportunity = opportunities[0];
  const cachedOverview = readHomeOverviewCache();

  const profile: UserProfile = {
    major: user?.major ?? "",
    interests: user?.interests ?? [],
    clubs: user?.clubs ?? [],
    skills: user?.skills ?? [],
    looking_for: user?.looking_for ?? [],
    year: user?.year ?? null,
  };

  const [topEvents, setTopEvents] = useState<any[]>(cachedOverview?.topEvents ?? []);
  const [trendingClubs, setTrendingClubs] = useState<any[]>(cachedOverview?.trendingClubs ?? []);
  const [topEventsLoading, setTopEventsLoading] = useState(!cachedOverview?.topEvents?.length);
  const [trendingClubsLoading, setTrendingClubsLoading] = useState(!cachedOverview?.trendingClubs?.length);
  const [topEventsError, setTopEventsError] = useState<string | null>(null);
  const [trendingClubsError, setTrendingClubsError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [modalAttendees, setModalAttendees] = useState<AttendeeInfo | null>(null);
  const [attendeeMap, setAttendeeMap] = useState<Record<number, AttendeeInfo>>({});
  const [connectionIds, setConnectionIds] = useState<Set<string>>(new Set());
  const [rsvpMap, setRsvpMap] = useState<Record<number, string | null>>({});
  const selectedEventId = selectedEvent?.event_id ?? null;
  const selectedEventAttendees = selectedEventId ? attendeeMap[selectedEventId] : null;
  const topEventIds = topEvents.map((event: any) => event.event_id);
  const topEventIdsKey = topEventIds.join(",");

  const moduleCards = [
    {
      icon: Calendar,
      label: "Events",
      path: "/events",
      accent: "var(--brand-primary)",
      accentSoft: "rgba(215, 25, 32, 0.12)",
      description: "See the next events worth showing up for.",
      metric: topEvents.length > 0 ? `${topEvents.length} upcoming right now` : "Live event feed",
    },
    {
      icon: Briefcase,
      label: "Opportunities",
      path: "/opportunities",
      accent: "var(--accent-opportunities)",
      accentSoft: "rgba(49, 197, 143, 0.12)",
      description: "Track internships, scholarships, and roles to act on.",
      metric: `${opportunityCounts.all} active leads surfaced`,
    },
    {
      icon: Network,
      label: "Campus Network",
      path: "/network",
      accent: "var(--accent-networking)",
      accentSoft: "rgba(122, 132, 240, 0.12)",
      description: "Explore how classmates, clubs, and companies connect.",
      metric: connectionIds.size > 0 ? `${connectionIds.size} connections in your circle` : "Open your campus graph",
    },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadHomeOverview() {
      setTopEventsError(null);
      setTrendingClubsError(null);
      setTopEventsLoading(topEvents.length === 0);
      setTrendingClubsLoading(trendingClubs.length === 0);

      const [eventsResult, clubsResult] = await Promise.allSettled([
        fetch(`${EVENTS_API}/events/upcoming?limit=3`).then(async (response) => {
          if (!response.ok) throw new Error("Could not load upcoming events");
          const body = await response.json();
          return body.events ?? body;
        }),
        fetch(`${EVENTS_API}/events/clubs/trending?limit=5`).then(async (response) => {
          if (!response.ok) throw new Error("Could not load trending clubs");
          return await response.json();
        }),
      ]);

      if (cancelled) return;

      let nextTopEvents = topEvents;
      let nextTrendingClubs = trendingClubs;

      if (eventsResult.status === "fulfilled") {
        nextTopEvents = eventsResult.value;
        setTopEvents(eventsResult.value);
      } else {
        setTopEventsError("Could not load upcoming events right now.");
      }
      setTopEventsLoading(false);

      if (clubsResult.status === "fulfilled") {
        nextTrendingClubs = clubsResult.value;
        setTrendingClubs(clubsResult.value);
      } else {
        setTrendingClubsError("Could not load trending clubs right now.");
      }
      setTrendingClubsLoading(false);

      if (eventsResult.status === "fulfilled" || clubsResult.status === "fulfilled") {
        writeHomeOverviewCache({
          topEvents: nextTopEvents,
          trendingClubs: nextTrendingClubs,
        });
      }
    }

    loadHomeOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;

    let cancelled = false;

    fetch(`${EVENTS_API}/events/${selectedEventId}`)
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

    let active = true;

    fetch(`${EVENTS_API}/rsvp/${selectedEventId}/attendees`)
      .then(r => r.json())
      .then((data: AttendeeInfo) => {
        if (!active) return;
        setAttendeeMap((prev) => ({ ...prev, [selectedEventId]: data }));
        setModalAttendees(data);
      })
      .catch(() => {});

    return () => { active = false; };
  }, [selectedEventAttendees, selectedEventId]);

  useEffect(() => {
    if (!user?.id || !token) return;
    // BUG FIX: this effect referenced `cancelled` without ever declaring it —
    // a ReferenceError crash whenever the fetch resolved. The cancellation
    // pattern was copied from the neighboring effects but the declaration and
    // cleanup were dropped. Restored both so a response arriving after the
    // user/token changes (or the page unmounts) can't write stale state.
    let cancelled = false;
    fetch(`${AUTH_API}/api/connections`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: { id: string }[]) => {
        if (cancelled) return;
        setConnectionIds(new Set(data.map((connection) => connection.id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, token]);

  // Batch-fetch RSVP status for visible events
  useEffect(() => {
    if (!topEventIds.length || !user?.id) return;

    let cancelled = false;

    fetch(`${EVENTS_API}/rsvp/batch-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, event_ids: topEventIds }),
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
  }, [topEventIds, topEventIdsKey, user?.id]);

  async function handleRsvpToggle(eventId: number) {
    if (!user) return;
    const current = rsvpMap[eventId] ?? null;
    const newStatus = current === "going" ? null : "going";
    setRsvpMap(prev => ({ ...prev, [eventId]: newStatus }));
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
            user_interests: JSON.stringify(user.interests ?? []),
            user_clubs: JSON.stringify(user.clubs ?? []),
            status: "going",
          }),
        });
      }
    } catch {
      setRsvpMap(prev => ({ ...prev, [eventId]: current }));
    }

    fetch(`${EVENTS_API}/rsvp/${eventId}/attendees`)
      .then(r => r.json())
      .then((data: AttendeeInfo) => {
        setAttendeeMap(prev => ({ ...prev, [eventId]: data }));
        if (selectedEvent?.event_id === eventId) setModalAttendees(data);
      })
      .catch(() => {});
  }

  return (
    <>
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="home-welcome-heading text-3xl font-semibold mb-2">
          <span className="home-welcome-prefix">Welcome back, </span>
          <span className="home-welcome-name">{firstName}</span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>Here's what's happening at NJIT today</p>
      </div>

      {/* Quick Module Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {moduleCards.map((module, index) => (
          <motion.div
            key={module.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ y: -5 }}
            className="h-full"
          >
            <Link to={module.path}>
              <div
                className="group relative h-full overflow-hidden rounded-xl p-6 transition-all"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  minHeight: 172,
                }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-px opacity-80"
                  style={{ backgroundColor: module.accent }}
                />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{
                        backgroundColor: module.accentSoft,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <module.icon className="w-5 h-5 transition-colors" style={{ color: "var(--text-secondary)" }} />
                    </div>
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
                      Open
                    </span>
                  </div>

                  <div className="mb-3">
                    <h3 className="text-xl font-semibold text-white mb-2">{module.label}</h3>
                    <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                      {module.description}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center gap-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: module.accent }} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {module.metric}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Upcoming Events */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Upcoming Events</h2>
          <Link to="/events" className="text-sm transition-colors" style={{ color: "var(--brand-primary)" }}>
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topEventsLoading && topEvents.length === 0 && Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`event-skeleton-${index}`}
              className="rounded-xl p-5 animate-pulse"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="w-10 h-10 rounded-lg mb-3" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
              <div className="h-4 rounded mb-2" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
              <div className="h-3 rounded mb-4 w-2/3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-20 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                <div className="h-6 w-16 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
              </div>
              <div className="h-3 rounded w-1/2" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
            </div>
          ))}
          {!topEventsLoading && topEvents.length === 0 && (
            <div
              className="md:col-span-3 rounded-xl p-5"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}
            >
              {topEventsError ?? "No upcoming events right now."}
            </div>
          )}
          {topEvents.map((event, index) => (
            <motion.div
              key={event.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.04 }}
              whileHover={{ y: -4 }}
              onClick={() => setSelectedEvent(event)}
              className="rounded-xl p-5 transition-all cursor-pointer"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <ClubAvatar clubId={event.club_id} clubName={event.club_name} index={index} />
              </div>
              <h3 className="font-medium text-white mb-1">{event.event_name}</h3>
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{event.club_name}</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {event.event_category && (
                  <span
                    className="text-xs px-2 py-1 rounded-md capitalize"
                    style={{
                      backgroundColor: (CATEGORY_STYLE[event.event_category] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }).bg,
                      color: (CATEGORY_STYLE[event.event_category] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }).color,
                    }}
                  >
                    {event.event_category}
                  </span>
                )}
                {event.has_free_food && (
                  <span className="text-xs px-2 py-1 rounded-md" style={FREE_FOOD_BADGE}>Free Food</span>
                )}
                {event.virtual && (
                  <span className="text-xs px-2 py-1 rounded-md" style={VIRTUAL_BADGE}>Virtual</span>
                )}
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {event.date ? format(new Date(event.date + "T00:00:00"), "EEE, MMM d") : "Date TBD"}
                {event.start_time ? ` at ${fmt12(event.start_time.slice(0, 5))}` : ""}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Opportunity Spotlight */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-white">Opportunity Spotlight</h2>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--brand-primary)" }} />
          </div>
          {/* Guard: the hook seeds fallback data synchronously so this is
              practically always present, but a guard costs one line and makes
              the card safe against an empty feed forever. */}
          {topOpportunity && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl p-6"
              style={{ background: "var(--surface-gradient)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-2xl">
                    {OPPORTUNITY_TYPE_ICON[topOpportunity.type]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{topOpportunity.title}</h3>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>{topOpportunity.org}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-3 py-1.5 rounded-md" style={{ backgroundColor: "var(--accent-opportunities-soft)", color: "var(--accent-opportunities)" }}>
                  {topOpportunity.type}
                </span>
                {/* Canonical Opportunity.deadline is an ISO string (it travels over
                    JSON); DeadlineChip wants a Date, so parse at the boundary. */}
                {topOpportunity.deadline && <DeadlineChip deadline={new Date(topOpportunity.deadline)} />}
                <span className="text-xs px-3 py-1.5 rounded-md bg-white/5" style={{ color: "var(--text-muted)" }}>
                  {topOpportunity.city}, {topOpportunity.state}
                </span>
              </div>
              {/* Internships carry `stipend`, scholarships carry `amount`; networking events have neither. */}
              {(topOpportunity.stipend ?? topOpportunity.amount) && (
                <p className="text-sm text-white mb-4 font-medium">{topOpportunity.stipend ?? topOpportunity.amount}</p>
              )}
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 text-white rounded-lg font-medium transition-all" style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}>
                  Apply Now
                </button>
                <Link to="/opportunities" className="px-4 py-2 bg-white/5 text-white rounded-lg font-medium hover:bg-white/10 transition-colors">
                  View More
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        {/* Trending Clubs */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
            <h2 className="text-xl font-semibold text-white">Trending Clubs</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <div className="space-y-3">
              {trendingClubsLoading && trendingClubs.length === 0 && Array.from({ length: 5 }).map((_, index) => (
                <div key={`club-skeleton-${index}`} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="h-3 rounded mb-2 w-2/3" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                    <div className="h-2.5 rounded w-1/3" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                  </div>
                  <div className="h-3 w-8 rounded" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
                </div>
              ))}
              {!trendingClubsLoading && trendingClubs.length === 0 && (
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {trendingClubsError ?? "No trending clubs right now."}
                </div>
              )}
              {trendingClubs.map((club, index) => (
                <div key={club.club_name} className="flex items-center gap-3 group cursor-pointer">
                  <TrendingClubAvatar clubId={club.club_id} clubName={club.club_name} index={index} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate transition-colors group-hover:opacity-90">
                      {club.club_name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{club.event_count} events this semester</p>
                  </div>
                  <ClubChangePct pct={club.change_pct ?? null} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>

    {selectedEvent && (
      <EventDetailModal
        event={selectedEvent}
        attendees={modalAttendees}
        connectionIds={connectionIds}
        rsvpStatus={rsvpMap[selectedEvent.event_id] ?? null}
        onRsvpToggle={user ? handleRsvpToggle : undefined}
        profile={profile}
        onClose={() => setSelectedEvent(null)}
      />
    )}
    </>
  );
}
