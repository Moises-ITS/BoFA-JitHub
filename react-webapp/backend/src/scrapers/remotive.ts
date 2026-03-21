import { db } from '../config/postgres.js';
import { geocode } from './geocoder.js';

interface RemotiveJob {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location: string;
  url: string;
  description: string;
  tags: string[];
  salary?: string;
  job_type: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

const CATEGORIES = ['software-dev', 'data', 'devops-sysadmin'];

export async function scrapeRemotive(): Promise<number> {
  let inserted = 0;

  for (const cat of CATEGORIES) {
    let data: RemotiveResponse;
    try {
      const res = await fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=50`);
      if (!res.ok) continue;
      data = await res.json() as RemotiveResponse;
    } catch {
      console.error('[remotive] fetch error for category', cat);
      continue;
    }

    for (const job of data.jobs) {
      // Prefer specific US city, fall back to Remote centroid
      const locationStr = job.candidate_required_location ?? 'Remote';
      const isUsOrRemote =
        locationStr.toLowerCase().includes('usa') ||
        locationStr.toLowerCase().includes('us') ||
        locationStr.toLowerCase().includes('remote') ||
        locationStr === '';

      if (!isUsOrRemote) continue;

      const geo = geocode(locationStr) ?? geocode('Remote');
      if (!geo) continue;

      const tags = (job.tags ?? []).slice(0, 8).map((t: string) => t.toLowerCase());

      try {
        await db.query(
          `INSERT INTO opportunities
             (type, title, org, city, state, lat, lng, stipend, tags, description, url, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (title, org, type) DO NOTHING`,
          [
            'internship',
            job.title.slice(0, 200),
            job.company_name,
            geo.city,
            geo.state,
            geo.lat,
            geo.lng,
            job.salary ?? null,
            tags,
            job.description.replace(/<[^>]+>/g, '').slice(0, 500),
            job.url,
            'remotive',
          ],
        );
        inserted++;
      } catch {
        // skip
      }
    }
  }

  console.log(`[remotive] inserted ${inserted}`);
  return inserted;
}
