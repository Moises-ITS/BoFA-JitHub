import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { Layout } from "./pages/home/layout"
import ProtectedRoute from "./components/ProtectedRoute"
import LoginPage from "./pages/auth/LoginPage"
import SignupPage from "./pages/auth/SignupPage"
import Home from "./pages/home/Home"
import Profile from "./pages/profile/profile"
import EventsPage from "./pages/events/EventsPage"
import OpportunitiesPage from "./pages/opportunities/OpportunitiesPage"
import ResearchPage from "./pages/research/ResearchPage"

// Lazy-load the heavy D3 graph page — keeps initial bundle small
const CampusGraph = lazy(() => import("./pages/node/CampusGraph"))
const LandingPage = lazy(() => import("./pages/landing/LandingPage"))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={
            <Suspense fallback={null}>
              <LandingPage />
            </Suspense>
          } />
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
              <Route path="/eden"          element={<EventsPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/research"      element={<ResearchPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
