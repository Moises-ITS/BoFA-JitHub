/**
 * deviceId.ts — mints and persists a stable per-browser identifier used by
 * the Jiti chat widget's daily quota. The backend rate-limits "by device"
 * (in addition to any account-level limits) so a student can't reset their
 * 5-prompt daily cap just by opening a new tab or logging in again in the
 * same browser — localStorage is shared across same-origin tabs, so one
 * minted id is inherently consistent everywhere this browser profile goes.
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
