import cron from 'node-cron';
import { db } from '../config/postgres.js';
import { scrapeTheMuse }    from './themuse.js';
import { scrapeRemotive }   from './remotive.js';
import { scrapeScholarships } from './scholarships.js';
import { scrapeNetworking } from './networking.js';
// NOTE: scrapers/arbeitnow.ts exists but is intentionally NOT scheduled — it
// performs a live URL-verification round-trip per job (~200 jobs), which is
// too heavy for a pool shared with live student traffic. Parked until it can
// run out-of-process.

/**
 * Arbitrary-but-fixed key identifying "the scraper job" for Postgres advisory
 * locking. Any constant works; it just has to be the same on every instance.
 */
const SCRAPER_LOCK_KEY = 815_2026;

export async function runAllScrapers(): Promise<void> {
  // DESIGN: Postgres advisory lock as poor-man's leader election. The
  // scheduler runs in-process on EVERY backend instance; without coordination,
  // scaling to N instances means N identical scrape runs — N× the outbound
  // API calls (rate-limit risk with TheMuse/Remotive) and N× the write load,
  // all deduped only by ON CONFLICT. pg_try_advisory_lock is non-blocking:
  // whichever instance gets there first does the work, the rest skip with a
  // log line. Session-scoped, so we hold one dedicated connection for the
  // duration and the lock dies with it even if the process crashes mid-run.
  const client = await db.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [SCRAPER_LOCK_KEY]);
    if (!lock.rows[0]?.acquired) {
      console.log('[scrapers] another instance holds the scrape lock — skipping this run');
      return;
    }
    console.log('[scrapers] starting run...');
    await Promise.allSettled([
      scrapeTheMuse(),
      scrapeRemotive(),
      scrapeScholarships(),
      scrapeNetworking(),
    ]);
    console.log('[scrapers] run complete');
    await client.query('SELECT pg_advisory_unlock($1)', [SCRAPER_LOCK_KEY]);
  } finally {
    // Releasing the client also releases the advisory lock if the unlock
    // above didn't run (thrown error) — session-scoped locks die with the
    // session, so a crashed run can never wedge future runs.
    client.release();
  }
}

/** Start the cron scheduler — re-scrapes every 6 hours */
export function startScheduler(): void {
  // Kill switch: lets an operator disable scraping entirely (e.g. a worker-
  // only deployment topology, or an incident with an upstream API) without a
  // code change. Default is ON so current single-instance behavior is unchanged.
  if (process.env.ENABLE_SCRAPERS === 'false') {
    console.log('[scrapers] disabled via ENABLE_SCRAPERS=false');
    return;
  }

  // Run once immediately on startup
  runAllScrapers().catch(err => console.error('[scrapers] initial run failed:', err));

  // Then every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runAllScrapers().catch(err => console.error('[scrapers] scheduled run failed:', err));
  });

  console.log('[scrapers] scheduler started (every 6 h)');
}
