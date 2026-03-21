/// <reference types="vite/client" />
// Fetches all graph nodes once and provides fast client-side filtering.
// Results are grouped by node type, max 5 per group.

const API = import.meta.env.VITE_API_URL ?? ""

interface GraphNode {
  id:    string
  label: string
  type:  string
}

interface SearchGroup {
  type:    string
  label:   string
  emoji:   string
  results: GraphNode[]
}

// Module-level cache — shared across all hook instances, fetched at most once
let cachedNodes: GraphNode[] | null = null
let fetchPromise: Promise<GraphNode[]> | null = null

async function loadNodes(): Promise<GraphNode[]> {
  if (cachedNodes) return cachedNodes
  if (fetchPromise) return fetchPromise
  fetchPromise = fetch(`${API}/api/graph/nodes`)
    .then(r => r.ok ? r.json() : [])
    .then((data: GraphNode[]) => {
      cachedNodes = data
      fetchPromise = null
      return data
    })
    .catch(() => {
      fetchPromise = null
      return []
    })
  return fetchPromise
}

const TYPE_META: Record<string, { label: string; emoji: string; order: number }> = {
  student:  { label: "Students",   emoji: "👤", order: 0 },
  club:     { label: "Clubs",      emoji: "🎓", order: 1 },
  company:  { label: "Companies",  emoji: "🏢", order: 2 },
  interest: { label: "Interests",  emoji: "💡", order: 3 },
}

export function search(query: string): SearchGroup[] {
  if (!cachedNodes || query.trim().length < 1) return []
  const q = query.toLowerCase().trim()

  const grouped = new Map<string, GraphNode[]>()
  for (const node of cachedNodes) {
    if (!node.label?.toLowerCase().includes(q)) continue
    const type = node.type ?? "other"
    if (!grouped.has(type)) grouped.set(type, [])
    const arr = grouped.get(type)!
    if (arr.length < 5) arr.push(node)
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => {
      const ao = TYPE_META[a]?.order ?? 99
      const bo = TYPE_META[b]?.order ?? 99
      return ao - bo
    })
    .map(([type, results]) => ({
      type,
      label:   TYPE_META[type]?.label  ?? type,
      emoji:   TYPE_META[type]?.emoji  ?? "•",
      results,
    }))
}

// Eagerly warm the cache so the first search is instant
export function primeCache() {
  loadNodes()
}

// Force-refresh the cache (call after new users sign up)
export function invalidateCache() {
  cachedNodes = null
  fetchPromise = null
}

// Return a single node from the cache by id (returns null if not found or cache not loaded)
export function getNodeById(id: string): GraphNode | null {
  return cachedNodes?.find(n => n.id === id) ?? null
}
