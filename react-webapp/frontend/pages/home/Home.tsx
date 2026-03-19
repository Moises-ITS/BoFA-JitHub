import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Calendar, Briefcase, Network, Microscope, TrendingUp, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { mockOpportunities, mockClubLeaderboard } from "./mock-data";
import { MatchBadge } from "./match-badge";
import { DeadlineChip } from "./deadline-chip";
import { format } from "date-fns";
import { useAuth } from "../../context/AuthContext";

const EDEN_API = import.meta.env.VITE_EDEN_API_URL ?? "http://localhost:8000";
const CLUB_EMOJIS = ["🎯", "💡", "🚀", "🎓", "⚡", "🌟", "🔥", "🎨", "🏆", "💻", "🎪", "🌈"];

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

const moduleCards = [
  { icon: Calendar, label: "EDEN", path: "/eden", color: "from-[#C0392B] to-[#E74C3C]" },
  { icon: Briefcase, label: "Opportunities", path: "/opportunities", color: "from-[#E67E22] to-[#F39C12]" },
  { icon: Network, label: "Campus Network", path: "/network", color: "from-[#3498DB] to-[#5DADE2]" },
  { icon: Microscope, label: "Research", path: "/research", color: "from-[#9B59B6] to-[#BB8FCE]" },
];

export default function Home() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "";
  const topOpportunity = mockOpportunities[0];

  const [topEvents, setTopEvents] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${EDEN_API}/events/upcoming?limit=3`)
      .then((r) => r.json())
      .then((d) => setTopEvents(d.events ?? d))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          Welcome back, <span className="bg-gradient-to-r from-[#C0392B] to-[#E67E22] bg-clip-text text-transparent">{firstName}</span>
        </h1>
        <p className="text-[#9CA3AF]">Here's what's happening at NJIT today</p>
      </div>

      {/* Quick Module Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {moduleCards.map((module, index) => (
          <motion.div
            key={module.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to={module.path}>
              <div className="group relative overflow-hidden bg-[#1A1A1A] border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all">
                <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                <module.icon className="w-8 h-8 text-[#9CA3AF] group-hover:text-white transition-colors mb-3" />
                <h3 className="font-medium text-white">{module.label}</h3>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Top Events This Week */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Top Events For You This Week</h2>
          <Link to="/eden" className="text-sm text-[#C0392B] hover:text-[#E74C3C] transition-colors">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topEvents.map((event, index) => (
            <motion.div
              key={event.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ y: -4 }}
              onClick={() => event.post_url && window.open(event.post_url, "_blank")}
              className="bg-[#1A1A1A] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <ClubAvatar clubId={event.club_id} clubName={event.club_name} index={index} />
                {event.post_url && <ExternalLink className="w-4 h-4 text-[#9CA3AF]" />}
              </div>
              <h3 className="font-medium text-white mb-1">{event.event_name}</h3>
              <p className="text-sm text-[#9CA3AF] mb-3">{event.club_name}</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {event.event_category && (
                  <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-[#9CA3AF] capitalize">
                    {event.event_category}
                  </span>
                )}
                {event.has_free_food && (
                  <span className="text-xs px-2 py-1 rounded-md bg-[#E67E22]/20 text-[#F39C12]">Free Food</span>
                )}
                {event.virtual && (
                  <span className="text-xs px-2 py-1 rounded-md bg-[#9B59B6]/20 text-[#BB8FCE]">Virtual</span>
                )}
              </div>
              <p className="text-xs text-[#9CA3AF]">
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
            <div className="w-2 h-2 rounded-full bg-[#C0392B] animate-pulse" />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-[#1A1A1A] to-[#1F1F1F] border border-white/10 rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-2xl">
                  {topOpportunity.logo}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{topOpportunity.role}</h3>
                  <p className="text-sm text-[#9CA3AF]">{topOpportunity.company}</p>
                </div>
              </div>
              <MatchBadge score={topOpportunity.matchScore} />
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs px-3 py-1.5 rounded-md bg-[#E67E22]/20 text-[#F39C12]">
                {topOpportunity.type}
              </span>
              <DeadlineChip deadline={topOpportunity.deadline} />
              <span className="text-xs px-3 py-1.5 rounded-md bg-white/5 text-[#9CA3AF]">
                {topOpportunity.location}
              </span>
            </div>
            <p className="text-sm text-white mb-4 font-medium">{topOpportunity.salary}</p>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-gradient-to-r from-[#C0392B] to-[#E74C3C] text-white rounded-lg font-medium hover:shadow-lg hover:shadow-[#C0392B]/30 transition-all">
                Apply Now
              </button>
              <Link to="/opportunities" className="px-4 py-2 bg-white/5 text-white rounded-lg font-medium hover:bg-white/10 transition-colors">
                View More
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Trending Clubs */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#C0392B]" />
            <h2 className="text-xl font-semibold text-white">Trending Clubs</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[#1A1A1A] border border-white/10 rounded-xl p-4"
          >
            <div className="space-y-3">
              {mockClubLeaderboard.slice(0, 5).map((club, index) => (
                <div key={club.rank} className="flex items-center gap-3 group cursor-pointer">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium ${
                    index === 0 ? "bg-gradient-to-br from-[#C0392B] to-[#E74C3C] text-white" :
                    index === 1 ? "bg-white/10 text-white" :
                    "bg-white/5 text-[#9CA3AF]"
                  }`}>
                    {club.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-[#C0392B] transition-colors">
                      {club.club}
                    </p>
                    <p className="text-xs text-[#9CA3AF]">{club.events} events this semester</p>
                  </div>
                  {club.trend === "up" && (
                    <div className="text-[#1ABC9C] text-xs font-medium">
                      +{club.change}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
