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
import ResearchPage from "./pages/research/ResearchPage"
import LandingPage from "./pages/landing/LandingPage"
import ProtectedRoute from "./components/ProtectedRoute"

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY")

// Lazy-load the heavy D3 graph page — keeps initial bundle small
const CampusGraph = lazy(() => import("./pages/node/CampusGraph"))

export default function App() {
  return (
    <BrowserRouter>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <AuthProvider>
            <Routes>
              {/* Public landing + auth pages */}
              <Route path="/"         element={<LandingPage />} />
              <Route path="/login/*"  element={<LoginPage />} />
              <Route path="/signup/*" element={<SignupPage />} />
              <Route path="/setup"    element={<ProfileSetupPage />} />

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
        </AuthProvider>
      </ClerkProvider>
    </BrowserRouter>
  )
}
