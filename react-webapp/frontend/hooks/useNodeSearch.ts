/// <reference types="vite/client" />
// Fetches all graph nodes once and provides fast client-side filtering.
// Results are grouped by node type, max 5 per group.

const API = import.meta.env.VITE_API_URL ?? ""

interface GraphNode {
  id: string
  label: string
  type: string
}

interface SearchGroup {
  type: string
  label: string
  emoji: string
  results: GraphNode[]
}

// Module-level cache — shared across all hook instances, fetched at most once
let cachedNodes: GraphNode[] | null = null
let fetchPromise: Promise<GraphNode[]> | null = null
let cacheToken: string | null = null

//think about ordering food from a fast food resturant
//You must cache the nodes so that you don't have to fetch them from the database every time
//if you dont cache the nodes, it will be slow
//runs on /home not / or /login and only once except user closes page and reopens it, or refreshes the page
//or null node information
async function loadNodes(token?: string | null): Promise<GraphNode[]> {
  if (!token) return []
  if (cacheToken && cacheToken !== token) {
    cachedNodes = null
    fetchPromise = null
  }
  if (cachedNodes) return cachedNodes
  if (fetchPromise) return fetchPromise
  fetchPromise = fetch(`${API}/api/graph/nodes`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => r.ok ? r.json() : [])
    .then((data: GraphNode[]) => {
      cachedNodes = data
      cacheToken = token
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
  student: { label: "Students", emoji: "👤", order: 0 },
  club: { label: "Clubs", emoji: "🎓", order: 1 },
  company: { label: "Companies", emoji: "🏢", order: 2 },
  interest: { label: "Interests", emoji: "💡", order: 3 },
}
//search bar functionality checks to see if node is loaded or anything typed in the search bar
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
  //start from here
  return [...grouped.entries()]
    .sort(([a], [b]) => {
      const ao = TYPE_META[a]?.order ?? 99
      const bo = TYPE_META[b]?.order ?? 99
      return ao - bo
    })
    .map(([type, results]) => ({
      type,
      label: TYPE_META[type]?.label ?? type,
      emoji: TYPE_META[type]?.emoji ?? "•",
      results,
    }))
}

// Eagerly warm the cache so the first search is instant
export function primeCache(token?: string | null) {
  void loadNodes(token)
}

// Force-refresh the cache (call after new users sign up)
export function invalidateCache() {
  cachedNodes = null
  fetchPromise = null
  cacheToken = null
}

// Return a single node from the cache by id (returns null if not found or cache not loaded)
export function getNodeById(id: string): GraphNode | null {
  return cachedNodes?.find(n => n.id === id) ?? null
}
