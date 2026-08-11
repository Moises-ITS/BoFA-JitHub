// ─────────────────────────────────────────────────────────────────────────────
// deviceId.test.ts — proves the minted id is stable across repeated calls and
// across "remounts" (fresh call sites reading only from localStorage, no
// in-memory state carried over).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from "vitest"
import { getDeviceId } from "./deviceId"

const DEVICE_ID_KEY = "jithub.jiti-device-id"

describe("getDeviceId", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns the same value across repeated calls", () => {
    const first = getDeviceId()
    const second = getDeviceId()
    const third = getDeviceId()

    expect(first).toBe(second)
    expect(second).toBe(third)
    expect(first.length).toBeGreaterThan(0)
  })

  it("persists across remounts — a later call reads the same id back out of localStorage", () => {
    const minted = getDeviceId()

    // Simulate a component remount: no in-memory reference to `minted` is
    // kept, only the fact that getDeviceId() is called again.
    const reread = getDeviceId()

    expect(reread).toBe(minted)
    const raw = window.localStorage.getItem(DEVICE_ID_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).value).toBe(minted)
  })

  it("mints a fresh id if localStorage has never seen this key before", () => {
    expect(window.localStorage.getItem(DEVICE_ID_KEY)).toBeNull()
    const id = getDeviceId()
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })
})
