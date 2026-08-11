/**
 * organizationsApi.ts — every network call the Organizations page makes.
 *
 * Thin wrappers over `eventsFetch` from lib/api, which already owns the backend
 * origin, the Bearer header, the 10s abort timeout, and defensive JSON parsing,
 * and which returns `{ ok, status, data }` WITHOUT throwing. Keeping the calls
 * here rather than inline in the page means the URL-building rules below live in
 * exactly one place.
 */
import { eventsFetch } from "@/lib/api"
import {
  ORG_PAGE_SIZE,
  type OrganizationDetail,
  type OrganizationListResponse,
  type OrgTypeFilter,
  type StarResult,
  type TrendingOrg,
} from "../types/organizations"

/** Our backend's error envelope. */
interface ApiError {
  error?: string
}

/**
 * Build the /organizations query string.
 *
 * THE ONE TRAP: `type` is validated STRICTLY server-side, so "all" is not a legal
 * value — sending `type=all` returns 400 "Invalid type filter". "All" is
 * expressed by omitting the parameter entirely. `q` is likewise omitted when
 * blank rather than sent empty.
 */
export function buildOrganizationsQuery(params: {
  q?: string
  type?: OrgTypeFilter
  limit?: number
  offset?: number
}): string {
  const search = new URLSearchParams()
  const q = (params.q ?? "").trim()
  if (q) search.set("q", q)
  if (params.type && params.type !== "all") search.set("type", params.type)
  search.set("limit", String(params.limit ?? ORG_PAGE_SIZE))
  search.set("offset", String(params.offset ?? 0))
  return search.toString()
}

/** Pull a human-readable message out of an error body, with a sane default. */
function messageFrom(data: unknown, status: number, fallback: string): string {
  const err = (data as ApiError | null)?.error
  if (typeof err === "string" && err) return err
  // 429 (the write rate limit) does NOT return an { error } body, so this branch
  // is load-bearing, not defensive padding.
  if (status === 429) return "You're starring too quickly — give it a minute."
  return fallback
}

/**
 * GET /organizations — public. Deliberately takes no token: gating the grid on
 * auth resolution would leave the page blank while the Clerk token round-trips.
 */
export async function fetchOrganizations(params: {
  q?: string
  type?: OrgTypeFilter
  limit?: number
  offset?: number
}): Promise<OrganizationListResponse> {
  const { ok, status, data } = await eventsFetch<OrganizationListResponse & ApiError>(
    `/organizations?${buildOrganizationsQuery(params)}`
  )
  if (!ok) throw new Error(messageFrom(data, status, "Could not load organizations"))
  return data
}

/** GET /organizations/my-stars — requires a session. */
export async function fetchMyStars(token: string): Promise<number[]> {
  const { ok, status, data } = await eventsFetch<{ club_ids?: number[] } & ApiError>(
    "/organizations/my-stars",
    token
  )
  if (!ok) throw new Error(messageFrom(data, status, "Could not load your starred organizations"))
  return Array.isArray(data.club_ids) ? data.club_ids : []
}

/**
 * GET /organizations/:clubId — requires a session, because the response contains
 * the CALLER's connections.
 */
export async function fetchOrganizationDetail(
  clubId: number,
  token: string
): Promise<OrganizationDetail> {
  const { ok, status, data } = await eventsFetch<OrganizationDetail & ApiError>(
    `/organizations/${clubId}`,
    token
  )
  if (!ok) throw new Error(messageFrom(data, status, "Could not load this organization"))
  return data
}

/**
 * PUT/DELETE /organizations/:clubId/star.
 *
 * TWO THINGS THE CALLER MUST HONOUR:
 *  1. The returned `club_id` MAY DIFFER from the one sent. Writes canonicalise to
 *     the surviving row of a dedup group, so always reconcile state against the
 *     RETURNED id, never the one you asked for.
 *  2. `star_count` is the fresh authoritative group total. Overwrite the
 *     optimistic count with it; there is nothing to refetch.
 *
 * Both verbs are idempotent, so a double-click is safe — but the endpoint is
 * rate-limited (120 writes / 15 min / IP), which is why the page disables the
 * control while a write for that org is in flight.
 */
export async function setOrganizationStar(
  clubId: number,
  starred: boolean,
  token: string
): Promise<StarResult> {
  const { ok, status, data } = await eventsFetch<StarResult & ApiError>(
    `/organizations/${clubId}/star`,
    token,
    { method: starred ? "PUT" : "DELETE" }
  )
  if (!ok) throw new Error(messageFrom(data, status, "Could not save your star"))
  return data
}

/** GET /organizations/trending — public. Returns [] (never null) when nothing is starred. */
export async function fetchTrendingOrgs(limit = 5): Promise<TrendingOrg[]> {
  const { ok, status, data } = await eventsFetch<TrendingOrg[] | ApiError>(
    `/organizations/trending?limit=${limit}`
  )
  if (!ok) throw new Error(messageFrom(data, status, "Could not load trending organizations"))
  return Array.isArray(data) ? data : []
}
