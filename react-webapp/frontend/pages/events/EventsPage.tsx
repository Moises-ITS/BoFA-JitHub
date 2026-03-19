import { Calendar } from "lucide-react";

export default function EventsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          <span className="bg-gradient-to-r from-[#C0392B] to-[#E74C3C] bg-clip-text text-transparent">EDEN</span>
        </h1>
        <p className="text-[#9CA3AF]">Event Discovery & Engagement Network</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Calendar className="w-16 h-16 text-[#C0392B]/40 mb-4" />
        <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
        <p className="text-[#9CA3AF]">The full event discovery experience is on its way.</p>
      </div>
    </div>
  );
}
