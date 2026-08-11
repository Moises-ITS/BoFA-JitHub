/**
 * JitiPanel.tsx — the chat panel: greeting, message list, input, quota
 * badge, and error states covering every /api/jiti/chat outcome (200,
 * 429 QUOTA_EXCEEDED, 429 with no code, 503 AT_CAPACITY, 502
 * UPSTREAM_FAILURE, and network failure). See useJitiQuota.ts for the quota
 * model this consumes.
 *
 * Session-scoped by design: this component only exists in the DOM while the
 * panel is open (JitiWidget unmounts it on close), so all local message
 * state resets for free on close and never survives a reload — nothing here
 * is persisted, per the product brief.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { apiFetch, type ApiErrorBody } from "@/lib/api"
import { getDeviceId } from "@/lib/deviceId"
import type { JitiQuotaState } from "./useJitiQuota"
import "./JitiPanel.css"

interface JitiPanelProps {
  readonly token: string | null
  readonly quota: JitiQuotaState
  readonly positionLeft: boolean
  readonly onClose: () => void
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatSuccessBody {
  answer: string
  remainingToday: number
  resetAt: string
}

interface ChatErrorBody extends ApiErrorBody {
  used?: number
  limit?: number
  resetAt?: string
}

/** Prior-turn context sent on every request: last 3 exchanges = 6 messages. */
const MAX_HISTORY_MESSAGES = 6

const GREETING =
  "Hi, I'm Jiti! Ask me about NJIT clubs and student organizations — what they do, how to join, or when they meet. You get 5 questions a day, so make them count."

function formatResetTime(resetAt: string | null): string {
  if (!resetAt) return "tomorrow"
  const date = new Date(resetAt)
  if (Number.isNaN(date.getTime())) return "tomorrow"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function JitiPanel({ token, quota, positionLeft, onClose }: JitiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [pending, setPending] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const deviceId = useMemo(() => getDeviceId(), [])

  const limitReached = quota.remaining <= 0
  const inputDisabled = pending || limitReached

  // Focus moves to the input the moment the panel opens.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Escape closes the panel.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const question = inputValue.trim()
    if (!question || inputDisabled) return

    setErrorText(null)
    // Trailing window sent as context — the last 3 exchanges (<=6 messages),
    // taken from the conversation BEFORE this new question is appended.
    const history = messages.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: question }])
    setInputValue("")
    setPending(true)

    try {
      const { ok, status, data } = await apiFetch<ChatSuccessBody & ChatErrorBody>("/api/jiti/chat", token, {
        method: "POST",
        body: JSON.stringify({ question, deviceId, history }),
      })

      if (ok) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.answer }])
        quota.applySendResult(data.remainingToday, data.resetAt)
        return
      }

      // Branch on data.code, never on HTTP status alone — a pre-existing IP
      // rate limiter also answers 429 but WITHOUT a `code`, and must render
      // the generic error below, not the quota-exhausted state.
      if (status === 429 && data.code === "QUOTA_EXCEEDED") {
        quota.applyQuotaExceeded(
          data.used ?? quota.limit,
          data.limit ?? quota.limit,
          data.resetAt ?? quota.resetAt ?? ""
        )
        return
      }

      if (data.code === "AT_CAPACITY") {
        setErrorText("Jiti is at capacity right now. Please try again in a few minutes.")
        return
      }

      if (data.code === "UPSTREAM_FAILURE") {
        setErrorText("Jiti couldn't reach its knowledge base just now. Please try again shortly.")
        return
      }

      // Bare 429 (IP rate limiter, no code) or any other unrecognized failure.
      setErrorText("Something went wrong sending that. Please try again in a moment.")
    } catch {
      setErrorText("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={`jiti-panel${positionLeft ? " jiti-panel--left" : ""}`} role="dialog" aria-label="Jiti chat">
      <div className="jiti-panel__header">
        <div className="jiti-panel__header-text">
          <p className="jiti-panel__title">Jiti</p>
          <span className="jiti-panel__quota">
            {quota.used} of {quota.limit} today
          </span>
        </div>
        <button type="button" className="jiti-panel__close" onClick={onClose} aria-label="Close Jiti chat">
          ✕
        </button>
      </div>

      <div className="jiti-panel__messages" role="log" aria-live="polite">
        <div className="jiti-message jiti-message--greeting">{GREETING}</div>
        {messages.map((message) => (
          <div key={message.id} className={`jiti-message jiti-message--${message.role}`}>
            {message.content}
          </div>
        ))}
        {pending && <div className="jiti-message jiti-message--pending">Jiti is thinking…</div>}
        {errorText && <div className="jiti-message jiti-message--error">{errorText}</div>}
      </div>

      {limitReached && (
        <div className="jiti-panel__limit-banner">
          You&apos;ve used all {quota.limit} questions for today. Come back after {formatResetTime(quota.resetAt)}.
        </div>
      )}

      <form className="jiti-panel__form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="jiti-panel__input"
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={inputDisabled}
          placeholder={limitReached ? "Daily limit reached" : "Ask about NJIT clubs…"}
          aria-label="Message Jiti"
        />
        <button type="submit" className="jiti-panel__send" disabled={inputDisabled || !inputValue.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
