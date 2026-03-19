import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ExternalLink, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";
import { HeatmapCalendar } from "./components/heatmap-calendar";

const API = import.meta.env.VITE_EDEN_API_URL ?? "http://localhost:8000";
const CLUB_EMOJIS = ["🎯", "💡", "🚀", "🎓", "⚡", "🌟", "🔥", "🎨", "🏆", "💻", "🎪", "🌈"];

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
];

// Major → bonus points per category (on top of interest match)
const MAJOR_AFFINITIES: Record<string, Record<string, number>> = {
  "Computer Science":        { workshop: 20, recruiting: 18, conference: 14, "info session": 12 },
  "Information Technology":  { workshop: 20, recruiting: 18, "info session": 14 },
  "Electrical Engineering":  { workshop: 20, recruiting: 18, "site tour": 14 },
  "Mechanical Engineering":  { workshop: 18, recruiting: 16, "site tour": 18 },
  "Civil Engineering":       { "site tour": 20, volunteering: 14, workshop: 12 },
  "Chemical Engineering":    { workshop: 18, recruiting: 16, "info session": 14 },
  "Biomedical Engineering":  { workshop: 16, recruiting: 14, volunteering: 16 },
  "Business":                { recruiting: 22, exposure: 18, conference: 16, "info session": 14 },
  "Architecture":            { "site tour": 22, exposure: 18, workshop: 12 },
  "Biology":                 { volunteering: 20, "info session": 18, workshop: 12 },
  "Applied Mathematics":     { workshop: 20, conference: 16, "study support": 18 },
  "Physics":                 { workshop: 20, conference: 16, "info session": 14 },
  "Humanities / Liberal Arts": { social: 18, exposure: 16, volunteering: 14 },
};

// ─── Profile / match types ────────────────────────────────────────────────────
interface UserProfile { major: string; interests: string[] }

// Empty profile until DB branch is merged — match scoring wired up but inactive
const EMPTY_PROFILE: UserProfile = { major: "", interests: [] };

// ─── Match scoring ─────────────────────────────────────────────────────────
function matchScore(event: any, profile: UserProfile): number {
  if (!profile.major && profile.interests.length === 0) return -1;
  let score = 0;
  if (event.event_category && profile.interests.includes(event.event_category)) score += 60;
  const affinities = MAJOR_AFFINITIES[profile.major] ?? {};
  score += affinities[event.event_category] ?? 0;
  if (event.engagement_score) score += Math.min(10, event.engagement_score * 2);
  if (event.has_free_food) score += 5;
  return Math.min(100, Math.round(score));
}

function MatchBadge({ score }: { score: number }) {
  if (score < 0) return null;
  const color = score >= 70
    ? "bg-[#27AE60]/20 text-[#2ECC71]"
    : score >= 40
    ? "bg-[#E67E22]/20 text-[#F39C12]"
    : "bg-white/5 text-[#9CA3AF]";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${color}`}>
      {score}% match
    </span>
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

function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function ClubAvatar({ clubId, clubName, index }: { clubId: number; clubName: string; index: number }) {
  const [failed, setFailed] = useState(false);
  if (!failed)
    return <img src={`/club_pics/${clubId}.jpg`} alt={clubName} onError={() => setFailed(true)} className="w-10 h-10 rounded-lg object-cover shrink-0" />;
  return <div className="text-3xl shrink-0 w-10 h-10 flex items-center justify-center">{CLUB_EMOJIS[index % CLUB_EMOJIS.length]}</div>;
}

function EventCard({ event, index }: { event: any; index: number }) {
  const score = matchScore(event, EMPTY_PROFILE);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ x: 4 }}
      onClick={() => event.post_url && window.open(event.post_url, "_blank")}
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
            {event.post_url && <ExternalLink className="w-4 h-4 text-[#9CA3AF] hover:text-white shrink-0 mt-1" />}
          </div>
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-white">
              {event.date ? format(new Date(event.date + "T00:00:00"), "EEE, MMM d") : "Date TBD"}
              {event.start_time ? ` at ${fmt12(event.start_time.slice(0, 5))}` : ""}
            </span>
            <div className="flex gap-2 items-center">
              <MatchBadge score={score} />
              {event.has_free_food && <span className="text-xs px-2 py-0.5 rounded-md bg-[#E67E22]/20 text-[#F39C12]">Free Food</span>}
              {event.virtual && <span className="text-xs px-2 py-0.5 rounded-md bg-[#9B59B6]/20 text-[#BB8FCE]">Virtual</span>}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const upcomingUrl = activeFilter
    ? `/events/upcoming?limit=50&category=${encodeURIComponent(activeFilter)}`
    : "/events/upcoming?limit=50";

  const { data: upcoming, loading } = useEvents(upcomingUrl);
  const { data: trending } = useEvents("/events/clubs/trending?limit=5");
  const { data: topRisers } = useEvents("/events/clubs/top-risers?limit=5");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">
          <span className="bg-gradient-to-r from-[#C0392B] to-[#E67E22] bg-clip-text text-transparent">EDEN</span> — Events
        </h1>
        <p className="text-[#9CA3AF]">Discover what's happening across 204 NJIT orgs ✨</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Upcoming Events</h2>
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFilter(null)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                activeFilter === null
                  ? "bg-[#C0392B] border-[#C0392B] text-white"
                  : "bg-white/5 border-white/10 text-[#9CA3AF] hover:border-white/30 hover:text-white"
              }`}
            >
              All
            </button>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(activeFilter === f.value ? null : f.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  activeFilter === f.value
                    ? "bg-[#C0392B] border-[#C0392B] text-white"
                    : "bg-white/5 border-white/10 text-[#9CA3AF] hover:border-white/30 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading && <p className="text-[#9CA3AF] text-sm">Loading...</p>}
          {!loading && upcoming.length === 0 && (
            <div className="text-center py-16 text-[#9CA3AF]">
              <p className="text-4xl mb-3">📅</p>
              <p className="font-medium text-white">No upcoming events found</p>
              <p className="text-sm mt-1">{activeFilter ? "Try a different category." : "Check back soon — clubs post new events weekly."}</p>
            </div>
          )}
          {upcoming.map((event, i) => (
            <EventCard key={event.event_id} event={event} index={i} />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <HeatmapCalendar />
          <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#C0392B]" />
              <h3 className="font-semibold text-white text-sm">Trending This Semester</h3>
            </div>
            {trending.map((c, i) => <SidebarClubRow key={c.club_name} club={c} index={i} />)}
          </div>
          <div className="bg-[#1A1A1A] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#E67E22]" />
              <h3 className="font-semibold text-white text-sm">Top Risers This Semester</h3>
            </div>
            {topRisers.map((c, i) => <SidebarClubRow key={c.club_name} club={c} index={i} showScore />)}
          </div>
        </div>
      </div>
    </div>
  );
}
