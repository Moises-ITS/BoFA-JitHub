import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ClerkProvider } from "@clerk/clerk-react"
import { AuthProvider } from "./context/AuthContext"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { Layout } from "./pages/home/layout"
import LoginPage from "./pages/auth/LoginPage"
import SignupPage from "./pages/auth/SignupPage"
import ProfileSetupPage from "./pages/auth/ProfileSetupPage"
import Home from "./pages/home/Home"
import Profile from "./pages/profile/profile"
import EventsPage from "./pages/events/EventsPage"
import OpportunitiesPage from "./pages/opportunities/OpportunitiesPage"
import LandingPage from "./pages/landing/LandingPage"
import ProtectedRoute from "./components/ProtectedRoute"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Lazy-load heavy pages to keep the initial bundle small.
const CampusGraph = lazy(() => import("./pages/node/CampusGraph"))
const SandboxPage = lazy(() => import("./pages/sandbox/SandboxPage"))
const DigitalTwin = lazy(() => import("./pages/map/DigitalTwin"))
const CampusView = lazy(() => import("./pages/campus/CampusView"))
const GlbInspector = lazy(() => import("./pages/campus/GlbInspector"))
const ResearchDistricts = lazy(() => import("./pages/districts/ResearchDistricts"))

function MissingClerkConfigScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        background:
          "radial-gradient(circle at top left, rgba(215, 25, 32, 0.18), transparent 34%), linear-gradient(180deg, #090B10 0%, #111624 100%)",
        color: "#F3F6FB",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "min(680px, 100%)",
          padding: "32px",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(17, 22, 36, 0.92)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 14px",
            borderRadius: "999px",
            border: "1px solid rgba(215, 25, 32, 0.35)",
            background: "rgba(215, 25, 32, 0.12)",
            color: "#FFD6D8",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Local Setup Required
        </div>

        <h1
          style={{
            margin: "20px 0 12px",
            fontSize: "40px",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
          }}
        >
          Missing Clerk publishable key
        </h1>

        <p style={{ margin: 0, color: "#B8C3D3", fontSize: "16px", lineHeight: 1.7 }}>
          The frontend is running, but Clerk is not configured for local development yet.
          Add the missing variable below, then restart <code>npm run dev</code>.
        </p>

        <div
          style={{
            marginTop: "22px",
            padding: "18px 20px",
            borderRadius: "18px",
            background: "rgba(9, 11, 16, 0.82)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflowX: "auto",
          }}
        >
          <div style={{ color: "#8993A5", fontSize: "13px", marginBottom: "10px" }}>
            Create <code>react-webapp/frontend/.env.local</code>
          </div>
          <pre
            style={{
              margin: 0,
              color: "#F3F6FB",
              fontSize: "14px",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
{`VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`}
          </pre>
        </div>

        <p style={{ margin: "18px 0 0", color: "#8993A5", fontSize: "14px", lineHeight: 1.6 }}>
          The full setup notes are already documented in <code>react-webapp/README.md</code>.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!PUBLISHABLE_KEY) {
    return <MissingClerkConfigScreen />
  }

  return (
    <BrowserRouter>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/signup/*" element={<SignupPage />} />
            <Route path="/setup" element={<ProfileSetupPage />} />

            <Route element={<ProtectedRoute />}>
              {/* Full-screen routes — no Layout shell */}
              <Route path="/map" element={
                <ErrorBoundary>
                  <Suspense fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f1117", color:"#718096" }}>Loading Digital Twin…</div>}>
                    <DigitalTwin />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="/campus" element={
                <ErrorBoundary>
                  <Suspense fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f1117", color:"#718096" }}>Loading Campus…</div>}>
                    <CampusView />
                  </Suspense>
                </ErrorBoundary>
              } />
              <Route path="/inspect" element={
                <ErrorBoundary>
                  <Suspense fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f1117", color:"#718096" }}>Loading Inspector…</div>}>
                    <GlbInspector />
                  </Suspense>
                </ErrorBoundary>
              } />

              <Route element={<Layout />}>
                <Route path="/home" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/opportunities" element={<OpportunitiesPage />} />
                <Route path="/research" element={
                  <ErrorBoundary>
                    <Suspense fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"calc(100vh - 64px)", background:"#0a0b10", color:"#718096", margin: "-24px" }}>Loading Research Districts…</div>}>
                      <ResearchDistricts />
                    </Suspense>
                  </ErrorBoundary>
                } />
                <Route
                  path="/network"
                  element={
                    <ErrorBoundary>
                      <Suspense
                        fallback={
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: "calc(100vh - 112px)",
                              background: "var(--bg-canvas)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border-default)",
                              borderRadius: 24,
                            }}
                          >
                            Loading graph...
                          </div>
                        }
                      >
                        <CampusGraph />
                      </Suspense>
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/sandbox"
                  element={
                    <Suspense
                      fallback={
                        <div style={{ color: "var(--text-muted)", padding: "40px" }}>
                          Loading...
                        </div>
                      }
                    >
                      <SandboxPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ClerkProvider>
    </BrowserRouter>
  )
}
