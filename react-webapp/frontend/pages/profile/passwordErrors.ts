/**
 * passwordErrors.ts — copy and logging policy for the in-session password change
 * on the profile page.
 *
 * Split out of profile.tsx so these stay pure and directly unit-testable without
 * mounting the page (and so profile.tsx exports only its component, which the
 * Fast Refresh lint rule requires).
 */
import { isClerkAPIResponseError, isReverificationCancelledError } from "@clerk/clerk-react/errors";
import { TimeoutError } from "@/lib/api";

/**
 * Ceiling on a password change. Deliberately NOT lib/api's REQUEST_TIMEOUT_MS
 * (10s): Clerk may interrupt the call with its own reverification modal, and
 * the promise stays pending the whole time the user is typing into it. This is
 * a dead-man's switch against a clerk-js call that never settles, not a network
 * SLA — the previous version had no ceiling at all, which is how a hung call
 * became a button stuck on "Sending code..." forever with nothing logged.
 */
export const PASSWORD_ACTION_TIMEOUT_MS = 60_000;

/** Minimum we enforce client-side. Clerk's instance policy may be stricter; when it is, its own error text wins. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Turns anything `updatePassword` can throw into copy a student can act on.
 *
 * Pure and module-level so it is unit-testable without mounting the page. Note
 * the deliberate absence of a `error.message` passthrough: the old code piped
 * raw SDK strings straight into the UI, which is how "Password reset is not
 * ready yet" ended up as user-facing copy.
 */
export function describePasswordError(error: unknown): string {
  if (isReverificationCancelledError(error)) {
    return "Verification cancelled. Your password was not changed.";
  }
  if (error instanceof TimeoutError) {
    return "We couldn't reach Clerk in time. Your password was not changed — check your connection and try again.";
  }
  if (isClerkAPIResponseError(error)) {
    const first = error.errors?.[0];
    switch (first?.code) {
      case "form_password_incorrect":
        return "Current password is incorrect.";
      case "form_password_pwned":
        return "That password has appeared in a data breach. Please choose a different one.";
      case "session_exists":
        // Should be unreachable now that we no longer start a sign-in attempt
        // from inside an authenticated page. If this shows up, someone has
        // reintroduced a signIn.* call here.
        return "Something went wrong with your session. Sign out, sign back in, and try again.";
      default:
        return first?.longMessage || first?.message || "Unable to change your password. Please try again.";
    }
  }
  return "Unable to change your password. Please try again.";
}

/** Classifies a failure for the log line — never for the user, who gets describePasswordError. */
export function classifyPasswordError(error: unknown): string {
  if (isReverificationCancelledError(error)) return "reverification_cancelled";
  if (error instanceof TimeoutError) return "timeout";
  if (isClerkAPIResponseError(error)) return "clerk_api";
  return "unknown";
}

/**
 * Structured breadcrumb, mirroring the backend's console convention
 * (see backend/src/middleware/auth.ts `[security][auth-failed]`). The failure
 * this replaces was invisible rather than merely unreported, so a console line
 * plus a guaranteed-visible error state is the fix.
 *
 * Logs Clerk error CODES and booleans only — never a password, never the email.
 */
export function logPasswordEvent(stage: "success" | "failed", detail: Record<string, unknown> = {}) {
  const payload = { stage, ...detail };
  if (stage === "failed") console.error("[profile][password-change]", payload);
  else console.info("[profile][password-change]", payload);
}
