import { Microscope } from "lucide-react";

export default function ResearchPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          <span className="bg-gradient-to-r from-[#9B59B6] to-[#BB8FCE] bg-clip-text text-transparent">Research</span>
        </h1>
        <p className="text-[#9CA3AF]">Discover research opportunities and connect with professors</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Microscope className="w-16 h-16 text-[#9B59B6]/40 mb-4" />
        <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
        <p className="text-[#9CA3AF]">Research matching and professor connections are on the way.</p>
      </div>
    </div>
  );
}
