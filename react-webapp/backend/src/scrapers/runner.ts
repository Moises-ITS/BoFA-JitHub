import cron from 'node-cron';
import { scrapeTheMuse }    from './themuse.js';
import { scrapeRemotive }   from './remotive.js';
import { scrapeScholarships } from './scholarships.js';
import { scrapeNetworking } from './networking.js';

export async function runAllScrapers(): Promise<void> {
  console.log('[scrapers] starting run...');
  await Promise.allSettled([
    scrapeTheMuse(),
    scrapeRemotive(),
    scrapeScholarships(),
    scrapeNetworking(),
  ]);
  console.log('[scrapers] run complete');
}

/** Start the cron scheduler — re-scrapes every 6 hours */
export function startScheduler(): void {
  // Run once immediately on startup
  runAllScrapers().catch(err => console.error('[scrapers] initial run failed:', err));

  // Then every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runAllScrapers().catch(err => console.error('[scrapers] scheduled run failed:', err));
  });

  console.log('[scrapers] scheduler started (every 6 h)');
}
