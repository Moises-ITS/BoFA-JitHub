/**
 * JitiWidget.tsx — the single mount point for the Jiti chat widget (a small
 * "ask about NJIT clubs" assistant). Mounted once in ProtectedRoute, so it
 * follows every authenticated route without being wired into each page.
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

// Research Districts renders a fixed, full-height, right-docked panel
// (.rd-panel, pages/districts/ResearchDistricts.css:631-636) that a
// bottom-right launcher would sit underneath — anchor bottom-left there
// instead. Everywhere else stays bottom-right.
const LEFT_ANCHORED_ROUTE = "/research"

export default function JitiWidget() {
  const { token } = useAuth()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const quota = useJitiQuota(token)

  if (quota.phase !== "ready") return null

  const positionLeft = location.pathname === LEFT_ANCHORED_ROUTE

  return (
    <>
      <JitiLauncher isOpen={isOpen} positionLeft={positionLeft} onToggle={() => setIsOpen((open) => !open)} />
      {isOpen && (
        <JitiPanel token={token} quota={quota} positionLeft={positionLeft} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
