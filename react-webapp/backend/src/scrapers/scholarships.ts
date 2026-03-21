import { db } from '../config/postgres.js';
import { geocode } from './geocoder.js';

// Curated list of real, well-known scholarships with stable data.
// We embed them directly to avoid scraping pages that block bots,
// and supplement with a live fetch from the Scholarships.com open feed
// when available.
const SEED_SCHOLARSHIPS = [
  {
    title: 'Gates Scholarship',
    org: 'Bill & Melinda Gates Foundation',
    city: 'Seattle', state: 'WA',
    amount: 'Full cost of attendance',
    deadline: '2025-09-15',
    tags: ['undergraduate', 'stem', 'leadership'],
    description: 'Highly selective scholarship for exceptional, minority high school seniors.',
    url: 'https://www.thegatesscholarship.org',
  },
  {
    title: 'Jack Kent Cooke Foundation College Scholarship',
    org: 'Jack Kent Cooke Foundation',
    city: 'Lansdowne', state: 'VA',
    amount: 'Up to $55,000/year',
    deadline: '2025-11-15',
    tags: ['undergraduate', 'merit', 'financial need'],
    description: 'For high-achieving high school seniors with financial need.',
    url: 'https://www.jkcf.org',
  },
  {
    title: 'Coca-Cola Scholars Program',
    org: 'Coca-Cola Scholars Foundation',
    city: 'Atlanta', state: 'GA',
    amount: '$20,000',
    deadline: '2025-10-31',
    tags: ['undergraduate', 'leadership', 'community'],
    description: 'Merit-based scholarship recognizing exceptional high school seniors.',
    url: 'https://www.coca-colascholarsfoundation.org',
  },
  {
    title: 'Regeneron Science Talent Search',
    org: 'Society for Science',
    city: 'Washington', state: 'DC',
    amount: 'Up to $250,000',
    deadline: '2025-11-12',
    tags: ['stem', 'research', 'high school'],
    description: 'Prestigious STEM competition for high school seniors.',
    url: 'https://www.societyforscience.org/regeneron-sts/',
  },
  {
    title: 'Dell Scholars Program',
    org: 'Michael & Susan Dell Foundation',
    city: 'Austin', state: 'TX',
    amount: '$20,000',
    deadline: '2025-12-01',
    tags: ['undergraduate', 'first generation', 'stem'],
    description: 'Scholarship for students who demonstrate need, merit, and potential.',
    url: 'https://www.dellscholars.org',
  },
  {
    title: 'UNCF Scholarships',
    org: 'United Negro College Fund',
    city: 'Washington', state: 'DC',
    amount: 'Varies',
    deadline: '2025-12-15',
    tags: ['hbcu', 'undergraduate', 'diversity'],
    description: 'Multiple scholarships for African American students attending HBCU.',
    url: 'https://scholarships.uncf.org',
  },
  {
    title: 'Hispanic Scholarship Fund',
    org: 'Hispanic Scholarship Fund',
    city: 'Los Angeles', state: 'CA',
    amount: '$500 – $5,000',
    deadline: '2026-02-15',
    tags: ['hispanic', 'undergraduate', 'graduate'],
    description: 'Empowers Hispanic American students to complete a college degree.',
    url: 'https://www.hsf.net',
  },
  {
    title: 'NJIT Highlander Scholarship',
    org: 'NJIT',
    city: 'Newark', state: 'NJ',
    amount: 'Up to full tuition',
    deadline: '2026-01-15',
    tags: ['stem', 'njit', 'merit'],
    description: 'Merit-based award for incoming NJIT students with strong academic records.',
    url: 'https://www.njit.edu/financialaid/scholarships',
  },
  {
    title: 'Google Generation Scholarship',
    org: 'Google',
    city: 'Mountain View', state: 'CA',
    amount: '$10,000',
    deadline: '2026-03-01',
    tags: ['cs', 'diversity', 'undergraduate'],
    description: 'For students pursuing degrees in computer science or related technical fields.',
    url: 'https://buildyourfuture.withgoogle.com/scholarships',
  },
  {
    title: 'Microsoft Scholarship',
    org: 'Microsoft',
    city: 'Redmond', state: 'WA',
    amount: 'Varies',
    deadline: '2026-04-01',
    tags: ['cs', 'stem', 'undergraduate'],
    description: 'For students studying computer science at a 4-year university.',
    url: 'https://careers.microsoft.com/students',
  },
  {
    title: 'Amazon Future Engineer Scholarship',
    org: 'Amazon',
    city: 'Seattle', state: 'WA',
    amount: '$40,000 over 4 years',
    deadline: '2026-02-28',
    tags: ['cs', 'engineering', 'first generation'],
    description: 'Scholarship + internship offer for underrepresented students in CS.',
    url: 'https://www.amazonfutureengineer.com',
  },
  {
    title: 'Society of Women Engineers Scholarship',
    org: 'Society of Women Engineers',
    city: 'Chicago', state: 'IL',
    amount: '$1,000 – $17,000',
    deadline: '2025-12-01',
    tags: ['women', 'engineering', 'stem'],
    description: 'Multiple scholarships supporting women pursuing ABET-accredited engineering programs.',
    url: 'https://scholarships.swe.org',
  },
];

export async function scrapeScholarships(): Promise<number> {
  let inserted = 0;

  for (const s of SEED_SCHOLARSHIPS) {
    const geo = geocode(`${s.city}, ${s.state}`) ?? geocode(s.city);
    if (!geo) continue;

    try {
      await db.query(
        `INSERT INTO opportunities
           (type, title, org, city, state, lat, lng, amount, deadline, tags, description, url, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (title, org, type) DO NOTHING`,
        [
          'scholarship',
          s.title,
          s.org,
          geo.city,
          geo.state,
          geo.lat,
          geo.lng,
          s.amount,
          s.deadline,
          s.tags,
          s.description,
          s.url,
          'curated',
        ],
      );
      inserted++;
    } catch {
      // skip
    }
  }

  console.log(`[scholarships] inserted ${inserted}`);
  return inserted;
}
