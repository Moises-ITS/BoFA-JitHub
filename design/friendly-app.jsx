/* eslint-disable */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const api = window.EDEN_API;
const charts = window.EDEN_CHARTS;
const M = window.EDEN_MOCK;

const ICONS = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  forecast: 'M3 12c3 0 3-7 6-7s3 14 6 14 3-7 6-7',
  event:    'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  compare:  'M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5',
  whatif:   'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  graph:    'M5 19a3 3 0 100-6 3 3 0 000 6zM19 8a3 3 0 100-6 3 3 0 000 6zM19 19a3 3 0 100-6 3 3 0 000 6zM7.5 14.5l3-3M15 8l-2 2M15 16l-2-2',
  rsvp:     'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
};

const PAGES = [
  { id: 'overview', label: 'Overview',       desc: 'How is engagement trending this semester?' },
  { id: 'forecast', label: 'Forecast Event', desc: 'Predict engagement for an upcoming event.' },
  { id: 'event',    label: 'Event Review',   desc: 'Deep-dive on a past event.' },
  { id: 'compare',  label: 'Club Comparison',desc: 'Benchmark your club against peers.' },
  { id: 'whatif',   label: 'What-If Planner',desc: 'Tweak event details and see what happens.' },
  { id: 'graph',    label: 'Collaborations', desc: 'See who co-hosts and suggested partners.' },
  { id: 'rsvp',     label: 'Audience',       desc: 'Who is RSVPing and what interests they share.' },
];

