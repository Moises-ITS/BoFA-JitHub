import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"

import { API_BASE_URL as API } from "@/lib/api"

type AttendanceRecord = {
  event_id: number
  club_id: number
  headcount: number
  entered_by: string | null
  entered_at: string
  notes: string | null
}

interface Props {
  eventId: number
  clubId: number
  eventDate: string
}

// E-board-only attendance entry. Renders nothing unless:
//   (a) current user is e-board for this event's club, AND
//   (b) the event date is today or in the past.
export function AttendanceForm({ eventId, clubId, eventDate }: Props) {
  const { user, token } = useAuth()
  const [existing, setExisting] = useState<AttendanceRecord | null>(null)
  const [headcount, setHeadcount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const isOwnerEboard = Boolean(user?.is_eboard) && user?.eboard_club_id === clubId
  const isPastOrToday = eventDate <= new Date().toISOString().slice(0, 10)
  const show = isOwnerEboard && isPastOrToday

  useEffect(() => {
    if (!show || !token) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    fetch(`${API}/api/eden/events/${eventId}/attendance`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data) {
          setExisting(data)
          setHeadcount(String(data.headcount))
          setNotes(data.notes ?? "")
          setSavedAt(data.entered_at)
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [show, token, eventId])

  if (!show) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    const count = Number.parseInt(headcount, 10)
    if (!Number.isFinite(count) || count < 0) {
      setError("Enter a valid headcount")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/eden/events/${eventId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ club_id: clubId, headcount: count, notes: notes || null }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Failed to save attendance")
        return
      }
      setExisting(body)
      setSavedAt(body.entered_at)
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-xl p-4 mt-4"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">Attendance (e-board)</h4>
        {savedAt && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Last saved {new Date(savedAt).toLocaleString()}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Headcount
            <input
              type="number"
              min={0}
              value={headcount}
              onChange={e => setHeadcount(e.target.value)}
              placeholder="e.g. 42"
              className="h-9 px-3 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything that affected turnout"
              className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                backgroundColor: "var(--bg-canvas)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          {error && (
            <p className="text-xs" style={{ color: "var(--status-error, #ff6b6b)" }}>{error}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs rounded-lg font-medium transition-opacity disabled:opacity-50"
              style={{ background: "var(--brand-gradient)", color: "white" }}
            >
              {saving ? "Saving…" : existing ? "Update" : "Save attendance"}
            </button>
            {existing && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Feeds EDEN forecasts
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

export default AttendanceForm
