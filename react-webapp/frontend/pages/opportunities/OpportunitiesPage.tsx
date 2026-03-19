import { Briefcase } from "lucide-react";

export default function OpportunitiesPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          <span className="bg-gradient-to-r from-[#E67E22] to-[#F39C12] bg-clip-text text-transparent">Opportunities</span>
        </h1>
        <p className="text-[#9CA3AF]">Internships, co-ops, and full-time roles matched to you</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Briefcase className="w-16 h-16 text-[#E67E22]/40 mb-4" />
        <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
        <p className="text-[#9CA3AF]">Smart opportunity matching is on its way.</p>
      </div>
    </div>
  );
}
