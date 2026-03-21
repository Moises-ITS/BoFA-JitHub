import { db } from '../config/postgres.js';
import { geocode } from './geocoder.js';

interface MuseJob {
  id: number;
  name: string;
  company: { name: string };
  locations: { name: string }[];
  refs: { landing_page: string };
  contents?: string;
}

interface MuseResponse {
  results: MuseJob[];
  page_count: number;
}

export async function scrapeTheMuse(): Promise<number> {
  let inserted = 0;

  // Fetch first 3 pages of tech internships
  for (let page = 0; page < 3; page++) {
    const url =
      `https://www.themuse.com/api/public/jobs?category=Engineering&level=Internship&page=${page}&api_key=public`;

    let data: MuseResponse;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      data = await res.json() as MuseResponse;
    } catch {
      console.error('[themuse] fetch error page', page);
      break;
    }

    for (const job of data.results) {
      const locationStr = job.locations?.[0]?.name ?? '';
      const geo = geocode(locationStr) ?? geocode('Remote');
      if (!geo) continue;

      try {
        await db.query(
          `INSERT INTO opportunities
             (type, title, org, city, state, lat, lng, tags, description, url, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (title, org, type) DO NOTHING`,
          [
            'internship',
            job.name.slice(0, 200),
            job.company.name,
            geo.city,
            geo.state,
            geo.lat,
            geo.lng,
            ['engineering', 'tech'],
            (job.contents ?? '').replace(/<[^>]+>/g, '').slice(0, 500),
            job.refs.landing_page,
            'themuse',
          ],
        );
        inserted++;
      } catch {
        // skip duplicates / constraint errors
      }
    }

    if (page >= data.page_count - 1) break;
  }

  console.log(`[themuse] inserted ${inserted}`);
  return inserted;
}
