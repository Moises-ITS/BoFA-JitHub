import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Target, Award, Edit2, Calendar, Briefcase, Users } from "lucide-react";
import { mockOpportunities } from "../home/mock-data";
import { useAuth } from "../../context/AuthContext";
import EditProfileModal from "../node/components/EditProfileModal";

const EVENTS_API = import.meta.env.VITE_EVENTS_API_URL ?? "http://localhost:8000";

type ProfileEvent = {
  event_id: number;
  event_name: string;
  club_name: string;
  date: string | null;
  start_time: string | null;
  event_category?: string | null;
  virtual?: boolean;
  has_free_food?: boolean;
  status: string;
  rsvp_time: string | null;
};

function formatEventDate(date: string | null, startTime: string | null) {
  if (!date) return "Date TBD";

  const eventDate = new Date(`${date}T00:00:00`);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(eventDate);

  if (!startTime) return dateLabel;

  const [hoursRaw = "0", minutesRaw = "0"] = startTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const normalizedHour = ((hours + 11) % 12) + 1;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const timeLabel = `${normalizedHour}:${minutes.toString().padStart(2, "0")} ${meridiem}`;

  return `${dateLabel} at ${timeLabel}`;
}

export default function Profile() {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const savedEvents = mockEvents.slice(0, 3);
  const [yourEvents, setYourEvents] = useState<ProfileEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const savedOpportunities = mockOpportunities.slice(0, 2);

  const name = user?.name ?? "";
  const ucid = user?.email?.split("@")[0] ?? "";
  const initials = name.split(" ").map(n => n[0]).filter(Boolean).join("") || "?";
  const major = user?.major ?? "";
  const graduationYear = user?.graduationYear ? `Class of ${user.graduationYear}` : "";
  const gpa = user?.gpa != null ? Number(user.gpa) : null;
  const bio = user?.bio ?? "";
  const clubs = user?.clubs ?? [];
  const companies = user?.companies ?? [];
  const interests = user?.interests ?? [];
  const linkedinUrl = user?.linkedinUrl ?? null;

  useEffect(() => {
    if (!user?.id) {
      setYourEvents([]);
      return;
    }

    setEventsLoading(true);
    fetch(`${EVENTS_API}/rsvp/user/${encodeURIComponent(user.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Failed to load events"))))
      .then((data: ProfileEvent[]) => setYourEvents(Array.isArray(data) ? data : []))
      .catch(() => setYourEvents([]))
      .finally(() => setEventsLoading(false));
  }, [user?.id]);

  const sortedEvents = useMemo(() => {
    const now = new Date();

    return [...yourEvents].sort((left, right) => {
      const leftDate = left.date ? new Date(`${left.date}T${left.start_time ?? "00:00:00"}`) : null;
      const rightDate = right.date ? new Date(`${right.date}T${right.start_time ?? "00:00:00"}`) : null;
      const leftUpcoming = leftDate ? leftDate >= now : false;
      const rightUpcoming = rightDate ? rightDate >= now : false;

      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
      if (!leftDate && !rightDate) return 0;
      if (!leftDate) return 1;
      if (!rightDate) return -1;

      return leftUpcoming
        ? leftDate.getTime() - rightDate.getTime()
        : rightDate.getTime() - leftDate.getTime();
    });
  }, [yourEvents]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--brand-gradient)" }}>Profile</span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>Manage your student profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-6"
            style={{ background: "var(--surface-gradient)", border: "1px solid var(--border-default)" }}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg" style={{ background: "var(--brand-gradient)", boxShadow: "var(--shadow-brand)" }}>
                  {initials}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-1">{name}</h2>
                  {ucid && <p className="text-sm" style={{ color: "var(--text-muted)" }}>UCID: {ucid}</p>}
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {[major, graduationYear].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setEditOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Edit profile"
              >
                <Edit2 className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              </motion.button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>GPA</p>
                <p className="text-2xl font-semibold text-white">
                  {gpa != null && !isNaN(gpa) ? gpa.toFixed(1) : "—"}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Active Clubs</p>
                <p className="text-2xl font-semibold text-white">{clubs.length}</p>
              </div>
            </div>

            <div className="space-y-4">
              {bio && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
                    <h3 className="font-semibold text-white">About</h3>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{bio}</p>
                </div>
              )}

              {linkedinUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-4 h-4" style={{ color: "var(--accent-networking)" }} />
                    <h3 className="font-semibold text-white">LinkedIn</h3>
                  </div>
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                    style={{ color: "var(--accent-networking)" }}
                  >
                    {linkedinUrl}
                  </a>
                </div>
              )}
            </div>
          </motion.div>

          {clubs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
                <h3 className="font-semibold text-white">Clubs & Organizations</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {clubs.map((club, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--brand-primary-soft)", color: "var(--brand-primary)", border: "1px solid var(--brand-primary-soft-strong)" }}
                  >
                    {club}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}

          {companies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5" style={{ color: "var(--accent-events)" }} />
                <h3 className="font-semibold text-white">Companies & Internships</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {companies.map((company, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    className="px-3 py-2 bg-white/5 text-white rounded-lg text-sm"
                  >
                    {company}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}

          {interests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl p-6"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5" style={{ color: "var(--accent-research)" }} />
                <h3 className="font-semibold text-white">Interests</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {interests.map((interest, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + idx * 0.05 }}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--accent-research-soft)", color: "var(--accent-research)" }}
                  >
                    {interest}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              <h3 className="font-semibold text-white">Your Events</h3>
            </div>
            {eventsLoading ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading your RSVP'd events...</p>
            ) : sortedEvents.length === 0 ? (
              <div className="rounded-lg border border-white/6 bg-white/3 p-4">
                <p className="text-sm text-white">No RSVP'd events yet.</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  RSVP to events from the Events page and they&apos;ll show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {sortedEvents.map((event) => (
                  <div key={event.event_id} className="p-3 bg-white/5 rounded-lg transition-colors">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-lg leading-none">{event.virtual ? "💻" : "📅"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{event.event_name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{event.club_name}</p>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatEventDate(event.date, event.start_time)}
                    </p>
                    {(event.event_category || event.has_free_food || event.virtual) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {event.event_category && (
                          <span
                            className="text-[11px] px-2 py-1 rounded-md capitalize"
                            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
                          >
                            {event.event_category}
                          </span>
                        )}
                        {event.has_free_food && (
                          <span
                            className="text-[11px] px-2 py-1 rounded-md"
                            style={{ backgroundColor: "var(--accent-events-soft)", color: "var(--accent-events)" }}
                          >
                            Free Food
                          </span>
                        )}
                        {event.virtual && (
                          <span
                            className="text-[11px] px-2 py-1 rounded-md"
                            style={{ backgroundColor: "var(--accent-orgs-soft)", color: "var(--accent-orgs)" }}
                          >
                            Virtual
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl p-5"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5" style={{ color: "var(--accent-events)" }} />
              <h3 className="font-semibold text-white">Saved Opportunities</h3>
            </div>
            <div className="space-y-3">
              {savedOpportunities.map((opp) => (
                <div key={opp.id} className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{opp.logo}</span>
                    <p className="text-sm font-medium text-white truncate flex-1">{opp.role}</p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{opp.company}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl p-5"
            style={{ background: "var(--surface-gradient)", border: "1px solid var(--brand-primary-soft-strong)" }}
          >
            <h3 className="font-semibold text-white mb-3">Profile Strength</h3>
            <div className="relative">
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1, delay: 0.7 }}
                  className="h-full relative"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </motion.div>
              </div>
              <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>100% Complete</p>
            </div>
          </motion.div>
        </div>
      </div>
      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
