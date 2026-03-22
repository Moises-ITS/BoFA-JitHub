import { Microscope } from "lucide-react";

export default function ResearchPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, var(--accent-research), var(--accent-networking))" }}
          >
            Research
          </span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>Discover research opportunities and connect with professors</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Microscope className="w-16 h-16 mb-4" style={{ color: "color-mix(in srgb, var(--accent-research) 42%, transparent)" }} />
        <h2 className="text-xl font-medium text-white mb-2">Coming Soon</h2>
        <p style={{ color: "var(--text-muted)" }}>Research matching and professor connections are on the way.</p>
      </div>
    </div>
  );
}
