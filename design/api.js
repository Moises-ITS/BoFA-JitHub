// ───────────────────────────────────────────────────────────────────────────
// EDEN — API layer
// Single choke point for data access. Swap these bodies to hit FastAPI later:
//   GET /clubs               → api.listClubs()
//   GET /events              → api.listEvents()
//   GET /events/:id          → api.getEvent(id)
//   GET /events/:id/forecast → api.forecast(id)   ← Monte-Carlo
//   GET /rsvp/:event_id      → api.listRsvps(id)
// ───────────────────────────────────────────────────────────────────────────

(function() {
  const { CLUBS, EVENTS, COLLABS, RSVPS, CATS } = window.EDEN_MOCK;
  const today = '2026-04-23';

  // ── Basic selectors ─────────────────────────────────────────────────────
  const listClubs   = () => CLUBS.slice().sort((a,b) => b.followers - a.followers);
  const listEvents  = (opts = {}) => {
    let evs = EVENTS;
    if (opts.clubId)     evs = evs.filter(e => e.club_id === opts.clubId);
    if (opts.category)   evs = evs.filter(e => e.event_category === opts.category);
    if (opts.past)       evs = evs.filter(e => e.date <= today && e.recap_engagement_score != null);
    if (opts.upcoming)   evs = evs.filter(e => e.date > today);
    if (opts.since)      evs = evs.filter(e => e.date >= opts.since);
    return evs.sort((a,b) => a.date.localeCompare(b.date));
  };
  const getEvent    = (id) => EVENTS.find(e => e.event_id === id);
  const getClub     = (id) => CLUBS.find(c => c.club_id === id);
  const listRsvps   = (id) => RSVPS.filter(r => r.event_id === id);

  // ── Club-level aggregates ───────────────────────────────────────────────
  function clubStats(clubId, windowDays = 90) {
    const since = daysAgo(today, windowDays);
    const past = listEvents({ clubId, past: true, since });
    const engSeries = past.map(e => ({ date: e.date, score: +e.recap_engagement_score }));
    const avg = engSeries.length ? mean(engSeries.map(p => p.score)) : 0;
    const stddev = engSeries.length > 1 ? std(engSeries.map(p => p.score)) : 0;
    const prev = listEvents({ clubId, past: true }).filter(e => e.date < since);
    const prevAvg = prev.length ? mean(prev.map(p => +p.recap_engagement_score)) : 0;
    const trend = prevAvg ? (avg - prevAvg) / prevAvg : 0;
    const catMix = {};
    for (const e of past) catMix[e.event_category] = (catMix[e.event_category] || 0) + 1;
    return { avg, stddev, trend, series: engSeries, total: past.length, catMix };
  }

  // ── Monte-Carlo forecast ────────────────────────────────────────────────
  // Takes an upcoming event, pulls club's historical recap_engagement_score
  // distribution, adjusts mean by learned feature deltas (day-of-week, food,
  // category, location, days-until-midterm), and runs N trials against a
  // normal resample of residuals. Returns paths + summary stats.
  function forecast(eventId, opts = {}) {
    const N = opts.trials || 1000;
    const ev = getEvent(eventId);
    if (!ev) return null;
    const history = listEvents({ clubId: ev.club_id, past: true });
    if (history.length < 3) return null;

    const hs = history.map(h => +h.recap_engagement_score);
    const mu = mean(hs);
    const sigma = std(hs) || 0.3;

    // Feature deltas — mocked as if learned from regression.
    let delta = 0;
    if (ev.has_free_food) delta += 0.22;
    if (ev.virtual)       delta -= 0.15;
    if (['hackathon','social','workshop'].includes(ev.event_category)) delta += 0.12;
    if (['general meeting','fundraiser'].includes(ev.event_category)) delta -= 0.18;
    if (ev.day_of_week === 'Friday')   delta -= 0.10;
    if (ev.day_of_week === 'Wednesday') delta += 0.08;
    if (ev.day_of_week === 'Tuesday')   delta += 0.05;
    const midtermPenalty = Math.max(0, 5 - (ev.days_until_midterm || 50)) * 0.04;
    delta -= midtermPenalty;

    // Apply user overrides from what-if simulator
    if (opts.overrides) {
      const o = opts.overrides;
      if (typeof o.has_free_food === 'boolean') {
        delta -= ev.has_free_food ? 0.22 : 0;
        delta += o.has_free_food ? 0.22 : 0;
      }
      if (o.day_of_week && o.day_of_week !== ev.day_of_week) {
        const deltaDay = { Friday: -0.10, Wednesday: 0.08, Tuesday: 0.05 };
        delta -= deltaDay[ev.day_of_week] || 0;
        delta += deltaDay[o.day_of_week] || 0;
      }
      if (o.category && o.category !== ev.event_category) {
        const up = ['hackathon','social','workshop'], down = ['general meeting','fundraiser'];
        delta -= up.includes(ev.event_category) ? 0.12 : (down.includes(ev.event_category) ? -0.18 : 0);
        delta += up.includes(o.category) ? 0.12 : (down.includes(o.category) ? -0.18 : 0);
      }
    }

    // Run trials — box-muller for normal samples
    const predictedMu = mu + delta;
    const samples = [];
    for (let i = 0; i < N; i++) {
      const u1 = Math.random() || 1e-9, u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      samples.push(Math.max(0, predictedMu + z * sigma));
    }
    samples.sort((a,b) => a-b);
    const p = (q) => samples[Math.floor(q * N)];

    // Generate time paths — N sample lines from now to event day, as proxy for promo curve
    const days = Math.max(1, daysBetween(today, ev.date));
    const paths = [];
    for (let i = 0; i < 40; i++) {
      const end = samples[Math.floor(Math.random() * N)];
      const path = [];
      let v = mu;
      for (let d = 0; d <= days; d++) {
        v += (end - v) * (0.15 + Math.random() * 0.05) + (Math.random() - 0.5) * sigma * 0.3;
        path.push({ day: d, value: Math.max(0, v) });
      }
      paths.push(path);
    }

    // Tornado — rank feature impacts
    const tornado = [
      { feature: 'Free food',          low: -0.22, high: +0.22 },
      { feature: 'Day of week',        low: -0.10, high: +0.08 },
      { feature: 'Category fit',       low: -0.18, high: +0.12 },
      { feature: 'Virtual vs. in-person', low: -0.15, high: 0 },
      { feature: 'Proximity to midterms', low: -0.20, high: 0 },
      { feature: 'Location draw',      low: -0.06, high: +0.07 },
    ].sort((a,b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));

    return {
      event: ev,
      trials: N,
      mu: predictedMu,
      sigma,
      p10: p(0.10), p25: p(0.25), p50: p(0.50), p75: p(0.75), p90: p(0.90),
      samples,
      paths,
      tornado,
      historicalMu: mu,
    };
  }

  // ── Club comparison ─────────────────────────────────────────────────────
  function clubComparison(clubId) {
    const me = clubStats(clubId);
    const peers = CLUBS.map(c => ({
      club_id: c.club_id,
      name: c.name,
      followers: c.followers,
      ...clubStats(c.club_id),
    }));
    const sortedByEng = [...peers].sort((a,b) => a.avg - b.avg);
    const myRank = sortedByEng.findIndex(p => p.club_id === clubId);
    const percentile = Math.round((myRank / (sortedByEng.length - 1)) * 100);
    return { me, peers, percentile, rank: sortedByEng.length - myRank };
  }

  // ── Collaboration graph ─────────────────────────────────────────────────
  function collabGraph() {
    const nodes = CLUBS.map(c => ({ id: c.name, followers: c.followers }));
    const edgeMap = new Map();
    for (const c of COLLABS) {
      if (!c.a || !c.b) continue;
      const key = [c.a, c.b].sort().join('—');
      const e = edgeMap.get(key) || { source: c.a, target: c.b, weight: 0, events: [] };
      e.weight += 1;
      e.events.push(c.event_id);
      edgeMap.set(key, e);
    }
    return { nodes, edges: [...edgeMap.values()] };
  }

  // ── RSVP analytics ──────────────────────────────────────────────────────
  function rsvpBreakdown(eventId) {
    const rs = listRsvps(eventId);
    const byMajor = {};
    const byInterest = {};
    for (const r of rs) {
      byMajor[r.user_major] = (byMajor[r.user_major] || 0) + 1;
      for (const i of (r.user_interests || '').split(',')) {
        if (i) byInterest[i] = (byInterest[i] || 0) + 1;
      }
    }
    return { total: rs.length, byMajor, byInterest, rsvps: rs };
  }

  // ── Anomalies ───────────────────────────────────────────────────────────
  function anomalies() {
    const out = [];
    for (const c of CLUBS) {
      const s = clubStats(c.club_id, 30);
      if (s.series.length < 3) continue;
      const last = s.series[s.series.length - 1];
      const prior = s.series.slice(0, -1);
      if (!prior.length) continue;
      const mu2 = mean(prior.map(p => p.score));
      const sd2 = std(prior.map(p => p.score)) || 0.3;
      const z = (last.score - mu2) / sd2;
      if (Math.abs(z) >= 1.5) {
        out.push({
          club: c.name, club_id: c.club_id,
          kind: z > 0 ? 'surge' : 'dip',
          magnitude: Math.abs(z),
          last, mu2,
        });
      }
    }
    return out.sort((a,b) => b.magnitude - a.magnitude);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function mean(a) { return a.reduce((s,x) => s+x, 0) / a.length; }
  function std(a)  { const m = mean(a); return Math.sqrt(mean(a.map(x => (x-m)**2))); }
  function daysAgo(iso, d) { const x = new Date(iso); x.setDate(x.getDate() - d); return x.toISOString().slice(0,10); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / (1000*60*60*24)); }

  window.EDEN_API = {
    listClubs, listEvents, getEvent, getClub, listRsvps,
    clubStats, forecast, clubComparison, collabGraph, rsvpBreakdown, anomalies,
  };
})();
