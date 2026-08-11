/**
 * deviceId.ts — mints and persists a stable per-browser identifier sent with
 * every Jiti chat request.
 *
 * IT IS NOT WHAT ENFORCES THE QUOTA. The backend counts prompts against the
 * authenticated user id (see backend src/services/jitiQuotaService.ts); the
 * device id is recorded for analytics only and is never read for a quota or
 * capacity decision. Keying the limit on the device would have been weaker,
 * not stronger — a student would get a fresh 5 prompts per browser, and an
 * incognito window would reset it at will.
 *
 * What it does give us: localStorage is shared across same-origin tabs, so the
 * displayed counter stays consistent when a student opens the app in a second
 * tab, which is the behaviour this id was asked for.
 *
 * Follows the same read → validate → write shape as the rest of the app's
 * localStorage usage (see lib/localCache.ts for why every call is wrapped).
 */
import { readJsonCache, writeJsonCache } from "./localCache"

const DEVICE_ID_KEY = "jithub.jiti-device-id"

function isPlausibleDeviceId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

/**
 * Returns the persisted device id, minting one on first call. Safe to call
 * from multiple components or across remounts — the id is always read back
 * from storage first, so it stays stable for the lifetime of the browser
 * profile (until localStorage is cleared).
 */
export function getDeviceId(): string {
  const existing = readJsonCache<string>(DEVICE_ID_KEY, { validate: isPlausibleDeviceId })
  if (existing) return existing

  const minted = crypto.randomUUID()
  writeJsonCache(DEVICE_ID_KEY, minted)
  return minted
}
