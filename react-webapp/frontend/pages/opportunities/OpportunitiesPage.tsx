import { Briefcase } from "lucide-react";

export default function OpportunitiesPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, var(--accent-opportunities), var(--accent-events))" }}
          >
            Opportunities
          </span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>Internships, co-ops, and full-time roles matched to you</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Briefcase className="w-16 h-16 mb-4" style={{ color: "color-mix(in srgb, var(--accent-opportunities) 42%, transparent)" }} />
        <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
        <p style={{ color: "var(--text-muted)" }}>Smart opportunity matching is on its way.</p>
      </div>
    </div>
  );
}
