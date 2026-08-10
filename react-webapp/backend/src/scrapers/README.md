# Opportunity scrapers — RETIRED

**Not scheduled. Nothing in this directory runs unless `ENABLE_SCRAPERS=true` is set.**

## Why

The opportunities board is **student-submitted**. `GET /api/opportunities` serves only
rows with `source = 'community'` (written by `POST /api/opportunities`), so anything these
scrapers insert is never rendered — a scheduled run would spend outbound API calls, geocoding
work, and pool connections writing rows nobody sees.

## What was here

| File | Source written | Status |
|---|---|---|
| `themuse.ts` | `themuse` | Was scheduled every 6h |
| `remotive.ts` | `remotive` | Was scheduled every 6h |
| `scholarships.ts` | `curated` | Was scheduled every 6h (static curated list) |
| `networking.ts` | `curated` | Was scheduled every 6h (static curated list) |
| `arbeitnow.ts` | `arbeitnow` | Already parked — never scheduled (live URL verification per job was too heavy) |
| `runner.ts` | — | Cron scheduler + Postgres advisory lock |
| `geocoder.ts` | — | **Still used** by `routes/opportunities.ts` to place community submissions on the map — do not delete |
| `isEnglish.ts`, `verifyUrl.ts` | — | Helpers used only by the scrapers |

## Rows left in the database

Retiring the scrapers does **not** delete what they already wrote. As of 2026-08-10 the
`opportunities` table holds:

```
arbeitnow = 129   remotive = 37   curated = 47   →  213 rows, all unserved
community = 0
```

They are filtered out at the API, not deleted, so the change is reversible: drop the
`AND source = 'community'` line in `routes/opportunities.ts` to bring them back.

To purge them permanently:

```sql
DELETE FROM opportunities WHERE source <> 'community';
```

## Re-enabling

```sh
ENABLE_SCRAPERS=true
```

Both `index.ts` and `runner.ts` check this flag. Note that re-enabling scraping alone will
**not** make the listings appear — you also have to relax the `source` filter in
`routes/opportunities.ts`, or the scraped rows will be written and then hidden.