const Icon = ({ d }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

function useChart(fn, deps) {
  const r = useRef(null);
  useEffect(() => {
    if (!r.current) return;
    const run = () => fn(r.current);
    run();
    const ro = new ResizeObserver(run); ro.observe(r.current);
    return () => ro.disconnect();
  }, deps);
  return r;
}

// ── Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  return (
    <aside className="side">
      <div className="side-brand">
        <div className="logo">E</div>
        <div>
          <div className="t1">EDEN</div>
          <div className="t2">E-Board Analytics</div>
        </div>
      </div>
      <div className="side-section">Dashboard</div>
      <nav className="side-nav">
        {PAGES.map(p => (
          <button key={p.id} className={'nav-btn' + (page === p.id ? ' active' : '')} onClick={() => setPage(p.id)}>
            <Icon d={ICONS[p.id]} />
            {p.label}
            {p.id === 'forecast' && <span className="badge">MC</span>}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <div className="av">AK</div>
        <div>
          <div className="nm">Arjun K.</div>
          <div className="rl">President · ACM</div>
        </div>
      </div>
    </aside>
  );
}

// ── KPI ──────────────────────────────────────────────────────────────
function Kpi({ label, value, delta, dir, spark }) {
  const r = useChart(svg => spark && charts.sparkline(svg, spark), [spark]);
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {delta && <div className={'d ' + (dir || 'flat')}>{dir === 'up' ? '↑' : dir === 'down' ? '↓' : '·'} {delta}</div>}
      {spark && <svg ref={r} className="spark" />}
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────
function Overview({ go }) {
  const anomalies = useMemo(() => api.anomalies(), []);
  const topEvents = useMemo(() =>
    api.listEvents({ past: true }).sort((a,b) => +b.recap_engagement_score - +a.recap_engagement_score).slice(0, 8), []
  );
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }).slice(0, 5), []);
  const engSeries = useMemo(() => {
    const by = {};
    for (const e of api.listEvents({ past: true })) {
      if (e.date < '2026-01-20') continue;
      by[e.date] = by[e.date] || [];
      by[e.date].push(+e.recap_engagement_score);
    }
    return Object.keys(by).sort().map(d => ({ date: d, value: by[d].reduce((s,v)=>s+v,0) / by[d].length }));
  }, []);
  const sparkVals = engSeries.slice(-14).map(p => p.value);
  const lineRef = useChart(svg => charts.lineChart(svg, engSeries, { dates: engSeries.map(p=>p.date) }), [engSeries]);

  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard</div>
        <div className="page-title">Welcome back, Arjun 👋</div>
        <div className="page-sub">Here's how student engagement is trending this semester. Click any card or event to dive deeper.</div>
      </div>
      <div className="page-body">
        <div className="kpis">
          <Kpi label="Events this semester" value="47" delta="+9 vs last" dir="up" spark={sparkVals} />
          <Kpi label="Median engagement" value="1.38" delta="+8% month-on-month" dir="up" spark={sparkVals.map(v => v*1.05)} />
          <Kpi label="Forecast accuracy" value="84%" delta="within ±0.22" dir="flat" spark={sparkVals.map(() => 1.4)} />
          <Kpi label="Upcoming RSVPs" value={M.RSVPS.length.toLocaleString()} delta="+142 this week" dir="up" spark={sparkVals.map(v => v*0.8+0.3)} />
        </div>

        <div className="grid grid-8-4" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-hdr">
              <h3>Engagement trend · last 90 days</h3>
              <div className="legend"><span className="i"><span className="d" style={{background:'var(--accent)'}} /> Daily average</span></div>
            </div>
            <div className="card-body"><svg ref={lineRef} style={{width:'100%', height: 240}} /></div>
          </div>
          <div className="card">
            <div className="card-hdr"><h3>What needs attention</h3><span className="hint">{anomalies.length} alerts</span></div>
            <div>
              {anomalies.slice(0, 5).map((a, i) => (
                <div key={i} className={'alert ' + a.kind} onClick={() => go('compare')}>
                  <div className="dot" />
                  <div className="body">
                    <div className="t1">{a.club} is {a.kind === 'surge' ? 'surging' : 'dipping'}</div>
                    <div className="t2">Last recap scored {a.last.score.toFixed(2)} vs typical {a.mu2.toFixed(2)}</div>
                  </div>
                  <div className="zs">{a.magnitude.toFixed(1)}σ</div>
                </div>
              ))}
              {!anomalies.length && <div style={{padding:22, color:'var(--muted)'}}>All quiet — no anomalies right now.</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-8-4">
          <div className="card">
            <div className="card-hdr"><h3>Top events this semester</h3><span className="hint">ranked by engagement</span></div>
            <table className="t">
              <thead><tr><th>Event</th><th>Club</th><th>Category</th><th className="num">Score</th><th className="num">Date</th></tr></thead>
              <tbody>
                {topEvents.map(e => (
                  <tr key={e.event_id} className="r" onClick={() => go('event', e.event_id)}>
                    <td style={{color:'var(--fg)',fontWeight:500}}>{e.event_name}</td>
                    <td>{e.club_name}</td>
                    <td><span className="chip">{e.event_category}</span></td>
                    <td className="num up">{(+e.recap_engagement_score).toFixed(2)}</td>
                    <td className="num dim">{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <div className="card-hdr"><h3>Coming up this week</h3></div>
            <div className="ev-list">
              {upcoming.map(e => (
                <div key={e.event_id} className="ev-row" onClick={() => go('forecast', e.event_id)}>
                  <div className="t1">{e.event_name}</div>
                  <div className="t2">
                    <span>{e.club_name}</span>
                    <span>·</span>
                    <span>{e.date}</span>
                    <span className="upcoming-pill" style={{marginLeft:'auto'}}>Forecast {(+e.predicted_engagement_score).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── FORECAST ─────────────────────────────────────────────────────────
function Forecast({ selectedId }) {
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }), []);
  const [id, setId] = useState(selectedId || upcoming[0]?.event_id);
  const [trials, setTrials] = useState(1000);
  const [query, setQuery] = useState('');
  const forecast = useMemo(() => id ? api.forecast(id, { trials }) : null, [id, trials]);
  const fanRef = useChart(svg => forecast && charts.fanChart(svg, forecast), [forecast]);
  const histRef = useChart(svg => forecast && charts.histogram(svg, forecast.samples), [forecast]);
  const tornRef = useChart(svg => forecast && charts.tornado(svg, forecast.tornado), [forecast]);

  if (!forecast) return null;
  const ev = forecast.event;
  const filtered = upcoming.filter(e => !query || e.event_name.toLowerCase().includes(query.toLowerCase()) || e.club_name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard · Forecast</div>
        <div className="page-title">Forecast an upcoming event</div>
        <div className="page-sub">We run 1,000 Monte-Carlo simulations using the club's history and event details to predict engagement. <b style={{color:'var(--fg)'}}>P50</b> is the most likely outcome, <b style={{color:'var(--fg)'}}>P10–P90</b> is the realistic range.</div>
      </div>
      <div className="page-body">
        <div className="grid grid-sidebar">
          <div className="card" style={{alignSelf:'start'}}>
            <div className="card-hdr"><h3>Pick an event</h3><span className="hint">{upcoming.length}</span></div>
            <div className="search"><input placeholder="Search events…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <div className="ev-list">
              {filtered.map(e => (
                <div key={e.event_id} className={'ev-row' + (id === e.event_id ? ' sel' : '')} onClick={() => setId(e.event_id)}>
                  <div className="t1">{e.event_name}</div>
                  <div className="t2"><span>{e.club_name}</span><span>·</span><span>{e.date}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="hero-stat">
                <div className="h">
                  <div className="l">Most likely engagement</div>
                  <div className="v" style={{color:'var(--accent)'}}>{forecast.p50.toFixed(2)}</div>
                  <div className="s">vs club historical avg {forecast.historicalMu.toFixed(2)} · {forecast.p50 > forecast.historicalMu ? <span className="up">↑ above typical</span> : <span className="down">↓ below typical</span>}</div>
                </div>
                <div className="h">
                  <div className="l">Realistic range (80%)</div>
                  <div className="v">{forecast.p10.toFixed(2)} – {forecast.p90.toFixed(2)}</div>
                  <div className="s">8 out of 10 simulations land here</div>
                </div>
                <div className="h">
                  <div className="l">Confidence</div>
                  <div className="v">{(1 - forecast.sigma / forecast.mu).toFixed(2) > 0.7 ? 'High' : 'Medium'}</div>
                  <div className="s">based on {forecast.trials.toLocaleString()} simulations · σ {forecast.sigma.toFixed(2)}</div>
                </div>
              </div>
              <div className="percentile-row">
                <div className="percentile-cell"><div className="l">P10 · floor</div><div className="v">{forecast.p10.toFixed(2)}</div></div>
                <div className="percentile-cell"><div className="l">P25</div><div className="v">{forecast.p25.toFixed(2)}</div></div>
                <div className="percentile-cell hi"><div className="l">P50 · median</div><div className="v">{forecast.p50.toFixed(2)}</div></div>
                <div className="percentile-cell"><div className="l">P75</div><div className="v">{forecast.p75.toFixed(2)}</div></div>
                <div className="percentile-cell"><div className="l">P90 · ceiling</div><div className="v">{forecast.p90.toFixed(2)}</div></div>
              </div>
              <div style={{padding:20}}>
                <div className="lbl" style={{marginBottom:10}}>Simulated paths to event day · {ev.event_name}</div>
                <svg ref={fanRef} style={{width:'100%', height: 260}} />
                <div style={{display:'flex', alignItems:'center', gap:14, marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)'}}>
                  <span className="lbl" style={{margin:0}}>Simulations: {trials.toLocaleString()}</span>
                  <input type="range" min={200} max={5000} step={200} value={trials} onChange={e => setTrials(+e.target.value)} style={{flex:1, maxWidth:320, accentColor:'var(--accent)'}} />
                  <button className="btn-ghost btn" onClick={() => setTrials(t => t + 1)}>Re-run</button>
                </div>
              </div>
            </div>

            <div className="grid grid-2">
              <div className="card">
                <div className="card-hdr"><h3>Where outcomes land</h3><span className="hint">histogram</span></div>
                <div className="card-body"><svg ref={histRef} style={{width:'100%', height: 220}} /></div>
              </div>
              <div className="card">
                <div className="card-hdr"><h3>What's driving the forecast</h3><span className="hint">feature impact</span></div>
                <div className="card-body"><svg ref={tornRef} style={{width:'100%', height: 220}} /></div>
                <div style={{padding:'0 20px 16px', fontSize:12, color:'var(--muted)'}}>Longer bars = bigger impact on predicted engagement.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── EVENT REVIEW ─────────────────────────────────────────────────────
function EventReview({ selectedId }) {
  const past = useMemo(() => api.listEvents({ past: true }).sort((a,b) => +b.recap_engagement_score - +a.recap_engagement_score).slice(0, 50), []);
  const [id, setId] = useState(selectedId || past[0]?.event_id);
  const ev = api.getEvent(id);
  const [q, setQ] = useState('');
  const filt = past.filter(e => !q || e.event_name.toLowerCase().includes(q.toLowerCase()));
  const clubHist = useMemo(() => ev ? api.listEvents({ clubId: ev.club_id, past: true }) : [], [ev]);
  const peers = useMemo(() => ev ? api.listEvents({ past: true }).filter(e => e.event_category === ev.event_category && e.event_id !== ev.event_id).slice(0, 6) : [], [ev]);
  const histSeries = clubHist.slice(-15).map(h => ({ date: h.date, value: +h.recap_engagement_score }));
  const lineRef = useChart(svg => charts.lineChart(svg, histSeries, { dates: histSeries.map(s => s.date) }), [histSeries]);

  if (!ev) return null;
  const scoreClass = +ev.recap_engagement_score > 1 ? 'up' : 'down';

  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard · Event Review</div>
        <div className="page-title">Review a past event</div>
        <div className="page-sub">See how an event actually performed, how it compared to peers, and what likely drove the outcome.</div>
      </div>
      <div className="page-body">
        <div className="grid grid-sidebar">
          <div className="card" style={{alignSelf:'start'}}>
            <div className="card-hdr"><h3>Past events</h3><span className="hint">{past.length}</span></div>
            <div className="search"><input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <div className="ev-list">
              {filt.map(e => (
                <div key={e.event_id} className={'ev-row' + (id === e.event_id ? ' sel' : '')} onClick={() => setId(e.event_id)}>
                  <div className="t1">{e.event_name}</div>
                  <div className="t2">
                    <span>{e.club_name}</span><span>·</span><span>{e.date}</span>
                    <span style={{marginLeft:'auto', color: +e.recap_engagement_score > 1 ? 'var(--good)' : 'var(--bad)', fontFamily:'var(--mono)'}}>{(+e.recap_engagement_score).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="hero-stat">
                <div className="h"><div className="l">Engagement score</div><div className={'v '+scoreClass}>{(+ev.recap_engagement_score).toFixed(2)}</div><div className="s">{+ev.recap_engagement_score > 1 ? 'Above club average' : 'Below club average'}</div></div>
                <div className="h"><div className="l">Event</div><div className="v" style={{fontSize:18}}>{ev.event_name}</div><div className="s">{ev.club_name}</div></div>
                <div className="h"><div className="l">Details</div><div className="v" style={{fontSize:16}}>{ev.day_of_week} · {ev.campus_location}</div><div className="s">{ev.has_free_food ? '🍕 Had free food' : 'No free food'} · {ev.event_category}</div></div>
              </div>
            </div>

            <div className="grid grid-2" style={{marginBottom:16}}>
              <div className="card">
                <div className="card-hdr"><h3>Post lifecycle</h3><span className="hint">likes across promo → recap</span></div>
                <div className="card-pad">
                  {ev.posts.map((p, i) => (
                    <div key={i} className="bar">
                      <div className="lbl" style={{textTransform:'capitalize'}}>{p.post_type}</div>
                      <div className="track"><div className="fill" style={{width: `${Math.min(100, p.likes/4)}%`}} /></div>
                      <div className="val">{p.likes}</div>
                      <div className="val dim">·{p.comments}c</div>
                    </div>
                  ))}
                  {!ev.posts.length && <div className="dim">No post data.</div>}
                </div>
              </div>
              <div className="card">
                <div className="card-hdr"><h3>{ev.club_name} recent recap history</h3></div>
                <div className="card-body"><svg ref={lineRef} style={{width:'100%', height: 200}} /></div>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr"><h3>How similar events compared</h3><span className="hint">same category · {peers.length} events</span></div>
              <table className="t">
                <thead><tr><th>Event</th><th>Club</th><th>Day</th><th>Location</th><th>Food</th><th className="num">Score</th><th className="num">Δ vs this</th></tr></thead>
                <tbody>
                  {peers.map(p => {
                    const d = +p.recap_engagement_score - +ev.recap_engagement_score;
                    return (
                      <tr key={p.event_id}>
                        <td style={{color:'var(--fg)',fontWeight:500}}>{p.event_name}</td>
                        <td>{p.club_name}</td>
                        <td className="dim">{p.day_of_week}</td>
                        <td className="dim">{p.campus_location}</td>
                        <td>{p.has_free_food ? '✓' : '—'}</td>
                        <td className={'num '+ (+p.recap_engagement_score > 1 ? 'up' : 'down')}>{(+p.recap_engagement_score).toFixed(2)}</td>
                        <td className={'num '+(d > 0 ? 'up' : 'down')}>{d > 0 ? '+' : ''}{d.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── COMPARE ──────────────────────────────────────────────────────────
function Compare() {
  const [clubId, setClubId] = useState(2);
  const comp = useMemo(() => api.clubComparison(clubId), [clubId]);
  const me = M.CLUBS.find(c => c.club_id === clubId);
  const sorted = [...comp.peers].sort((a,b) => b.avg - a.avg);
  const topMix = Object.entries(comp.me.catMix).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const peerTop = sorted.slice(0,3).filter(p => p.club_id !== clubId);

  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard · Club Comparison</div>
        <div className="page-title">How does your club compare?</div>
        <div className="page-sub">Benchmark against peer organizations by engagement, posting cadence, and event category mix.</div>
        <div style={{marginTop:14, maxWidth:320}}>
          <label className="lbl">Your club</label>
          <select className="inp" value={clubId} onChange={e => setClubId(+e.target.value)}>
            {M.CLUBS.map(c => <option key={c.club_id} value={c.club_id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="page-body">
        <div className="kpis">
          <Kpi label="Percentile" value={comp.percentile} delta={comp.percentile >= 75 ? 'top quartile' : comp.percentile >= 50 ? 'above median' : 'below median'} dir={comp.percentile >= 50 ? 'up' : 'down'} />
          <Kpi label="Rank" value={'#' + comp.rank} delta={`of ${M.CLUBS.length} clubs`} dir="flat" />
          <Kpi label="Avg engagement" value={comp.me.avg.toFixed(2)} delta={`σ ${comp.me.stddev.toFixed(2)}`} dir="flat" />
          <Kpi label="90-day trend" value={(comp.me.trend*100).toFixed(1)+'%'} delta={comp.me.trend >= 0 ? 'growing' : 'slowing'} dir={comp.me.trend >= 0 ? 'up' : 'down'} />
        </div>

        <div className="grid grid-5-7">
          <div className="card">
            <div className="card-hdr"><h3>Peer ranking</h3><span className="hint">by semester engagement</span></div>
            <table className="t">
              <thead><tr><th>#</th><th>Club</th><th className="num">Avg</th><th className="num">Events</th><th className="num">Trend</th></tr></thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.club_id} className={'r' + (p.club_id === clubId ? ' sel' : '')} onClick={() => setClubId(p.club_id)}>
                    <td className="dim">{i+1}</td>
                    <td style={{color: p.club_id === clubId ? 'var(--accent)' : 'var(--fg)', fontWeight: p.club_id === clubId ? 600 : 500}}>{p.name}</td>
                    <td className="num">{p.avg.toFixed(2)}</td>
                    <td className="num dim">{p.total}</td>
                    <td className={'num ' + (p.trend >= 0 ? 'up' : 'down')}>{p.trend >= 0 ? '+' : ''}{(p.trend*100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-hdr"><h3>Your position</h3></div>
              <div className="card-pad">
                <div style={{position:'relative', height:28, background:'linear-gradient(to right, rgba(248,113,113,0.2), rgba(251,191,36,0.2), rgba(74,222,128,0.3))', borderRadius:6, marginBottom:14}}>
                  <div style={{position:'absolute', left:`${comp.percentile}%`, top:-4, width:3, height:36, background:'var(--accent)', borderRadius:2, transform:'translateX(-1.5px)', boxShadow:'0 0 8px var(--accent)'}} />
                </div>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted)'}}>
                  <span>Bottom (0)</span><span>Median (50)</span><span>Top (100)</span>
                </div>
                <div style={{marginTop:18, fontSize:13.5, color:'var(--fg-dim)', lineHeight:1.6}}>
                  {me.name} sits at the <b style={{color:'var(--accent)'}}>{comp.percentile}th percentile</b> among {M.CLUBS.length} orgs.
                  {sorted[Math.max(0, comp.rank - 2)] && sorted[Math.max(0, comp.rank - 2)].club_id !== clubId && <> Closest above: <b style={{color:'var(--fg)'}}>{sorted[Math.max(0, comp.rank - 2)].name}</b>.</>}
                  {sorted[comp.rank] && <> Closest below: <b style={{color:'var(--fg)'}}>{sorted[comp.rank].name}</b>.</>}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr"><h3>Category mix</h3><span className="hint">you vs top 3 peers</span></div>
              <div className="card-pad">
                {topMix.map(([cat, n]) => {
                  const peerAvg = peerTop.reduce((s,p) => s + (p.catMix[cat] || 0), 0) / Math.max(1, peerTop.length);
                  const max = Math.max(n, peerAvg, 1);
                  return (
                    <div key={cat} style={{marginBottom:14}}>
                      <div style={{fontSize:12.5, color:'var(--fg)', marginBottom:6, fontWeight:500, textTransform:'capitalize'}}>{cat}</div>
                      <div className="bar"><div className="lbl" style={{color:'var(--accent)', width:60}}>You</div><div className="track"><div className="fill" style={{width:`${(n/max)*100}%`}} /></div><div className="val">{n}</div></div>
                      <div className="bar"><div className="lbl dim" style={{width:60}}>Peers</div><div className="track"><div className="fill" style={{width:`${(peerAvg/max)*100}%`, background:'var(--cyan)'}} /></div><div className="val dim">{peerAvg.toFixed(1)}</div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── WHAT-IF ──────────────────────────────────────────────────────────
function WhatIf({ selectedId }) {
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }), []);
  const [id, setId] = useState(selectedId || upcoming[0]?.event_id);
  const ev = api.getEvent(id);
  const [o, setO] = useState({});
  useEffect(() => { setO({}); }, [id]);
  const merged = { ...ev, ...o };
  const base = useMemo(() => ev ? api.forecast(id) : null, [id]);
  const sim  = useMemo(() => ev ? api.forecast(id, { overrides: o }) : null, [id, o]);

  const histRef = useChart(svg => {
    if (!base || !sim) return;
    svg.innerHTML = '';
    charts.histogram(svg, base.samples);
    // Overlay sim
    const W = svg.clientWidth, H = svg.clientHeight;
    const pad = { l: 32, r: 12, t: 14, b: 22 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const lo = Math.min(...base.samples, ...sim.samples);
    const hi = Math.max(...base.samples, ...sim.samples);
    const bins = 28; const step = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const s of sim.samples) counts[Math.min(bins-1, Math.floor((s-lo)/step))]++;
    const cmax = Math.max(...counts);
    const bw = iw / bins;
    const NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < bins; i++) {
      const h = (counts[i]/cmax)*ih;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', pad.l + i*bw + 0.5);
      r.setAttribute('y', pad.t + ih - h);
      r.setAttribute('width', bw-1); r.setAttribute('height', h);
      r.setAttribute('fill', 'var(--cyan)'); r.setAttribute('opacity', 0.6);
      svg.appendChild(r);
    }
  }, [base, sim]);

  if (!ev) return null;
  const delta = sim.p50 - base.p50;
  const pct = delta / base.p50 * 100;

  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard · What-If</div>
        <div className="page-title">What if we changed something?</div>
        <div className="page-sub">Adjust event details to see how they'd shift the predicted engagement.</div>
      </div>
      <div className="page-body">
        <div className="grid grid-sidebar">
          <div className="card" style={{alignSelf:'start'}}>
            <div className="card-hdr"><h3>Pick an event</h3></div>
            <div className="ev-list">
              {upcoming.map(e => (
                <div key={e.event_id} className={'ev-row' + (id === e.event_id ? ' sel' : '')} onClick={() => setId(e.event_id)}>
                  <div className="t1">{e.event_name}</div>
                  <div className="t2"><span>{e.club_name}</span><span>·</span><span>{e.date}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="scenario-hdr">
                <div><div className="sl">Baseline P50</div><div className="sv">{base.p50.toFixed(2)}</div><div style={{fontSize:11.5,color:'var(--muted)', marginTop:2}}>Event as planned</div></div>
                <div><div className="sl">Scenario P50</div><div className="sv" style={{color:'var(--accent)'}}>{sim.p50.toFixed(2)}</div><div style={{fontSize:11.5,color:'var(--muted)', marginTop:2}}>With your tweaks</div></div>
                <div><div className="sl">Impact</div><div className="sv" style={{color: delta >= 0 ? 'var(--good)':'var(--bad)'}}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</div><div className={'delta ' + (delta < 0 ? 'down' : '')}>{delta >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%</div></div>
              </div>
              <div style={{padding:'20px 22px', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, borderBottom:'1px solid var(--border)'}}>
                <div>
                  <label className="lbl">Day of week</label>
                  <select className="inp" value={merged.day_of_week} onChange={e => setO({...o, day_of_week: e.target.value})}>
                    {M.DAYS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Category</label>
                  <select className="inp" value={merged.event_category} onChange={e => setO({...o, category: e.target.value, event_category: e.target.value})}>
                    {M.CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Location</label>
                  <select className="inp" value={merged.campus_location || ''} onChange={e => setO({...o, campus_location: e.target.value})}>
                    {M.LOCS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">&nbsp;</label>
                  <label className="switch"><input type="checkbox" checked={!!merged.has_free_food} onChange={e => setO({...o, has_free_food: e.target.checked})} /> Free food</label>
                </div>
              </div>
              <div style={{padding:'18px 22px 22px'}}>
                <div className="lbl" style={{marginBottom:10}}>Outcome distribution · baseline vs scenario</div>
                <svg ref={histRef} style={{width:'100%', height: 240}} />
                <div className="legend" style={{marginTop:10}}>
                  <span className="i"><span className="d" style={{background:'var(--accent)'}} /> Baseline</span>
                  <span className="i"><span className="d" style={{background:'var(--cyan)'}} /> Your scenario</span>
                </div>
              </div>
            </div>
            <div className="help">
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <div className="body"><b>Reading this:</b> Higher overlap = similar outcomes. When the scenario (cyan) shifts right of baseline, your tweaks improved predicted engagement.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── GRAPH ────────────────────────────────────────────────────────────
function GraphPage() {
  const g = useMemo(() => api.collabGraph(), []);
  const r = useChart(svg => charts.networkGraph(svg, g), [g]);
  const top = [...g.edges].sort((a,b) => b.weight - a.weight).slice(0, 10);
  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard · Collaborations</div>
        <div className="page-title">Who co-hosts with who?</div>
        <div className="page-sub">Clubs that collaborate tend to see engagement lifts. Thicker lines = more joint events.</div>
      </div>
      <div className="page-body">
        <div className="grid grid-5-7">
          <div className="card">
            <div className="card-hdr"><h3>Partnership graph</h3><span className="hint">{g.nodes.length} clubs · {g.edges.length} links</span></div>
            <div style={{padding:10}}><svg ref={r} style={{width:'100%', height: 520}} /></div>
          </div>
          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-hdr"><h3>Top partnerships</h3></div>
              <table className="t">
                <thead><tr><th>Partnership</th><th className="num">Joint events</th><th className="num">Est. lift</th></tr></thead>
                <tbody>
                  {top.map((e, i) => (
                    <tr key={i}>
                      <td style={{color:'var(--fg)',fontWeight:500}}>{e.source} ↔ {e.target}</td>
                      <td className="num">{e.weight}</td>
                      <td className="num up">+{(12+Math.random()*25).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <div className="card-hdr"><h3>Suggested partners for ACM</h3><span className="hint">untapped</span></div>
              <div>
                <div className="rec"><div><div className="name">GDSC</div><div className="reason">Shared CS audience · never collabed</div></div><div className="lift">+18%</div></div>
                <div className="rec"><div><div className="name">SHPE</div><div className="reason">Complementary career mix</div></div><div className="lift">+14%</div></div>
                <div className="rec"><div><div className="name">Robotics</div><div className="reason">Overlapping workshop attendees</div></div><div className="lift">+11%</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── RSVP ─────────────────────────────────────────────────────────────
function Rsvp({ selectedId }) {
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }).filter(e => api.listRsvps(e.event_id).length > 0), []);
  const [id, setId] = useState(selectedId || upcoming[0]?.event_id);
  const b = useMemo(() => id ? api.rsvpBreakdown(id) : null, [id]);
  const ev = api.getEvent(id);
  const majorE = b ? Object.entries(b.byMajor).sort((a,c)=>c[1]-a[1]).slice(0,8) : [];
  const total = majorE.reduce((s,[,v])=>s+v,0) || 1;
  const interestE = b ? Object.entries(b.byInterest).sort((a,c)=>c[1]-a[1]).slice(0,8) : [];
  const colors = ['var(--accent)','var(--cyan)','#a78bfa','#4ade80','#fbbf24','#f472b6','#fb923c','#38bdf8'];
  const donutRef = useChart(svg => b && charts.donut(svg,
    majorE.map(([k,v], i) => ({ label: k, value: v, color: colors[i%8] })),
    { centerLabel: String(b.total), centerSub: 'RSVPs' }
  ), [b]);
  if (!ev || !b) return null;

  return (
    <>
      <div className="page-hdr">
        <div className="breadcrumb">Dashboard · Audience</div>
        <div className="page-title">Who's coming?</div>
        <div className="page-sub">Real-time RSVP mix by major and shared interests — useful for tailoring the event-day experience.</div>
      </div>
      <div className="page-body">
        <div className="grid grid-sidebar">
          <div className="card" style={{alignSelf:'start'}}>
            <div className="card-hdr"><h3>Events with RSVPs</h3></div>
            <div className="ev-list">
              {upcoming.map(e => {
                const n = api.listRsvps(e.event_id).length;
                return (
                  <div key={e.event_id} className={'ev-row' + (id === e.event_id ? ' sel' : '')} onClick={() => setId(e.event_id)}>
                    <div className="t1">{e.event_name}</div>
                    <div className="t2"><span>{e.club_name}</span><span>·</span><span>{e.date}</span><span style={{marginLeft:'auto', color:'var(--fg)'}}>{n} going</span></div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-hdr"><h3>{ev.event_name}</h3><span className="hint">{ev.date} · {b.total} RSVPs</span></div>
              <div className="grid grid-2" style={{padding:'8px 20px 20px', gap:22}}>
                <div>
                  <div className="lbl" style={{marginBottom:10}}>Major mix</div>
                  <svg ref={donutRef} style={{width:'100%', height:200}} />
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:14, fontSize:12}}>
                    {majorE.map(([k,v], i) => (
                      <div key={k} style={{display:'flex', alignItems:'center', gap:7}}>
                        <div style={{width:10,height:10,background:colors[i%8],borderRadius:2}} />
                        <span style={{color:'var(--fg-dim)'}}>{k}</span>
                        <span className="dim" style={{marginLeft:'auto', fontFamily:'var(--mono)'}}>{((v/total)*100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="lbl" style={{marginBottom:10}}>Shared interests</div>
                  {interestE.map(([k,v]) => (
                    <div key={k} className="bar">
                      <div className="lbl" style={{margin:0}}>{k}</div>
                      <div className="track"><div className="fill" style={{width: `${(v/interestE[0][1])*100}%`}} /></div>
                      <div className="val">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr"><h3>RSVP roster</h3><span className="hint">live · {b.total} entries</span></div>
              <div style={{maxHeight:340, overflowY:'auto'}}>
                <table className="t">
                  <thead><tr><th>Name</th><th>Major</th><th>Interests</th><th>Status</th></tr></thead>
                  <tbody>
                    {b.rsvps.slice(0,40).map(r => (
                      <tr key={r.user_id}>
                        <td style={{color:'var(--fg)'}}>{r.user_name}</td>
                        <td>{r.user_major}</td>
                        <td className="dim" style={{fontSize:12}}>{r.user_interests}</td>
                        <td><span className={'chip ' + (r.status === 'going' ? 'g' : 'w')}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── App shell ────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState('overview');
  const [selectedId, setSelectedId] = useState(null);
  const go = (p, id) => { setPage(p); if (id) setSelectedId(id); };
  return (
    <div className="app" data-screen-label="EDEN Friendly">
      <Sidebar page={page} setPage={(p) => { setPage(p); setSelectedId(null); }} />
      <main className="main">
        {page === 'overview' && <Overview go={go} />}
        {page === 'forecast' && <Forecast selectedId={selectedId} />}
        {page === 'event'    && <EventReview selectedId={selectedId} />}
        {page === 'compare'  && <Compare />}
        {page === 'whatif'   && <WhatIf selectedId={selectedId} />}
        {page === 'graph'    && <GraphPage />}
        {page === 'rsvp'     && <Rsvp selectedId={selectedId} />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
