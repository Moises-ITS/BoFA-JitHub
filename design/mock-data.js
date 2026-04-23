// ───────────────────────────────────────────────────────────────────────────
// EDEN — Event Data Engagement Network
// Mock data layer. Matches the shape returned by the real FastAPI backend
// (BoFA-JitHub/EDEN/backend/app/routers/*). To swap to live data, replace
// the body of `api.*` functions in api.js — component contracts stay stable.
// ───────────────────────────────────────────────────────────────────────────

// --- Clubs ----------------------------------------------------------------
const CLUBS = [
  { club_id: 1,  name: 'SHPE',        handle: 'njit_shpe',     followers: 2140, bio: 'Society of Hispanic Professional Engineers — Newark chapter.' },
  { club_id: 2,  name: 'ACM',         handle: 'njit_acm',      followers: 3210, bio: 'Association for Computing Machinery. Hackathons, workshops, industry panels.' },
  { club_id: 3,  name: 'IEEE',        handle: 'njit_ieee',     followers: 1870, bio: 'Electrical and Electronics Engineers student chapter.' },
  { club_id: 4,  name: 'NSBE',        handle: 'njit_nsbe',     followers: 1630, bio: 'National Society of Black Engineers.' },
  { club_id: 5,  name: 'SWE',         handle: 'njit_swe',      followers: 1480, bio: 'Society of Women Engineers.' },
  { club_id: 6,  name: 'GDSC',        handle: 'gdsc_njit',     followers: 1205, bio: 'Google Developer Student Club.' },
  { club_id: 7,  name: 'Robotics',    handle: 'njit_robotics', followers: 945,  bio: 'Robotics club. Combat bots, FRC, autonomous vehicle team.' },
  { club_id: 8,  name: 'BMES',        handle: 'njit_bmes',     followers: 820,  bio: 'Biomedical Engineering Society.' },
  { club_id: 9,  name: 'ASME',        handle: 'njit_asme',     followers: 760,  bio: 'American Society of Mechanical Engineers.' },
  { club_id: 10, name: 'CSE Society', handle: 'njit_cse',      followers: 1340, bio: 'Computer Science & Engineering Society.' },
];

// --- Events (mix of past + upcoming) --------------------------------------
// Seed: late Fall 2025 → Spring 2026 events as of 2026-04-23.
// Dates relative to "today" = 2026-04-23.
const CATS = ['social','exposure','info session','workshop','recruiting','conference','hackathon','general meeting','volunteering','fundraiser','study support','site tour'];
const LOCS = ['Campus Center', 'GITC', 'CKB', 'Kupfrian', 'Tiernan', 'Fenster', 'Eberhardt', 'Weston Hall'];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function seedRng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function genEvents() {
  const rng = seedRng(42);
  const today = new Date('2026-04-23');
  const evs = [];
  let id = 100;
  // Past 180 days of events
  for (let dOff = -180; dOff <= 30; dOff += 1) {
    // 0-3 events per day
    const n = Math.floor(rng() * 3.5);
    for (let i = 0; i < n; i++) {
      const d = new Date(today); d.setDate(d.getDate() + dOff);
      const club = CLUBS[Math.floor(rng() * CLUBS.length)];
      const cat = CATS[Math.floor(rng() * CATS.length)];
      const isFuture = dOff > 0;
      const hour = 11 + Math.floor(rng() * 9);
      const engage = isFuture ? null : +(0.3 + rng() * 3.2).toFixed(3); // ratio ≈ 0.3..3.5
      evs.push({
        event_id: id++,
        club_id: club.club_id,
        club_name: club.name,
        event_name: pickName(cat, club.name, rng),
        event_category: cat,
        date: d.toISOString().slice(0,10),
        day_of_week: DAYS[(d.getDay() + 6) % 7],
        start_time: `${String(hour).padStart(2,'0')}:00`,
        end_time: `${String(hour+2).padStart(2,'0')}:00`,
        campus_location: LOCS[Math.floor(rng() * LOCS.length)],
        has_free_food: rng() < 0.42,
        virtual: rng() < 0.12,
        is_external: rng() < 0.08,
        days_until_midterm: Math.abs(((dOff % 50) - 25)) | 0,
        recap_engagement_score: engage,
        predicted_engagement_score: isFuture ? +(0.6 + rng() * 2.1).toFixed(3) : null,
        collaborators: rng() < 0.22 ? [CLUBS[Math.floor(rng()*CLUBS.length)].name] : [],
        sponsors: rng() < 0.15 ? ['Google','Microsoft','JPMC','PSEG'][Math.floor(rng()*4)] ? [['Google','Microsoft','JPMC','PSEG'][Math.floor(rng()*4)]] : [] : [],
        posts: genPosts(id, isFuture, engage, rng),
      });
    }
  }
  return evs;
}

