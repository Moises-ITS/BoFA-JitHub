/**
 * JitiWidget.tsx — the single mount point for the Jiti chat widget (a small
 * "ask about NJIT clubs" assistant). Mounted once in ProtectedRoute, but it
 * renders only on the home page (see HOME_ROUTE): Jiti is a front-door
 * feature, and a floating launcher elsewhere competes with those pages' own
 * controls — the map, the network graph, and the research panel each own
 * their corners of the viewport.
 *
 * Staying mounted in ProtectedRoute rather than moving into Home is
 * deliberate — the quota status fetch below then runs once per session
 * instead of once per visit to /home.
 *
 * Fail-closed: the feature-flag check IS the initial quota status fetch
 * (see useJitiQuota) — a 404 on GET /api/jiti/status means the feature is
 * off server-side, and this widget renders nothing at all, no launcher
 * button, rather than a broken chat.
 */
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import JitiLauncher from "./JitiLauncher"
import JitiPanel from "./JitiPanel"
import { useJitiQuota } from "./useJitiQuota"

/** The only route Jiti appears on. Matches the /home route in App.tsx. */
const HOME_ROUTE = "/home"

export default function JitiWidget() {
  const { token } = useAuth()
  const location = useLocation()
  // "Open" is stored as the path the panel was opened on, not a bare boolean,
  // so leaving that path closes it as a plain render-time derivation — no
  // effect syncing two pieces of state. JitiPanel owns the whole conversation
  // and unmounts with it, so a boolean left true would reopen an empty panel
  // on the next visit to /home.
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null)
  const quota = useJitiQuota(token)

  const isOpen = openedOnPath === location.pathname

  if (location.pathname !== HOME_ROUTE || quota.phase !== "ready") return null

  const toggle = () => setOpenedOnPath(isOpen ? null : location.pathname)

  return (
    <>
      <JitiLauncher isOpen={isOpen} onToggle={toggle} />
      {isOpen && <JitiPanel token={token} quota={quota} onClose={() => setOpenedOnPath(null)} />}
    </>
  )
}
