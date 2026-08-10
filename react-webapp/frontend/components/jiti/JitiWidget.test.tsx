// ─────────────────────────────────────────────────────────────────────────────
// JitiWidget.test.tsx
//
// Proves:
//  - the widget renders the launcher on an authenticated route once the
//    status check succeeds
//  - it renders nothing at all when GET /api/jiti/status returns 404
//    (feature flag off — fail closed)
//  - the launcher gets the --left position class on /research and the
//    default (bottom-right) class everywhere else
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

  it("renders the launcher on an authenticated route once the status check succeeds", async () => {
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

  it("anchors the launcher bottom-left on /research", async () => {
    vi.stubGlobal("fetch", mockStatusOk())
    renderWidget("/research")

    const launcher = await screen.findByRole("button", { name: /jiti/i })
    expect(launcher.className).toContain("jiti-launcher--left")
  })

  it("uses the default (bottom-right) position class on every other route", async () => {
    vi.stubGlobal("fetch", mockStatusOk())
    renderWidget("/home")

    const launcher = await screen.findByRole("button", { name: /jiti/i })
    expect(launcher.className).toContain("jiti-launcher")
    expect(launcher.className).not.toContain("jiti-launcher--left")
  })

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
})
