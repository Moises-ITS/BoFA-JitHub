/**
 * LandingPage — steps 1 and 2 of the "Jithub Auth" design.
 *
 * The design models the whole signed-out experience as three steps inside one
 * glass card: entry (sign up / sign in) → role (student / professor / guest) →
 * form. Steps 1 and 2 live here; step 3 is /login/:role and /signup/:role,
 * which render the SAME card over the SAME backdrop so the transition reads as
 * one continuous flow rather than a page change.
 *
 * Step 3 is deliberately NOT the design's mock form: students authenticate
 * through Clerk's hosted widget and professors/guests through our own
 * credential endpoints. Those pages wear the design; they don't reimplement it.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AuthBackdrop from "@/pages/auth/AuthBackdrop";
import "@/pages/auth/AuthBackdrop.css";

type Role = "student" | "professor" | "guest";
type Step = "entry" | "role";
type Mode = "login" | "signup";

const ROLES: { tag: string; label: string; desc: string; value: Role }[] = [
  { tag: "STU", label: "Student", desc: "Current NJIT undergrad or grad student", value: "student" },
  { tag: "PRF", label: "Professor", desc: "Faculty, instructors, and staff", value: "professor" },
  { tag: "GST", label: "Guest", desc: "Alumni, visitors, and campus partners", value: "guest" },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("entry");
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    if (!loading && user) {
      navigate("/home", { replace: true });
    }
  }, [user, loading, navigate]);

  function pick(role: Role) {
    navigate(mode === "login" ? `/login/${role}` : `/signup/${role}`);
  }

  return (
    <AuthBackdrop>
      {/* --centered is scoped to the landing card on purpose. The same
          .auth-card-glass is worn by /login/:role and /signup/:role, whose
          headings sit above left-aligned form fields — centering those would
          leave the label and its input disagreeing about where the eye starts. */}
      <div className="auth-card-glass auth-card-glass--centered">
        {step === "entry" ? (
          <>
            <h1>Your Campus in One place</h1>
            <p className="auth-card-sub">
              Everything happening at NJIT.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                type="button"
                className="auth-btn-brand"
                onClick={() => { setMode("signup"); setStep("role"); }}
              >
                Sign up
              </button>
              <button
                type="button"
                className="auth-btn-ghost"
                onClick={() => { setMode("login"); setStep("role"); }}
              >
                Sign in
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="auth-back-btn" onClick={() => setStep("entry")}>
              ← Back
            </button>
            <h1>Who are you?</h1>
            <p className="auth-card-sub" style={{ marginBottom: 24 }}>
              {mode === "signup"
                ? "Pick how you’ll join the network — it shapes your account."
                : "Tell us how you signed up so we can find your account."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ROLES.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  className="auth-role-btn"
                  onClick={() => pick(role.value)}
                >
                  <span className="auth-role-tag">{role.tag}</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span className="auth-role-label">{role.label}</span>
                    <span className="auth-role-desc">{role.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </AuthBackdrop>
  );
}