function pickName(cat, club, rng) {
  const nouns = {
    'hackathon': ['HackNJIT', '24-hr Build Jam', 'MakeNJIT'],
    'workshop': ['Resume Workshop', 'Algo Bootcamp', 'CAD Crash Course', 'SQL Intensive', 'Figma Basics'],
    'info session': ['Industry Panel', 'Grad School Info', 'Research Panel', 'Alumni Q&A'],
    'recruiting': ['Career Fair Prep', 'Mock Interviews', 'Resume Review Night', 'Recruiter Mixer'],
    'social': ['Game Night', 'Study Jam', 'Movie Night', 'Welcome Back', 'End-of-Year Social'],
    'exposure': ['Involvement Fair', 'Club Showcase', 'Tabling Day'],
    'conference': ['Regional Conference', 'NSBE Regionals', 'SHPE National Prep'],
    'general meeting': ['GBM', 'Member Meeting'],
    'volunteering': ['Service Day', 'Food Drive', 'Newark Cleanup'],
    'fundraiser': ['Bake Sale', 'Merch Drop', 'Raffle Night'],
    'study support': ['Midterm Review', 'Exam Prep', 'Tutoring Night'],
    'site tour': ['Google Tour', 'JPMC Site Visit', 'Microsoft Office Visit'],
  };
  const ns = nouns[cat] || ['Event'];
  return `${club} ${ns[Math.floor(rng()*ns.length)]}`;
}

function genPosts(seed, isFuture, baseScore, rng) {
  if (isFuture) return [];
  // 1-3 posts per event: promo, day-of, recap
  const posts = [];
  const types = ['promo','day-of','recap'];
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    posts.push({
      post_id: seed * 10 + i,
      post_type: types[i] || 'promo',
      likes: Math.floor(40 + rng() * 350 * (baseScore || 1)),
      comments: Math.floor(rng() * 30),
      engagement_score: +(((baseScore || 1) + (rng() - 0.5) * 0.4)).toFixed(3),
    });
  }
  return posts;
}

const EVENTS = genEvents();

// --- Collaborations -------------------------------------------------------
const COLLABS = EVENTS.filter(e => e.collaborators?.length).map(e => ({
  event_id: e.event_id, a: e.club_name, b: e.collaborators[0], date: e.date,
}));

// --- RSVPs (mock) ---------------------------------------------------------
const MAJORS = ['CS','IT','EE','ME','CE','BME','BA','Arch','DS','MA','ChE','PhD'];
const INTERESTS = ['AI','HCI','Robotics','Entrepreneurship','Gaming','Music','Design','Research','Sports','Cultural'];
function genRsvps() {
  const rng = seedRng(99);
  const out = [];
  for (const e of EVENTS) {
    const base = e.date >= '2026-04-23' ? 20 + rng() * 80 : 0; // only future events have RSVPs
    const count = Math.floor(base);
    for (let i = 0; i < count; i++) {
      out.push({
        event_id: e.event_id,
        user_id: `u${i}_${e.event_id}`,
        user_name: ['Alex','Priya','Jordan','Sam','Taylor','Morgan','Casey','Riley'][Math.floor(rng()*8)] + ' ' + String.fromCharCode(65+Math.floor(rng()*26)) + '.',
        user_major: MAJORS[Math.floor(rng()*MAJORS.length)],
        user_interests: Array.from({length: 1+Math.floor(rng()*3)}, () => INTERESTS[Math.floor(rng()*INTERESTS.length)]).join(','),
        status: rng() < 0.9 ? 'going' : 'maybe',
      });
    }
  }
  return out;
}
const RSVPS = genRsvps();

// --- Export all -----------------------------------------------------------
window.EDEN_MOCK = { CLUBS, EVENTS, COLLABS, RSVPS, CATS, LOCS, DAYS, MAJORS, INTERESTS };
