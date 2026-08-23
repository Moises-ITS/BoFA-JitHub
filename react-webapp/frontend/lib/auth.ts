/**
 * lib/auth.ts — predicates about WHICH auth system a signed-in user belongs to.
 *
 * JitHub has two: students go through Clerk's hosted widget, while guests and
 * professors go through POST /api/auth/login-custom against a bcrypt hash in our
 * own Postgres. The second group has no Clerk identity at all, so any Clerk-only
 * control (password management, Clerk session UI) must be gated on this — or it
 * renders a button that can only ever fail for them.
 *
 * This lives in its own module rather than in AuthContext because AuthContext is
 * a component file: exporting non-components from it breaks Fast Refresh, which
 * the lint config enforces.
 */
import type { User } from "@/context/AuthContext"

/** True for guests and professors — the users with NO Clerk identity. */
export function isCustomAuthUser(user: User | null): boolean {
  return !!(user && (user.userType === "guest" || user.userType === "professor"))
}
