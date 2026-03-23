import { motion } from "motion/react";
import { Target, Award, Edit2, Calendar, Briefcase, Users, Star } from "lucide-react";
import { mockEvents, mockOpportunities } from "../home/mock-data";
import { useAuth } from "../../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  const savedEvents = mockEvents.slice(0, 3);
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
  const dreamCompany = companies[0] ?? "";
  const linkedinUrl = user?.linkedinUrl ?? null;

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
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
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

              {dreamCompany && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4" style={{ color: "var(--accent-events)" }} />
                    <h3 className="font-semibold text-white">Dream Company</h3>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                    <span className="text-xl">🔴</span>
                    <span className="text-sm text-white">{dreamCompany}</span>
                  </div>
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
              <h3 className="font-semibold text-white">Saved Events</h3>
            </div>
            <div className="space-y-3">
              {savedEvents.map((event) => (
                <div key={event.id} className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{event.clubLogo}</span>
                    <p className="text-sm font-medium text-white truncate flex-1">{event.title}</p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{event.club}</p>
                </div>
              ))}
            </div>
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
    </div>
  );
}
