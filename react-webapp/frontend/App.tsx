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

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY")
}

// Lazy-load heavy pages to keep the initial bundle small.
const CampusGraph = lazy(() => import("./pages/node/CampusGraph"))
const SandboxPage = lazy(() => import("./pages/sandbox/SandboxPage"))

export default function App() {
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
                            height: "100vh",
                            background: "var(--bg-canvas)",
                            color: "var(--text-muted)",
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

              <Route element={<Layout />}>
                <Route path="/home" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/opportunities" element={<OpportunitiesPage />} />
                <Route path="/research" element={<ResearchPage />} />
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
