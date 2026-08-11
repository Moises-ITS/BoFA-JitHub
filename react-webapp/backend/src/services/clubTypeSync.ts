/**
 * clubTypeSync.ts — boot-time reconciler for clubs.type.
 *
 * THE CLASSIFIER IS THE SOURCE OF TRUTH, NOT THE COLUMN.
 * This runs on every boot, re-derives each club's type from its name, and
 * UPDATEs any row whose stored value disagrees. A hand-edited clubs.type WILL BE
 * OVERWRITTEN on the next deploy. That is intentional: it is precisely what
 * makes the production fix path "add the name to EXPLICIT_TYPE_BY_NAME in
 * orgClassifier.ts, write a unit case, deploy" work with no migration, no manual
 * SQL, and no downtime.
 *
 * If a genuine manual override is ever needed: set CLUB_TYPE_SYNC=off, patch the
 * row, and open a ticket to add the name to the override map. CLUB_TYPE_SYNC=off
 * is an ops kill-switch (this writes to a production table on every boot and you
 * want to be able to stop it without a code deploy), not a feature flag.
 *
 * Idempotent by construction: the second boot updates zero rows.
 */

import { db } from "../config/postgres.js"
import { resolveCanonicalClubName } from "./clubDirectory.js"
import { classifyOrgType } from "./orgClassifier.js"

export interface ClubTypeSyncResult {
  scanned: number
  updated: number
  skipped: number
}

interface TypeRow {
  club_id: number
  name: string
  type: string | null
}

export async function syncClubTypes(): Promise<ClubTypeSyncResult> {
  const startedAt = Date.now()

  if (process.env.CLUB_TYPE_SYNC === "off") {
    console.info("[orgs][type-sync]", { skippedReason: "CLUB_TYPE_SYNC=off" })
    return { scanned: 0, updated: 0, skipped: 0 }
  }

  const { rows } = await db.query<TypeRow>("SELECT c.club_id, c.name, c.type FROM clubs c")

  let updated = 0
  for (const row of rows) {
    // Classify the CANONICAL name, matching serializeClub, or a row spelled
    // "SWE" and a row spelled "Society of Women Engineers" could disagree.
    const verdict = classifyOrgType(resolveCanonicalClubName(row.name))
    if (row.type === verdict) continue

    await db.query("UPDATE clubs SET type = $1 WHERE club_id = $2", [verdict, row.club_id])
    updated++
    // One line per changed row, bounded by ~200. This is what lets you audit a
    // bad classifier deploy after the fact.
    console.info("[orgs][type-sync-change]", {
      clubId: row.club_id,
      name: row.name,
      from: row.type,
      to: verdict,
    })
  }

  const result = { scanned: rows.length, updated, skipped: rows.length - updated }
  console.info("[orgs][type-sync]", { ...result, durationMs: Date.now() - startedAt })
  return result
}
