# EDEN — PARKED for v2/v3

E-board club analytics: track how club events perform (Instagram engagement from the
EDEN scraper) and prepare better for future ones. Built but never fully fleshed out —
deliberately parked, not deleted.

**Nothing here is routed.** To revive:
1. Backend: set `ENABLE_EDEN=true` (mounts `/api/eden/*` in `backend/src/index.ts`) and
   provide `EDEN_DB_*` env vars (see `backend/src/config/postgres.ts`).
2. Frontend: add a lazy route for `EdenPage` in `App.tsx` and restore the e-board
   sidebar item in `pages/home/sidebar.tsx` (see the comment there).
3. Restore the `<AttendanceForm />` render in `pages/events/components/EventDetailModal.tsx`
   (comment marks the spot).
