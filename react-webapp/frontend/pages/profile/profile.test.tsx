// ─────────────────────────────────────────────────────────────────────────────
// profile.test.tsx — the Account Security card's password flow.
//
// Exists because of a production bug: the page used Clerk's SIGNED-OUT reset
// flow (signIn.create) from an authenticated page. Against the production Clerk
// instance that call hung, and since nothing bounded it, the UI sat on a
// spinner forever with no error and nothing logged.
//
// Proves:
//  - a hung updatePassword surfaces a visible error and re-enables the button
//    (the regression guard — first case)
//  - Clerk API rejections become actionable copy, not raw SDK strings
//  - the happy path sends exactly the params Clerk expects
//  - a user with no password yet gets a SET flow and no currentPassword field
//  - guests/professors never see the control at all
//  - client-side validation short-circuits before any network call
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { PASSWORD_ACTION_TIMEOUT_MS } from "./passwordErrors"

const authState: { user: Record<string, unknown> | null; token: string | null } = {
  user: { id: "u1", name: "Test Student", email: "ts1@njit.edu", userType: "student" },
  token: "test-token",
}

const clerkState: {
  isLoaded: boolean
  passwordEnabled: boolean
  updatePassword: ReturnType<typeof vi.fn>
} = {
  isLoaded: true,
  passwordEnabled: true,
  updatePassword: vi.fn(),
}

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ ...authState, logout: vi.fn() }),
}))

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    isLoaded: clerkState.isLoaded,
    user: clerkState.isLoaded
      ? { passwordEnabled: clerkState.passwordEnabled, updatePassword: clerkState.updatePassword }
      : null,
  }),
  // Pass-through: the real hook only interposes when Clerk demands reverification.
  useReverification: (fetcher: unknown) => fetcher,
}))

vi.mock("@clerk/clerk-react/errors", () => ({
  isClerkAPIResponseError: (e: unknown) => Boolean(e && (e as { clerkError?: boolean }).clerkError),
  isReverificationCancelledError: () => false,
}))

// The page also renders recommended opportunities and "your events"; neither is
// under test here, so keep them inert rather than stubbing their whole network.
vi.mock("../opportunities/hooks/useOpportunities", () => ({
  useOpportunities: () => ({ sortedFiltered: [] }),
}))

vi.mock("../node/components/EditProfileModal", () => ({
  default: () => null,
}))

import Profile from "./profile"

/** Mimics a ClerkAPIResponseError closely enough for the error classifier. */
function clerkError(code: string, longMessage?: string) {
  return { clerkError: true, errors: [{ code, longMessage, message: code }] }
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Profile />
    </MemoryRouter>
  )
}

function openModal() {
  fireEvent.click(screen.getByTestId("password-open"))
}

function fillForm({ current = "OldPassw0rd", next = "NewPassw0rd", confirm = "NewPassw0rd" } = {}) {
  const currentField = screen.queryByPlaceholderText("Your current password")
  if (currentField) fireEvent.change(currentField, { target: { value: current } })
  fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), { target: { value: next } })
  fireEvent.change(screen.getByPlaceholderText("Re-enter password"), { target: { value: confirm } })
}

describe("Profile — password change", () => {
  beforeEach(() => {
    authState.user = { id: "u1", name: "Test Student", email: "ts1@njit.edu", userType: "student" }
    authState.token = "test-token"
    clerkState.isLoaded = true
    clerkState.passwordEnabled = true
    clerkState.updatePassword = vi.fn().mockResolvedValue({})
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }))
    )
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("recovers from a hung Clerk call with a visible error instead of an endless spinner", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Never settles — exactly the production failure mode.
    clerkState.updatePassword = vi.fn(() => new Promise(() => {}))

    renderProfile()
    openModal()
    fillForm()
    fireEvent.click(screen.getByTestId("password-save"))

    expect(screen.getByTestId("password-save")).toBeDisabled()

    await vi.advanceTimersByTimeAsync(PASSWORD_ACTION_TIMEOUT_MS + 1_000)

    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent(/reach Clerk in time/i)
    })
    expect(screen.getByTestId("password-save")).not.toBeDisabled()
  })

  it("turns a wrong-current-password rejection into actionable copy", async () => {
    clerkState.updatePassword = vi.fn().mockRejectedValue(clerkError("form_password_incorrect"))

    renderProfile()
    openModal()
    fillForm()
    fireEvent.click(screen.getByTestId("password-save"))

    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent("Current password is incorrect.")
    })
    expect(screen.getByTestId("password-save")).not.toBeDisabled()
  })

  it("sends the params Clerk expects and confirms success in place", async () => {
    renderProfile()
    openModal()
    fillForm()
    fireEvent.click(screen.getByTestId("password-save"))

    await waitFor(() => {
      expect(clerkState.updatePassword).toHaveBeenCalledWith({
        newPassword: "NewPassw0rd",
        currentPassword: "OldPassw0rd",
        signOutOfOtherSessions: true,
      })
    })
    // Modal stays open so the confirmation is actually seen.
    expect(screen.getByTestId("password-message")).toHaveTextContent(/Password updated/i)
  })

  it("treats a user with no password as a SET flow and omits currentPassword", async () => {
    clerkState.passwordEnabled = false

    renderProfile()
    openModal()

    expect(screen.queryByPlaceholderText("Your current password")).not.toBeInTheDocument()
    fillForm()
    fireEvent.click(screen.getByTestId("password-save"))

    await waitFor(() => expect(clerkState.updatePassword).toHaveBeenCalled())
    expect(clerkState.updatePassword.mock.calls[0][0]).not.toHaveProperty("currentPassword")
  })

  it("hides the control from professors, who have no Clerk identity at all", async () => {
    authState.user = { id: "p1", name: "Prof", email: "p@njit.edu", userType: "professor" }

    renderProfile()

    // await, not a bare assertion: the page's "your events" effect settles after
    // mount, and asserting synchronously leaves that state update outside act().
    await waitFor(() => {
      expect(screen.getByText(/available for guest and professor accounts/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId("password-open")).not.toBeInTheDocument()
  })

  it("rejects mismatched confirmations without calling Clerk", async () => {
    renderProfile()
    openModal()
    fillForm({ confirm: "SomethingElse1" })
    fireEvent.click(screen.getByTestId("password-save"))

    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent("Passwords do not match.")
    })
    expect(clerkState.updatePassword).not.toHaveBeenCalled()
  })

  it("rejects a too-short password without calling Clerk", async () => {
    renderProfile()
    openModal()
    fillForm({ next: "short", confirm: "short" })
    fireEvent.click(screen.getByTestId("password-save"))

    await waitFor(() => {
      expect(screen.getByTestId("password-error")).toHaveTextContent(/at least 8 characters/i)
    })
    expect(clerkState.updatePassword).not.toHaveBeenCalled()
  })
})
