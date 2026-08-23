// ─────────────────────────────────────────────────────────────────────────────
// JitiWidget.test.tsx
//
// Proves:
//  - the widget renders the launcher on /home once the status check succeeds
//  - it renders nothing at all when GET /api/jiti/status returns 404
//    (feature flag off — fail closed)
//  - it renders nothing on any route other than /home
//  - opening the panel triggers exactly one GET /api/jiti/status and zero
//    POST /api/jiti/chat calls
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import JitiWidget from "./JitiWidget"

const authState: { token: string | null } = { token: "test-token" }

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
}))

function mockStatusOk() {
  return vi.fn((url: string) => {
    if (String(url).endsWith("/api/jiti/status")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ used: 1, limit: 5, remaining: 4, resetAt: "2026-08-11T00:00:00.000Z" }),
      })
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })
}

function mockStatus404() {
  return vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }))
}

function renderWidget(path = "/home") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <JitiWidget />
    </MemoryRouter>
  )
}

describe("JitiWidget", () => {
  beforeEach(() => {
    authState.token = "test-token"
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("renders the launcher on /home once the status check succeeds", async () => {
    vi.stubGlobal("fetch", mockStatusOk())
    renderWidget()

    expect(await screen.findByRole("button", { name: /jiti/i })).toBeInTheDocument()
  })

  it("renders nothing at all when GET /api/jiti/status returns 404 (feature flag off)", async () => {
    const fetchMock = mockStatus404()
    vi.stubGlobal("fetch", fetchMock)
    renderWidget()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: /jiti/i })).not.toBeInTheDocument()
  })

  it.each(["/research", "/events", "/profile", "/organizations", "/opportunities", "/network"])(
    "renders nothing on %s — Jiti is home-only",
    async (path) => {
      const fetchMock = mockStatusOk()
      vi.stubGlobal("fetch", fetchMock)
      renderWidget(path)

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      expect(screen.queryByRole("button", { name: /jiti/i })).not.toBeInTheDocument()
    }
  )

  it("opening the panel triggers exactly one GET status call and zero POST chat calls", async () => {
    const fetchMock = mockStatusOk()
    vi.stubGlobal("fetch", fetchMock)
    renderWidget()

    const launcher = await screen.findByRole("button", { name: /jiti/i })
    fireEvent.click(launcher)

    await screen.findByRole("dialog")

    const statusCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/jiti/status"))
    const chatCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/jiti/chat"))
    expect(statusCalls).toHaveLength(1)
    expect(chatCalls).toHaveLength(0)
  })

  it("renders nothing for a guest account (403 GUEST_NOT_ALLOWED)", async () => {
    // Guests are denied Jiti server-side (denyGuests in routes/jiti.ts). The
    // widget must hide entirely rather than show a launcher that errors on
    // first use — a guest has no way to resolve that error.
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: "Jiti is available to NJIT students, faculty, and staff.",
            code: "GUEST_NOT_ALLOWED",
          }),
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    renderWidget()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: /jiti/i })).not.toBeInTheDocument()
  })
})
