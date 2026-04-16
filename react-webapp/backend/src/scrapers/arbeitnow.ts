/**
 * Arbeitnow — free worldwide tech job board API (no key required).
 * Docs: https://arbeitnow.com/api
 */
import { db } from '../config/postgres.js';
import { geocode } from './geocoder.js';
import { verifyEnglishUrl } from './verifyUrl.js';
import { isEnglish } from './isEnglish.js';

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number;
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[];
  links: { next?: string };
}

export async function scrapeArbeitnow(): Promise<number> {
  let inserted = 0;
  let nextUrl: string | null = 'https://arbeitnow.com/api/job-board-api?page=1';

  // Fetch up to 10 pages (~200 jobs)
  for (let page = 0; page < 10 && nextUrl; page++) {
    let data: ArbeitnowResponse;
    try {
      const res = await fetch(nextUrl);
      if (!res.ok) break;
      data = await res.json() as ArbeitnowResponse;
    } catch {
      console.error('[arbeitnow] fetch error page', page);
      break;
    }

    for (const job of data.data) {
      const locationStr = job.remote ? 'Remote' : (job.location || 'Remote');
      const geo = geocode(locationStr)
        ?? geocode(locationStr.split(',')[0].trim())
        ?? geocode('Worldwide');
      if (!geo) continue;

      // Skip non-English listings (Arbeitnow has many German/French jobs)
      const plainDesc = job.description.replace(/<[^>]+>/g, '');
      if (!isEnglish(job.title) || !isEnglish(plainDesc)) {
        console.warn(`[arbeitnow] non-English listing skipped: ${job.title}`);
        continue;
      }

      const ok = await verifyEnglishUrl(job.url);
      if (!ok) {
        console.warn(`[arbeitnow] dead/non-english link skipped: ${job.url}`);
        continue;
      }

      const tags = (job.tags ?? []).slice(0, 8).map((t) => t.toLowerCase());

      try {
        await db.query(
          `INSERT INTO opportunities
             (type, title, org, city, state, lat, lng, tags, description, url, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (title, org, type) DO NOTHING`,
          [
            'internship',
            job.title.slice(0, 200),
            job.company_name,
            geo.city,
            geo.state,
            geo.lat,
            geo.lng,
            tags,
            plainDesc.slice(0, 500),
            job.url,
            'arbeitnow',
          ],
        );
        inserted++;
      } catch {
        // skip
      }
    }

    nextUrl = data.links?.next ?? null;
  }

  console.log(`[arbeitnow] inserted ${inserted}`);
  return inserted;
}
