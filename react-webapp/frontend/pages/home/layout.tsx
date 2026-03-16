import { Outlet } from "react-router";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <Sidebar />
      <Topbar />
      {/* inline styles are immune to global CSS resets (e.g. CampusGraph.css * { margin:0 }) */}
      <main style={{ marginLeft: 80, paddingTop: 64, minHeight: "100vh" }}>
        <div style={{ padding: 24 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
