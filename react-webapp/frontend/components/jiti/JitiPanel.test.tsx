// ─────────────────────────────────────────────────────────────────────────────
// JitiPanel.test.tsx
//
// Proves:
//  - the UI branches on data.code: QUOTA_EXCEEDED renders the limit message;
//    a bare 429 with no code renders the generic error, NOT the limit message
//  - the history sent on the 4th message contains at most (exactly) 6 entries
//  - a native `storage` event updates the displayed counter with no fetch
//
// Uses a tiny harness that wires the real useJitiQuota hook up to JitiPanel
// (rather than hand-rolling a fake quota object) so these tests exercise the
// real integration between the two, same as production.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import JitiPanel from "./JitiPanel"
import { useJitiQuota } from "./useJitiQuota"

function Harness({ token }: { readonly token: string | null }) {
  const quota = useJitiQuota(token)
  if (quota.phase !== "ready") return <div>not ready</div>
  return <JitiPanel token={token} quota={quota} positionLeft={false} onClose={() => {}} />
}

interface RecordedCall {
  url: string
  init?: RequestInit
}

function makeFetchMock(chatHandler: (body: any, callIndex: number) => { status: number; body: unknown }) {
  let chatCallCount = 0
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    if (String(url).endsWith("/api/jiti/status")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ used: 0, limit: 5, remaining: 5, resetAt: "2026-08-11T00:00:00.000Z" }),
      })
    }
    if (String(url).endsWith("/api/jiti/chat")) {
      chatCallCount += 1
      const parsedBody = init?.body ? JSON.parse(init.body as string) : {}
      const { status, body } = chatHandler(parsedBody, chatCallCount)
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })
  return { fetchMock, calls }
}

async function sendMessage(text: string) {
  const input = await screen.findByLabelText(/message jiti/i)
  fireEvent.change(input, { target: { value: text } })
  fireEvent.click(screen.getByRole("button", { name: /send/i }))
}

describe("JitiPanel", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("shows the daily-limit message for a 429 with code QUOTA_EXCEEDED", async () => {
    const { fetchMock } = makeFetchMock(() => ({
      status: 429,
      body: {
        error: "Daily limit reached",
        code: "QUOTA_EXCEEDED",
        used: 5,
        limit: 5,
        resetAt: "2026-08-11T00:00:00.000Z",
      },
    }))
    vi.stubGlobal("fetch", fetchMock)
    render(<Harness token="test-token" />)

    await sendMessage("hello")

    expect(await screen.findByText(/used all 5 questions/i)).toBeInTheDocument()
  })

  it("shows the generic error — NOT the limit message — for a bare 429 with no code", async () => {
    const { fetchMock } = makeFetchMock(() => ({ status: 429, body: { error: "Too many requests" } }))
    vi.stubGlobal("fetch", fetchMock)
    render(<Harness token="test-token" />)

    await sendMessage("hello")

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.queryByText(/used all 5 questions/i)).not.toBeInTheDocument()
  })

  it("caps the history sent on the 4th message at 6 entries", async () => {
    const { calls } = (() => {
      const state = makeFetchMock((_, callIndex) => ({
        status: 200,
        body: {
          answer: `reply-${callIndex}`,
          remainingToday: 5 - callIndex,
          resetAt: "2026-08-11T00:00:00.000Z",
        },
      }))
      vi.stubGlobal("fetch", state.fetchMock)
      return state
    })()

    render(<Harness token="test-token" />)

    for (let i = 1; i <= 4; i++) {
      await sendMessage(`question ${i}`)
      await screen.findByText(`reply-${i}`)
    }

    const chatCalls = calls.filter((c) => c.url.endsWith("/api/jiti/chat"))
    expect(chatCalls).toHaveLength(4)

    const fourthBody = JSON.parse(chatCalls[3].init!.body as string)
    expect(fourthBody.history.length).toBeLessThanOrEqual(6)
    expect(fourthBody.history).toHaveLength(6)
  })

  it("updates the displayed counter from a storage event without an extra fetch", async () => {
    const { fetchMock } = makeFetchMock(() => ({
      status: 200,
      body: { answer: "unused", remainingToday: 4, resetAt: "2026-08-11T00:00:00.000Z" },
    }))
    vi.stubGlobal("fetch", fetchMock)
    render(<Harness token="test-token" />)

    await screen.findByText(/5 of 5 left today/i)
    const callsBeforeEvent = fetchMock.mock.calls.length

    const payload = {
      cachedAt: Date.now(),
      value: { used: 3, remaining: 2, resetAt: "2026-08-11T00:00:00.000Z" },
    }
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "jithub.jiti-quota-cache",
          newValue: JSON.stringify(payload),
        })
      )
    })

    await screen.findByText(/2 of 5 left today/i)
    expect(fetchMock.mock.calls.length).toBe(callsBeforeEvent)
  })
})
