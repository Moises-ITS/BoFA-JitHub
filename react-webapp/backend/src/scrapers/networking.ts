import { db } from '../config/postgres.js';
import { geocode } from './geocoder.js';

// Curated networking events and conferences relevant to CS / NJIT students
const SEED_EVENTS = [
  {
    title: 'Grace Hopper Celebration 2025',
    org: 'AnitaB.org',
    city: 'Philadelphia', state: 'PA',
    deadline: '2025-10-15',
    tags: ['women in tech', 'networking', 'conference'],
    description: 'World\'s largest gathering of women and non-binary technologists.',
    url: 'https://ghc.anitab.org',
  },
  {
    title: 'AfroTech Conference 2025',
    org: 'Blavity',
    city: 'Houston', state: 'TX',
    deadline: '2025-11-07',
    tags: ['black in tech', 'networking', 'conference'],
    description: 'Premier conference for Black tech professionals and entrepreneurs.',
    url: 'https://afrotech.com',
  },
  {
    title: 'NSBE Annual Convention',
    org: 'National Society of Black Engineers',
    city: 'Baltimore', state: 'MD',
    deadline: '2026-03-19',
    tags: ['engineering', 'networking', 'diversity'],
    description: 'Largest student-run conference in the country for NSBE members.',
    url: 'https://convention.nsbe.org',
  },
  {
    title: 'SHPE National Convention',
    org: 'Society of Hispanic Professional Engineers',
    city: 'Denver', state: 'CO',
    deadline: '2025-10-30',
    tags: ['hispanic', 'engineering', 'networking'],
    description: 'Premier conference for Hispanic STEM professionals and students.',
    url: 'https://convention.shpe.org',
  },
  {
    title: 'NYC Tech Meetup – Monthly',
    org: 'NYC Tech Meetup',
    city: 'New York', state: 'NY',
    deadline: null,
    tags: ['new york', 'startups', 'networking'],
    description: 'Monthly gathering of NYC\'s tech community. Demo nights, panels, and networking.',
    url: 'https://www.meetup.com/nyc-tech/',
  },
  {
    title: 'HackNJIT',
    org: 'NJIT ACM',
    city: 'Newark', state: 'NJ',
    deadline: '2025-11-01',
    tags: ['hackathon', 'njit', 'networking'],
    description: 'Annual hackathon hosted by NJIT\'s ACM chapter. Open to all students.',
    url: 'https://hacknjit.org',
  },
  {
    title: 'TechCrunch Disrupt 2025',
    org: 'TechCrunch',
    city: 'San Francisco', state: 'CA',
    deadline: '2025-10-27',
    tags: ['startups', 'vc', 'conference'],
    description: 'Premier startup conference featuring pitch competitions and networking.',
    url: 'https://techcrunch.com/events/tc-disrupt-2025/',
  },
  {
    title: 'IEEE Region 1 Student Conference',
    org: 'IEEE',
    city: 'Boston', state: 'MA',
    deadline: '2026-04-05',
    tags: ['ieee', 'engineering', 'research'],
    description: 'Regional student conference featuring technical paper presentations and networking.',
    url: 'https://ewh.ieee.org/reg/1/studentconf/',
  },
  {
    title: 'LinkedIn Local NJ',
    org: 'LinkedIn Local NJ Chapter',
    city: 'Newark', state: 'NJ',
    deadline: null,
    tags: ['new jersey', 'professional', 'networking'],
    description: 'Monthly in-person networking event for NJ professionals across industries.',
    url: 'https://www.meetup.com/linkedin-local-new-jersey/',
  },
  {
    title: 'AWS re:Invent 2025',
    org: 'Amazon Web Services',
    city: 'Las Vegas', state: 'NV',
    deadline: '2025-11-30',
    tags: ['cloud', 'aws', 'conference'],
    description: 'Annual cloud computing conference with 50,000+ attendees and student discounts.',
    url: 'https://reinvent.awsevents.com',
  },
];

// Las Vegas is not in the geocoder — add fallback inline
const EXTRA: Record<string, [number, number]> = {
  'Las Vegas': [36.1699, -115.1398],
  'Lansdowne':  [39.0873, -77.5130],
};

export async function scrapeNetworking(): Promise<number> {
  let inserted = 0;

  for (const ev of SEED_EVENTS) {
    let geo = geocode(`${ev.city}, ${ev.state}`) ?? geocode(ev.city);

    if (!geo) {
      const coords = EXTRA[ev.city];
      if (coords) {
        geo = { lat: coords[0], lng: coords[1], city: ev.city, state: ev.state };
      }
    }
    if (!geo) continue;

    try {
      await db.query(
        `INSERT INTO opportunities
           (type, title, org, city, state, lat, lng, deadline, tags, description, url, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (title, org, type) DO NOTHING`,
        [
          'networking',
          ev.title,
          ev.org,
          geo.city,
          geo.state,
          geo.lat,
          geo.lng,
          ev.deadline,
          ev.tags,
          ev.description,
          ev.url,
          'curated',
        ],
      );
      inserted++;
    } catch {
      // skip
    }
  }

  console.log(`[networking] inserted ${inserted}`);
  return inserted;
}
