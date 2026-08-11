/**
 * SignupPage — step 3 of the "Jithub Auth" design, sign-up side.
 * See LoginPage for why the design's mock form is worn rather than reproduced.
 */
import { useEffect, useState } from "react";
import { SignUp, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthBackdrop from "./AuthBackdrop";
import "./AuthBackdrop.css";
import "./auth.css";

export default function SignupPage() {
  const { isLoaded } = useClerkAuth();
  const { user, signupCustom } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // startsWith, not endsWith: Clerk's <SignUp routing="path"> owns sub-paths
  // under /signup/student (…/verify-email-address, …/continue). With endsWith,
  // the moment Clerk advanced to email verification this flipped to false and
  // swapped the Clerk component out for the guest form mid-signup.
  const isStudent = pathname.startsWith("/signup/student");
  const isProfessor = pathname.startsWith("/signup/professor");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [interest, setInterest] = useState("");

  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (user && (user.userType === "guest" || user.userType === "professor")) {
      navigate("/home", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFormLoading(true);
    try {
      const payload: any = {
        name,
        email,
        password,
        userType: isProfessor ? "professor" : "guest",
      };
      if (isProfessor) {
        payload.department = department;
        payload.interest = interest;
      }
      await signupCustom(payload);
      navigate("/home", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setFormLoading(false);
    }
  };

  // ── Student: Clerk owns the credential flow ────────────────────────────────
  if (isStudent) {
    return (
      <AuthBackdrop showFooter={false}>
        <div className="auth-card-glass auth-card-glass--wide">
          <Link to="/" className="auth-back-btn" style={{ textDecoration: "none" }}>
            ← Back
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="auth-role-badge">Student</span>
          </div>
          <h1>Join the campus network.</h1>
          <p className="auth-card-sub">
            One account for clubs, classes, events, and everything happening at NJIT.
          </p>

          <div className="auth-clerk-shell">
            {!isLoaded ? (
              <div className="auth-clerk-placeholder" aria-live="polite">
                <div className="auth-clerk-spinner" />
                <p>Loading sign up...</p>
              </div>
            ) : (
              <SignUp
                routing="path"
                path="/signup/student"
                forceRedirectUrl="/home"
                signInUrl="/login/student"
                // Variables only — see LoginPage for why.
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
  const roleName = isProfessor ? "Professor" : "Guest";
  const loginLink = isProfessor ? "/login/professor" : "/login/guest";

  return (
    <AuthBackdrop showFooter={!isProfessor}>
      <div className="auth-card-glass">
        <Link to="/" className="auth-back-btn" style={{ textDecoration: "none" }}>
          ← Back
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="auth-role-badge">{roleName}</span>
        </div>
        <h1>Join the campus network.</h1>
        <p className="auth-card-sub">
          One account for clubs, classes, events, and everything happening at NJIT.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="auth-field-label" htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              className="auth-field"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Ada Highlander"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="auth-field-label" htmlFor="signup-email">
              {isProfessor ? "NJIT email" : "Email"}
            </label>
            <input
              id="signup-email"
              className="auth-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={isProfessor ? "name@njit.edu" : "you@example.com"}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="auth-field-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="auth-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {isProfessor && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-field-label" htmlFor="signup-department">Department</label>
                <input
                  id="signup-department"
                  className="auth-field"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  placeholder="Computer Science"
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="auth-field-label" htmlFor="signup-interest">
                  Primary academic interest
                </label>
                <input
                  id="signup-interest"
                  className="auth-field"
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  required
                  placeholder="Artificial Intelligence"
                />
              </div>
            </>
          )}

          <button type="submit" className="auth-btn-brand" style={{ height: 48, marginTop: 8 }} disabled={formLoading}>
            {formLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/*
          Deliberately NOT links yet. Neither /terms nor /guidelines is a route,
          so <Link> would hit App.tsx's catch-all and silently bounce the user
          to the landing page half way through signing up — worse than plain
          text. Turn these back into <Link> the moment those pages exist; they
          are a legal requirement before launch, not a nice-to-have.
        */}
        <p className="auth-footnote">
          By creating an account you agree to the Terms and Community Guidelines.
        </p>
        <p className="auth-footnote" style={{ marginTop: 8 }}>
          Already have an account? <Link to={loginLink}>Sign in</Link>.
        </p>
      </div>
    </AuthBackdrop>
  );
}
