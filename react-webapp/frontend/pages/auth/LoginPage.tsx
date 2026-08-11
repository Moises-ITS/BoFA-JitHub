/**
 * LoginPage — step 3 of the "Jithub Auth" design, sign-in side.
 *
 * The design's step 3 is a mock email/password form. It is NOT reproduced
 * literally: students authenticate through Clerk's hosted widget, and
 * professors/guests through /api/auth/login-custom. Both render inside the
 * design's glass card over the same backdrop, so the flow from the landing
 * page's role picker into this screen reads as one continuous surface.
 */
import { useEffect, useState } from "react";
import { SignIn, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthBackdrop from "./AuthBackdrop";
import "./AuthBackdrop.css";
import "./auth.css";

export default function LoginPage() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { signOut } = useClerk();
  const { user, loading, loginCustom } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Which sign-in UI to show is decided by the ROUTE, never by `user.userType`.
  // On this page `user` is null by definition (nobody is signed in yet), so
  // branching on it sent every visitor — students included — to the custom
  // password form, and /api/auth/login-custom only accepts guests/professors.
  // startsWith, not endsWith: Clerk owns sub-paths under /login/student
  // (…/factor-one, …/sso-callback) and must keep rendering on all of them.
  const isStudent = pathname.startsWith("/login/student");
  const isProfessor = pathname.startsWith("/login/professor");
  const role = isProfessor ? "professor" : "guest";
  const roleName = isProfessor ? "Professor" : "Guest";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (user && (user.userType === "guest" || user.userType === "professor")) {
      navigate("/home", { replace: true });
      return;
    }

    if (!isLoaded || loading) return;

    // Already fully authenticated student → go straight to app
    if (isSignedIn && user) {
      navigate("/home", { replace: true });
      return;
    }
  }, [isLoaded, isSignedIn, loading, user, signOut, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);
    try {
      await loginCustom(email, password);
      navigate("/home", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Student: Clerk owns the credential flow ────────────────────────────────
  if (isStudent) {
    return (
      // Footer hidden: the Clerk widget is tall enough to reach it on a laptop
      // viewport, and the two would overlap.
      <AuthBackdrop showFooter={false}>
        <div className="auth-card-glass auth-card-glass--wide">
          <Link to="/" className="auth-back-btn" style={{ textDecoration: "none" }}>
            ← Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="auth-role-badge">Student</span>
          </div>
          <h1>Welcome back, Highlander.</h1>
          <p className="auth-card-sub">Sign in to pick up where you left off.</p>

          <div className="auth-clerk-shell">
            {!isLoaded ? (
              <div className="auth-clerk-placeholder" aria-live="polite">
                <div className="auth-clerk-spinner" />
                <p>Loading sign in...</p>
              </div>
            ) : (
              <SignIn
                routing="path"
                path="/login/student"
                forceRedirectUrl="/home"
                signUpUrl="/signup/student"
                fallbackRedirectUrl="/home"
                // Only variables here. The card/header/field layout is already
                // handled by `.auth-clerk-shell .cl-*` in auth.css — specifying
                // it twice means two sources of truth that drift apart.
                appearance={{
                  variables: {
                    colorPrimary: "#d7263d",
                    colorBackground: "transparent",
                    colorText: "#fdfcfb",
                    fontFamily: "'Archivo', sans-serif",
                  },
                }}
              />
            )}
          </div>
        </div>
      </AuthBackdrop>
    );
  }

  // ── Professor / Guest: our own credential form ─────────────────────────────
  return (
    <AuthBackdrop>
      <div className="auth-card-glass">
        <Link to="/" className="auth-back-btn" style={{ textDecoration: "none" }}>
          ← Back
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="auth-role-badge">{roleName}</span>
        </div>
        <h1>Welcome back, Highlander.</h1>
        <p className="auth-card-sub">Sign in to pick up where you left off.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="auth-field-label" htmlFor="login-email">
              {isProfessor ? "NJIT email" : "Email"}
            </label>
            <input
              id="login-email"
              className="auth-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder={isProfessor ? "name@njit.edu" : "you@example.com"}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="auth-field-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="auth-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="auth-btn-brand" style={{ height: 48, marginTop: 8 }} disabled={formLoading}>
            {formLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footnote">
          New here? <Link to={`/signup/${role}`}>Create an account</Link>.
        </p>
      </div>
    </AuthBackdrop>
  );
}
