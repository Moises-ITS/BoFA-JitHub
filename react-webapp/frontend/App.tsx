import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { Layout } from "./pages/home/layout"
import LoginPage from "./pages/auth/LoginPage"
import SignupPage from "./pages/auth/SignupPage"
import Home from "./pages/home/Home"
import Profile from "./pages/profile/profile"
import EventsPage from "./pages/events/EventsPage"
import OpportunitiesPage from "./pages/opportunities/OpportunitiesPage"
import ResearchPage from "./pages/research/ResearchPage"
import LandingPage from "./pages/landing/LandingPage"
import ProtectedRoute from "./components/ProtectedRoute"

// Lazy-load heavy pages — keeps initial bundle small
const CampusGraph = lazy(() => import("./pages/node/CampusGraph"))
const SandboxPage = lazy(() => import("./pages/sandbox/SandboxPage"))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public landing + auth pages */}
          <Route path="/"       element={<LandingPage />} />
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            {/* CampusGraph is self-contained with its own navbar — no shared shell */}
            <Route path="/network" element={
              <ErrorBoundary>
                <Suspense fallback={
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f1117", color:"#718096" }}>
                    Loading graph…
                  </div>
                }>
                  <CampusGraph />
                </Suspense>
              </ErrorBoundary>
            } />

            {/* App shell — Layout provides Sidebar + Topbar */}
            <Route element={<Layout />}>
              <Route path="/home"          element={<Home />} />
              <Route path="/profile"       element={<Profile />} />
              <Route path="/events"         element={<EventsPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/research"      element={<ResearchPage />} />
              <Route path="/sandbox"       element={
                <Suspense fallback={<div style={{ color: "#6B7280", padding: "40px" }}>Loading…</div>}>
                  <SandboxPage />
                </Suspense>
              } />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
