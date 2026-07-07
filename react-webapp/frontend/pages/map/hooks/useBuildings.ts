import { useState, useEffect } from "react"
import type { Building } from "../types"

import { API_BASE_URL as API_URL } from "@/lib/api"

export function useBuildings() {
  const [buildings, setBuildings] = useState<readonly Building[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchBuildings() {
      try {
        const res = await fetch(`${API_URL}/api/buildings`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setBuildings(json.data)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Failed to load buildings")
      } finally {
        setLoading(false)
      }
    }

    fetchBuildings()
    return () => controller.abort()
  }, [])

  return { buildings, loading, error } as const
}
