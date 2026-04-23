/* eslint-disable */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const api = window.EDEN_API;
const charts = window.EDEN_CHARTS;
const M = window.EDEN_MOCK;

const PAGES = [
  { id: 'overview',  num: 'F1', label: 'Overview' },
  { id: 'forecast',  num: 'F2', label: 'Forecast' },
  { id: 'event',     num: 'F3', label: 'Event Deep-dive' },
  { id: 'compare',   num: 'F4', label: 'Club Comparison' },
  { id: 'whatif',    num: 'F5', label: 'What-if' },
  { id: 'graph',     num: 'F6', label: 'Collab Graph' },
  { id: 'rsvp',      num: 'F7', label: 'Audience' },
];

// ── Chart hook ───────────────────────────────────────────────────────────
function useChart(drawFn, deps) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const run = () => drawFn(ref.current);
    run();
    const ro = new ResizeObserver(run);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, deps);
  return ref;
}

// ── Topbar ───────────────────────────────────────────────────────────────
function Topbar({ openCmdk }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const ts = time.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  return (
    <div className="topbar">
      <div className="tb-logo"><span className="sq" /> EDEN <span className="tb-ver">v0.8.2 · α</span></div>
      <div className="tb-div" />
      <div className="tb-status"><span className="led" /> FASTAPI · 200 OK</div>
      <div className="tb-div" />
      <div className="tb-status"><span className="led" style={{ background: 'var(--cyan)', boxShadow: '0 0 6px var(--cyan)' }} /> MC ENGINE · idle</div>
      <div className="tb-cmd">
        <div className="tb-cmd-box" onClick={openCmdk}>
          <span>›</span> Jump to… <span style={{ flex: 1 }} /> <kbd>⌘K</kbd>
        </div>
      </div>
      <div className="tb-right">
        <span className="tb-org-badge">E-BOARD · ACM</span>
        <span className="tb-clock mono">{ts}</span>
        <div className="tb-user"><span className="av">AK</span> a.kumar</div>
      </div>
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────
function Nav({ page, setPage }) {
  return (
    <div className="nav">
      {PAGES.map(p => (
        <div key={p.id} className={'nav-item' + (page === p.id ? ' active' : '')} onClick={() => setPage(p.id)}>
          <span className="num">{p.num}</span> {p.label}
        </div>
      ))}
      <div className="nav-spacer" />
      <div className="nav-meta">SEM · SPR 2026 · WK 14/15</div>
    </div>
  );
}

// ── Status bar ───────────────────────────────────────────────────────────
function StatusBar({ page }) {
  return (
    <div className="statusbar">
      <div className="sb-seg"><b>EVENTS</b> {M.EVENTS.length}</div>
      <div className="sb-seg"><b>CLUBS</b> {M.CLUBS.length} active</div>
      <div className="sb-seg"><b>UPCOMING</b> {M.EVENTS.filter(e => e.date > '2026-04-23').length}</div>
      <div className="sb-seg"><b>ENG.IDX</b> <span className="up">1.42 ▲ +0.08</span></div>
      <div className="sb-seg"><b>RSVP TOTAL</b> {window.EDEN_MOCK.RSVPS.length.toLocaleString()}</div>
      <div style={{ flex: 1 }} />
      <div className="sb-seg dim">F1–F7 · PAGES  ·  ⌘K · SEARCH  ·  esc · CLOSE</div>
    </div>
  );
}

// ── Ticker ───────────────────────────────────────────────────────────────
function Ticker() {
  const top = useMemo(() => {
    return M.CLUBS.slice(0, 8).map(c => {
      const s = api.clubStats(c.club_id, 30);
      return { name: c.name, score: s.avg || 0, trend: s.trend };
    });
  }, []);
  return (
    <div className="ticker">
      {top.map((t, i) => (
        <div key={i}>
          <span className="tk-sym">{t.name}</span>
          <span className="tk-val">{t.score.toFixed(2)}</span>
          <span className={'tk-delta ' + (t.trend >= 0 ? 'up' : 'down')}>
            {' '}{t.trend >= 0 ? '▲' : '▼'} {Math.abs(t.trend * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────
function Kpi({ label, value, delta, deltaDir, spark }) {
  const sparkRef = useChart(svg => spark && charts.sparkline(svg, spark), [spark]);
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={'kpi-delta ' + (deltaDir || 'flat')}>{delta}</div>}
      {spark && <svg ref={sparkRef} className="kpi-spark" />}
    </div>
  );
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────
function OverviewPage() {
  const anomalies = useMemo(() => api.anomalies(), []);
  const topEvents = useMemo(() =>
    api.listEvents({ past: true }).sort((a,b) => +b.recap_engagement_score - +a.recap_engagement_score).slice(0, 12),
    []
  );
  const upcoming = useMemo(() =>
    api.listEvents({ upcoming: true }).slice(0, 8),
    []
  );
  const engSeries = useMemo(() => {
    const by = {};
    for (const e of api.listEvents({ past: true })) {
      if (e.date < '2026-01-20') continue;
      by[e.date] = by[e.date] || [];
      by[e.date].push(+e.recap_engagement_score);
    }
    return Object.keys(by).sort().map(d => ({ date: d, value: by[d].reduce((s,v) => s+v, 0) / by[d].length }));
  }, []);
  const dayHourHeat = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array(12).fill(0));
    for (const e of api.listEvents({ past: true })) {
      const d = new Date(e.date).getDay();
      const h = parseInt(e.start_time, 10) - 9;
      if (h >= 0 && h < 12) m[(d + 6) % 7][h] += +e.recap_engagement_score;
    }
    // normalize to count avg
    return m;
  }, []);
  const engSparkSeries = engSeries.slice(-20).map(p => p.value);

  const engChartRef = useChart(svg => charts.lineChart(svg, engSeries, { dates: engSeries.map(p => p.date) }), [engSeries]);
  const heatRef = useChart(svg => charts.heatmap(svg, dayHourHeat, {
    rowLabels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    colLabels: Array.from({length:12}, (_,i) => `${9+i}`),
  }), [dayHourHeat]);

  return (
    <>
      <div className="kpi-row">
        <Kpi label="Active Events / Sem" value="47" delta="+9 vs prior" deltaDir="up" spark={engSparkSeries} />
        <Kpi label="Median Engagement" value="1.38" delta="+8.2% MoM" deltaDir="up" spark={engSparkSeries.map(v => v*1.05)} />
        <Kpi label="Forecast Accuracy" value="84%" delta="±0.22 MAE" deltaDir="flat" spark={engSparkSeries.map(v => 1.4 + Math.random()*0.1)} />
        <Kpi label="Upcoming RSVPs" value={window.EDEN_MOCK.RSVPS.length.toLocaleString()} delta="+142 (7d)" deltaDir="up" spark={engSparkSeries.map(v => v*0.8+0.3)} />
        <Kpi label="Avg Free-Food Lift" value="+22%" delta="on engagement" deltaDir="up" spark={engSparkSeries.map(v => v*1.2)} />
        <Kpi label="Anomalies (14d)" value={String(anomalies.length)} delta="2 surges · rest dips" deltaDir={anomalies.filter(a=>a.kind==='surge').length > 0 ? 'up' : 'down'} spark={engSparkSeries.map(v => Math.abs(v-1))} />
      </div>

      <div className="grid grid-5-7" style={{ marginBottom: 10 }}>
        <div className="panel">
          <div className="panel-hdr">
            <h3><span className="prefix">›</span>Campus Engagement · 90d</h3>
            <div className="legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent)' }} />engagement idx</div>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 4 }}>
            <svg ref={engChartRef} style={{ width: '100%', height: 220 }} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-hdr">
            <h3><span className="prefix">›</span>Anomaly Monitor</h3>
            <div className="meta">Z ≥ 1.5σ · {anomalies.length} alerts</div>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {anomalies.slice(0, 10).map((a, i) => (
              <div key={i} className="anom">
                <span className={'tag ' + a.kind}>{a.kind}</span>
                <span className="name">{a.club}</span>
                <span className="desc">last recap {a.last.score.toFixed(2)} vs μ {a.mu2.toFixed(2)} · {a.last.date}</span>
                <span className="z">{a.magnitude.toFixed(1)}σ</span>
              </div>
            ))}
            {anomalies.length === 0 && <div className="anom dim">No anomalies detected.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-5-7" style={{ marginBottom: 10 }}>
        <div className="panel">
          <div className="panel-hdr">
            <h3><span className="prefix">›</span>Top Past Events · All-time</h3>
            <div className="meta">ranked by engagement score</div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="eden">
              <thead><tr><th>#</th><th>Event</th><th>Club</th><th>Cat</th><th className="r">Score</th><th className="r">Date</th></tr></thead>
              <tbody>
                {topEvents.map((e, i) => (
                  <tr key={e.event_id}>
                    <td className="dim">{String(i+1).padStart(2,'0')}</td>
                    <td style={{ color: 'var(--fg)' }}>{e.event_name}</td>
                    <td>{e.club_name}</td>
                    <td><span className={'chip ' + e.event_category.replace(' ', '-')}>{e.event_category}</span></td>
                    <td className="r up">{(+e.recap_engagement_score).toFixed(2)}</td>
                    <td className="r dim">{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel-hdr"><h3><span className="prefix">›</span>Day × Hour Heatmap</h3><div className="meta">historical engagement density</div></div>
          <div className="panel-body" style={{ padding: 4 }}>
            <svg ref={heatRef} style={{ width: '100%', height: 220 }} />
          </div>
          <div className="panel-hdr" style={{ borderTop: '1px solid var(--border)' }}>
            <h3><span className="prefix">›</span>Upcoming · 7d</h3>
          </div>
          <table className="eden">
            <tbody>
              {upcoming.slice(0,5).map(e => (
                <tr key={e.event_id}>
                  <td style={{ color: 'var(--fg)' }}>{e.event_name}</td>
                  <td className="dim">{e.club_name}</td>
                  <td className="r"><span className="chip" style={{ color: 'var(--cyan)', borderColor: 'rgba(78,201,224,0.4)' }}>FCT {(+e.predicted_engagement_score).toFixed(2)}</span></td>
                  <td className="r dim">{e.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── FORECAST PAGE ────────────────────────────────────────────────────────
function ForecastPage({ selectedEventId, setSelectedEventId }) {
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }), []);
  const [id, setId] = useState(selectedEventId || upcoming[0]?.event_id);
  const [trials, setTrials] = useState(1000);
  const forecast = useMemo(() => id ? api.forecast(id, { trials }) : null, [id, trials]);

  const fanRef = useChart(svg => forecast && charts.fanChart(svg, forecast), [forecast]);
  const histRef = useChart(svg => forecast && charts.histogram(svg, forecast.samples), [forecast]);
  const tornRef = useChart(svg => forecast && charts.tornado(svg, forecast.tornado), [forecast]);

  if (!forecast) return <div className="panel"><div className="panel-body dim">No upcoming events to forecast.</div></div>;
  const ev = forecast.event;

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 10, marginBottom: 10 }}>
        <div className="panel">
          <div className="panel-hdr"><h3><span className="prefix">›</span>Upcoming Pipeline</h3><div className="meta">{upcoming.length} events</div></div>
          <div className="ev-picker">
            <table className="eden">
              <tbody>
                {upcoming.map(e => (
                  <tr key={e.event_id} className={id === e.event_id ? 'selected' : ''} onClick={() => setId(e.event_id)}>
                    <td>
                      <div style={{ color: 'var(--fg)' }}>{e.event_name}</div>
                      <div className="dim" style={{ fontSize: 9 }}>{e.club_name} · {e.date} · {e.day_of_week}</div>
                    </td>
                    <td className="r"><span className="chip" style={{ color: 'var(--cyan)', borderColor: 'rgba(78,201,224,0.4)' }}>{(+e.predicted_engagement_score).toFixed(2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 10 }}>
            <div className="panel-hdr">
              <h3><span className="prefix">›</span>Monte-Carlo Forecast · {ev.event_name}</h3>
              <div className="meta">trials={forecast.trials} · club={ev.club_name} · T-{Math.max(1, Math.round((new Date(ev.date) - new Date('2026-04-23')) / 86400000))}d</div>
            </div>
            <div className="mc-stats">
              <div className="mc-stat"><div className="l">P10</div><div className="v">{forecast.p10.toFixed(2)}</div></div>
              <div className="mc-stat"><div className="l">P25</div><div className="v">{forecast.p25.toFixed(2)}</div></div>
              <div className="mc-stat"><div className="l">P50 · Median</div><div className="v" style={{ color: 'var(--accent)' }}>{forecast.p50.toFixed(2)}</div></div>
              <div className="mc-stat"><div className="l">P75</div><div className="v">{forecast.p75.toFixed(2)}</div></div>
              <div className="mc-stat"><div className="l">P90</div><div className="v">{forecast.p90.toFixed(2)}</div></div>
            </div>
            <div className="panel-body" style={{ padding: 4 }}>
              <svg ref={fanRef} style={{ width: '100%', height: 260 }} />
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <label className="label-sm">TRIALS</label>
              <input type="range" min={200} max={5000} step={200} value={trials} onChange={e => setTrials(+e.target.value)} style={{ flex: 1, maxWidth: 280 }} />
              <span className="mono" style={{ color: 'var(--fg)' }}>{trials.toLocaleString()}</span>
              <button className="mono" style={{ padding: '4px 10px', background: 'rgba(247,185,85,0.08)', border: '1px solid var(--accent-dim)', color: 'var(--accent)', fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', borderRadius: 2 }}
                onClick={() => setTrials(t => t + 1)}>
                RE-RUN
              </button>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="panel">
              <div className="panel-hdr"><h3><span className="prefix">›</span>Outcome Distribution</h3><div className="meta">histogram · n={forecast.samples.length}</div></div>
              <div className="panel-body" style={{ padding: 4 }}>
                <svg ref={histRef} style={{ width: '100%', height: 220 }} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-hdr"><h3><span className="prefix">›</span>Sensitivity · Tornado</h3><div className="meta">feature contribution to μ</div></div>
              <div className="panel-body" style={{ padding: 4 }}>
                <svg ref={tornRef} style={{ width: '100%', height: 220 }} />
              </div>
              <div className="torn-axes"><span>← Drag on μ</span><span>Lift on μ →</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── EVENT DEEP-DIVE ──────────────────────────────────────────────────────
function EventPage() {
  const past = useMemo(() => api.listEvents({ past: true }).sort((a,b) => +b.recap_engagement_score - +a.recap_engagement_score).slice(0, 60), []);
  const [id, setId] = useState(past[0]?.event_id);
  const ev = api.getEvent(id);
  const clubHistory = useMemo(() => ev ? api.listEvents({ clubId: ev.club_id, past: true }) : [], [ev]);
  const peerSame = useMemo(() => ev ? api.listEvents({ past: true }).filter(e => e.event_category === ev.event_category && e.event_id !== ev.event_id).slice(0, 8) : [], [ev]);

  const postsSeries = ev && ev.posts.length ? ev.posts.map((p, i) => ({ date: p.post_type, value: p.likes + p.comments })) : [];
  const histLineSeries = clubHistory.slice(-20).map(h => ({ date: h.date, value: +h.recap_engagement_score }));
  const lineRef = useChart(svg => charts.lineChart(svg, histLineSeries, { dates: histLineSeries.map(s => s.date) }), [histLineSeries]);

  if (!ev) return null;
  const scoreColor = +ev.recap_engagement_score > 1 ? 'var(--bullish)' : 'var(--bearish)';

  return (
    <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 10 }}>
      <div className="panel">
        <div className="panel-hdr"><h3><span className="prefix">›</span>Past Events</h3><div className="meta">ranked</div></div>
        <div style={{ maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' }}>
          <table className="eden">
            <tbody>
              {past.map(e => (
                <tr key={e.event_id} className={id === e.event_id ? 'selected' : ''} onClick={() => setId(e.event_id)}>
                  <td>
                    <div style={{ color: 'var(--fg)' }}>{e.event_name}</div>
                    <div className="dim" style={{ fontSize: 9 }}>{e.club_name} · {e.date}</div>
                  </td>
                  <td className="r" style={{ color: +e.recap_engagement_score > 1 ? 'var(--bullish)' : 'var(--bearish)' }}>{(+e.recap_engagement_score).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="panel" style={{ marginBottom: 10 }}>
          <div className="panel-hdr">
            <h3><span className="prefix">›</span>{ev.event_name}</h3>
            <div className="meta">{ev.club_name} · EID {ev.event_id}</div>
          </div>
          <div className="mc-stats">
            <div className="mc-stat"><div className="l">Recap Score</div><div className="v" style={{ color: scoreColor }}>{(+ev.recap_engagement_score).toFixed(2)}</div></div>
            <div className="mc-stat"><div className="l">Category</div><div className="v" style={{ fontSize: 12 }}>{ev.event_category}</div></div>
            <div className="mc-stat"><div className="l">Day</div><div className="v" style={{ fontSize: 12 }}>{ev.day_of_week}</div></div>
            <div className="mc-stat"><div className="l">Location</div><div className="v" style={{ fontSize: 12 }}>{ev.campus_location}</div></div>
            <div className="mc-stat"><div className="l">Food</div><div className="v" style={{ fontSize: 12, color: ev.has_free_food ? 'var(--bullish)' : 'var(--muted)' }}>{ev.has_free_food ? 'YES' : 'NO'}</div></div>
          </div>
        </div>

        <div className="grid grid-2" style={{ marginBottom: 10 }}>
          <div className="panel">
            <div className="panel-hdr"><h3><span className="prefix">›</span>Post Lifecycle</h3><div className="meta">promo · day-of · recap</div></div>
            <div style={{ padding: 14 }}>
              {ev.posts.map((p, i) => (
                <div key={i} className="bar-row">
                  <div className="lbl">{p.post_type}</div>
                  <div className="bar"><div className="fill" style={{ width: `${Math.min(100, p.likes / 4)}%` }} /></div>
                  <div className="val">{p.likes}</div>
                  <div className="val dim">·{p.comments}c</div>
                </div>
              ))}
              {!ev.posts.length && <div className="dim mono">No post data.</div>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-hdr"><h3><span className="prefix">›</span>Club Recap History</h3><div className="meta">last {histLineSeries.length} recaps</div></div>
            <div className="panel-body" style={{ padding: 4 }}>
              <svg ref={lineRef} style={{ width: '100%', height: 200 }} />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hdr"><h3><span className="prefix">›</span>Peer Benchmark · same category</h3><div className="meta">{peerSame.length} comparable events</div></div>
          <table className="eden">
            <thead><tr><th>Event</th><th>Club</th><th>Day</th><th>Loc</th><th>Food</th><th className="r">Score</th><th className="r">Δ vs this</th></tr></thead>
            <tbody>
              {peerSame.map(p => {
                const d = +p.recap_engagement_score - +ev.recap_engagement_score;
                return (
                  <tr key={p.event_id}>
                    <td style={{ color: 'var(--fg)' }}>{p.event_name}</td>
                    <td>{p.club_name}</td>
                    <td className="dim">{p.day_of_week}</td>
                    <td className="dim">{p.campus_location}</td>
                    <td style={{ color: p.has_free_food ? 'var(--bullish)' : 'var(--muted)' }}>{p.has_free_food ? '✓' : '—'}</td>
                    <td className="r" style={{ color: +p.recap_engagement_score > 1 ? 'var(--bullish)' : 'var(--bearish)' }}>{(+p.recap_engagement_score).toFixed(2)}</td>
                    <td className={'r ' + (d > 0 ? 'up' : 'down')}>{d > 0 ? '+' : ''}{d.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CLUB COMPARE ─────────────────────────────────────────────────────────
function ComparePage() {
  const [clubId, setClubId] = useState(2); // ACM
  const comp = useMemo(() => api.clubComparison(clubId), [clubId]);
  const me = M.CLUBS.find(c => c.club_id === clubId);
  const sortedPeers = [...comp.peers].sort((a,b) => b.avg - a.avg);
  return (
    <div className="grid grid-5-7" style={{ gap: 10 }}>
      <div className="panel">
        <div className="panel-hdr">
          <h3><span className="prefix">›</span>Peer Ranking</h3>
          <div className="meta">semester engagement</div>
        </div>
        <table className="eden">
          <thead><tr><th>#</th><th>Club</th><th className="r">μ eng</th><th className="r">σ</th><th className="r">Events</th><th className="r">Trend</th></tr></thead>
          <tbody>
            {sortedPeers.map((p, i) => (
              <tr key={p.club_id} className={p.club_id === clubId ? 'selected' : ''} onClick={() => setClubId(p.club_id)}>
                <td className="dim">{String(i+1).padStart(2,'0')}</td>
                <td style={{ color: p.club_id === clubId ? 'var(--accent)' : 'var(--fg)' }}>{p.name}</td>
                <td className="r">{p.avg.toFixed(2)}</td>
                <td className="r dim">{p.stddev.toFixed(2)}</td>
                <td className="r dim">{p.total}</td>
                <td className={'r ' + (p.trend >= 0 ? 'up' : 'down')}>{p.trend >= 0 ? '+' : ''}{(p.trend * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="panel" style={{ marginBottom: 10 }}>
          <div className="panel-hdr"><h3><span className="prefix">›</span>{me.name} · You are here</h3><div className="meta">vs {M.CLUBS.length - 1} peers</div></div>
          <div className="mc-stats">
            <div className="mc-stat"><div className="l">Percentile</div><div className="v" style={{ color: 'var(--accent)' }}>{comp.percentile}</div></div>
            <div className="mc-stat"><div className="l">Rank</div><div className="v">#{comp.rank}</div></div>
            <div className="mc-stat"><div className="l">μ engagement</div><div className="v">{comp.me.avg.toFixed(2)}</div></div>
            <div className="mc-stat"><div className="l">Events (90d)</div><div className="v">{comp.me.total}</div></div>
            <div className="mc-stat"><div className="l">Trend</div><div className="v" style={{ color: comp.me.trend >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{comp.me.trend >= 0 ? '+' : ''}{(comp.me.trend * 100).toFixed(1)}%</div></div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-hdr"><h3><span className="prefix">›</span>Category Mix · You vs Top 3</h3></div>
            <div style={{ padding: 14 }}>
              {Object.entries(comp.me.catMix).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([cat, n]) => {
                const peerTop3 = sortedPeers.slice(0, 3).filter(p => p.club_id !== clubId);
                const peerMix = peerTop3.reduce((s, p) => s + (p.catMix[cat] || 0), 0) / Math.max(1, peerTop3.length);
                const max = Math.max(n, peerMix, 1);
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div className="bar-row"><div className="lbl" style={{ color: 'var(--accent)' }}>{cat}</div><div className="bar"><div className="fill" style={{ width: `${(n/max)*100}%` }} /></div><div className="val">{n}</div></div>
                    <div className="bar-row"><div className="lbl dim">peer μ</div><div className="bar"><div className="fill" style={{ width: `${(peerMix/max)*100}%`, background: 'var(--cyan)' }} /></div><div className="val dim">{peerMix.toFixed(1)}</div></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="panel">
            <div className="panel-hdr"><h3><span className="prefix">›</span>Percentile Band</h3></div>
            <div style={{ padding: 18 }}>
              <div style={{ position: 'relative', height: 20, background: 'linear-gradient(to right, rgba(255,107,107,0.3), rgba(247,185,85,0.3), rgba(102,209,158,0.4))', borderRadius: 2, marginBottom: 12 }}>
                <div style={{ position: 'absolute', left: `${comp.percentile}%`, top: -6, width: 2, height: 32, background: 'var(--fg)', transform: 'translateX(-1px)' }} />
                <div style={{ position: 'absolute', left: `${comp.percentile}%`, top: 28, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg)', transform: 'translateX(-50%)' }}>P{comp.percentile}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)' }}>
                <span>P0</span><span>P50</span><span>P100</span>
              </div>
              <div style={{ marginTop: 32, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-dim)', lineHeight: 1.7 }}>
                <div>› {me.name} sits at the <span style={{ color: 'var(--accent)' }}>{comp.percentile}th percentile</span> by semester engagement.</div>
                <div>› Closest peer above: <span style={{ color: 'var(--fg)' }}>{sortedPeers[Math.max(0, comp.rank - 2)]?.name || '—'}</span></div>
                <div>› Closest peer below: <span style={{ color: 'var(--fg)' }}>{sortedPeers[comp.rank]?.name || '—'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WHAT-IF SIMULATOR ────────────────────────────────────────────────────
function WhatIfPage() {
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }), []);
  const [id, setId] = useState(upcoming[0]?.event_id);
  const ev = api.getEvent(id);
  const [overrides, setOverrides] = useState({});
  useEffect(() => { setOverrides({}); }, [id]);

  const merged = { ...ev, ...overrides };
  const baseForecast = useMemo(() => ev ? api.forecast(id) : null, [id]);
  const whatIfForecast = useMemo(() => ev ? api.forecast(id, { overrides }) : null, [id, overrides]);

  const histRef = useChart(svg => {
    if (!baseForecast || !whatIfForecast) return;
    // Overlay histograms
    svg.innerHTML = '';
    charts.histogram(svg, baseForecast.samples);
    // Lightweight overlay: draw whatIf as second hist in different color
    const W = svg.clientWidth, H = svg.clientHeight;
    const pad = { l: 32, r: 12, t: 14, b: 22 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const lo = Math.min(...baseForecast.samples, ...whatIfForecast.samples);
    const hi = Math.max(...baseForecast.samples, ...whatIfForecast.samples);
    const bins = 28;
    const step = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const s of whatIfForecast.samples) counts[Math.min(bins-1, Math.floor((s-lo)/step))]++;
    const cmax = Math.max(...counts);
    const bw = iw / bins;
    const NS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < bins; i++) {
      const h = (counts[i]/cmax)*ih;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', pad.l + i*bw + 0.5);
      r.setAttribute('y', pad.t + ih - h);
      r.setAttribute('width', bw-1);
      r.setAttribute('height', h);
      r.setAttribute('fill', 'var(--cyan)');
      r.setAttribute('opacity', 0.55);
      svg.appendChild(r);
    }
  }, [baseForecast, whatIfForecast]);

  if (!ev) return null;
  const delta = whatIfForecast.p50 - baseForecast.p50;

  return (
    <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 10 }}>
      <div className="panel">
        <div className="panel-hdr"><h3><span className="prefix">›</span>Pick Upcoming</h3></div>
        <div className="ev-picker">
          <table className="eden">
            <tbody>
              {upcoming.map(e => (
                <tr key={e.event_id} className={id === e.event_id ? 'selected' : ''} onClick={() => setId(e.event_id)}>
                  <td>
                    <div style={{ color: 'var(--fg)' }}>{e.event_name}</div>
                    <div className="dim" style={{ fontSize: 9 }}>{e.club_name} · {e.date} · {e.day_of_week}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="panel" style={{ marginBottom: 10 }}>
          <div className="panel-hdr">
            <h3><span className="prefix">›</span>What-If · {ev.event_name}</h3>
            <div className="meta">baseline vs scenario</div>
          </div>
          <div className="sim-controls">
            <div className="control">
              <label>Day of Week</label>
              <select value={merged.day_of_week} onChange={e => setOverrides({ ...overrides, day_of_week: e.target.value })}>
                {M.DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="control">
              <label>Category</label>
              <select value={merged.event_category} onChange={e => setOverrides({ ...overrides, category: e.target.value, event_category: e.target.value })}>
                {M.CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="control">
              <label>Location</label>
              <select value={merged.campus_location || ''} onChange={e => setOverrides({ ...overrides, campus_location: e.target.value })}>
                {M.LOCS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="control">
              <label>&nbsp;</label>
              <label className="toggle"><input type="checkbox" checked={!!merged.has_free_food} onChange={e => setOverrides({ ...overrides, has_free_food: e.target.checked })} /> Free food</label>
            </div>
          </div>
          <div className="mc-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="mc-stat"><div className="l">Baseline P50</div><div className="v">{baseForecast.p50.toFixed(2)}</div></div>
            <div className="mc-stat"><div className="l">Scenario P50</div><div className="v" style={{ color: 'var(--cyan)' }}>{whatIfForecast.p50.toFixed(2)}</div></div>
            <div className="mc-stat"><div className="l">Δ P50</div><div className="v" style={{ color: delta >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</div></div>
            <div className="mc-stat"><div className="l">% change</div><div className="v" style={{ color: delta >= 0 ? 'var(--bullish)' : 'var(--bearish)' }}>{delta >= 0 ? '+' : ''}{(delta / baseForecast.p50 * 100).toFixed(1)}%</div></div>
          </div>
          <div className="panel-body" style={{ padding: 4 }}>
            <svg ref={histRef} style={{ width: '100%', height: 260 }} />
            <div className="legend" style={{ padding: '8px 12px 0' }}>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--accent)' }} />Baseline</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--cyan)' }} />Scenario</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COLLAB GRAPH ─────────────────────────────────────────────────────────
function GraphPage() {
  const graph = useMemo(() => api.collabGraph(), []);
  const ref = useChart(svg => charts.networkGraph(svg, graph), [graph]);
  const topEdges = [...graph.edges].sort((a,b) => b.weight - a.weight).slice(0, 12);
  return (
    <div className="grid grid-5-7" style={{ gap: 10 }}>
      <div className="panel">
        <div className="panel-hdr"><h3><span className="prefix">›</span>Collaboration Graph</h3><div className="meta">{graph.nodes.length} nodes · {graph.edges.length} edges</div></div>
        <div style={{ padding: 8 }}>
          <svg ref={ref} style={{ width: '100%', height: 520 }} />
        </div>
      </div>
      <div>
        <div className="panel" style={{ marginBottom: 10 }}>
          <div className="panel-hdr"><h3><span className="prefix">›</span>Top Partnerships</h3><div className="meta">by count</div></div>
          <table className="eden">
            <thead><tr><th>Partnership</th><th className="r">Events</th><th className="r">Lift</th></tr></thead>
            <tbody>
              {topEdges.map((e, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--fg)' }}>{e.source} ↔ {e.target}</td>
                  <td className="r">{e.weight}</td>
                  <td className="r up">+{(12 + Math.random()*25).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <div className="panel-hdr"><h3><span className="prefix">›</span>Suggested Partners for ACM</h3></div>
          <div style={{ padding: 12, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-dim)', lineHeight: 1.8 }}>
            <div>› <span style={{ color: 'var(--fg)' }}>GDSC</span> — overlapping audience (CS), never collabed. Est. lift <span style={{ color: 'var(--bullish)' }}>+18%</span></div>
            <div>› <span style={{ color: 'var(--fg)' }}>SHPE</span> — complementary cat mix (career). Est. lift <span style={{ color: 'var(--bullish)' }}>+14%</span></div>
            <div>› <span style={{ color: 'var(--fg)' }}>Robotics</span> — shared workshop audience. Est. lift <span style={{ color: 'var(--bullish)' }}>+11%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AUDIENCE / RSVP ──────────────────────────────────────────────────────
function RsvpPage() {
  const upcoming = useMemo(() => api.listEvents({ upcoming: true }).filter(e => api.listRsvps(e.event_id).length > 0), []);
  const [id, setId] = useState(upcoming[0]?.event_id);
  const breakdown = useMemo(() => id ? api.rsvpBreakdown(id) : null, [id]);
  const ev = api.getEvent(id);

  const majorEntries = breakdown ? Object.entries(breakdown.byMajor).sort((a,b) => b[1] - a[1]).slice(0, 8) : [];
  const majorTotal = majorEntries.reduce((s, [,n]) => s + n, 0) || 1;
  const donutRef = useChart(svg => breakdown && charts.donut(svg,
    majorEntries.map(([k,v], i) => ({ label: k, value: v, color: ['var(--accent)','var(--cyan)','#c8a4ff','#66d19e','#ff9e64','#f2c28c','#7aa2f7','#9ece6a'][i % 8] })),
    { centerLabel: String(breakdown.total), centerSub: 'RSVPs' }
  ), [breakdown]);

  const interestEntries = breakdown ? Object.entries(breakdown.byInterest).sort((a,b) => b[1] - a[1]).slice(0, 8) : [];

  if (!ev || !breakdown) return <div className="panel"><div className="panel-body dim">No RSVP data yet.</div></div>;

  return (
    <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 10 }}>
      <div className="panel">
        <div className="panel-hdr"><h3><span className="prefix">›</span>Upcoming w/ RSVPs</h3><div className="meta">{upcoming.length}</div></div>
        <div className="ev-picker">
          <table className="eden">
            <tbody>
              {upcoming.map(e => {
                const n = api.listRsvps(e.event_id).length;
                return (
                  <tr key={e.event_id} className={id === e.event_id ? 'selected' : ''} onClick={() => setId(e.event_id)}>
                    <td>
                      <div style={{ color: 'var(--fg)' }}>{e.event_name}</div>
                      <div className="dim" style={{ fontSize: 9 }}>{e.club_name} · {e.date}</div>
                    </td>
                    <td className="r">{n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="panel" style={{ marginBottom: 10 }}>
          <div className="panel-hdr"><h3><span className="prefix">›</span>{ev.event_name}</h3><div className="meta">{ev.date} · {breakdown.total} RSVPs</div></div>
          <div className="grid grid-2" style={{ padding: 14, gap: 14 }}>
            <div>
              <div className="label-sm" style={{ marginBottom: 10 }}>Major Distribution</div>
              <svg ref={donutRef} style={{ width: '100%', height: 200 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10 }}>
                {majorEntries.map(([k,v], i) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, background: ['var(--accent)','var(--cyan)','#c8a4ff','#66d19e','#ff9e64','#f2c28c','#7aa2f7','#9ece6a'][i % 8] }} />
                    <span style={{ color: 'var(--fg-dim)' }}>{k}</span>
                    <span className="dim" style={{ marginLeft: 'auto' }}>{((v/majorTotal)*100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom: 10 }}>Interest Overlap</div>
              {interestEntries.map(([k, v]) => (
                <div key={k} className="bar-row">
                  <div className="lbl">{k}</div>
                  <div className="bar"><div className="fill" style={{ width: `${(v / interestEntries[0][1]) * 100}%` }} /></div>
                  <div className="val">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-hdr"><h3><span className="prefix">›</span>RSVP Roster</h3><div className="meta">live stream · {breakdown.total} entries</div></div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table className="eden">
              <thead><tr><th>User</th><th>Major</th><th>Interests</th><th className="r">Status</th></tr></thead>
              <tbody>
                {breakdown.rsvps.slice(0, 40).map(r => (
                  <tr key={r.user_id}>
                    <td style={{ color: 'var(--fg)' }}>{r.user_name}</td>
                    <td className="dim">{r.user_major}</td>
                    <td className="dim" style={{ fontSize: 10 }}>{r.user_interests}</td>
                    <td className="r"><span className="chip" style={{ color: r.status === 'going' ? 'var(--bullish)' : 'var(--accent)', borderColor: 'currentColor' }}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Command Palette ──────────────────────────────────────────────────────
function useCmdk(setPage) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); setQ(''); setIdx(0); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const items = useMemo(() => {
    const all = [
      ...PAGES.map(p => ({ type: 'page', label: p.label, id: p.id, cat: 'GO' })),
      ...M.CLUBS.map(c => ({ type: 'club', label: c.name, id: c.club_id, cat: 'CLUB' })),
      ...M.EVENTS.slice(0, 60).map(e => ({ type: 'event', label: e.event_name, id: e.event_id, cat: 'EVENT', sub: e.club_name })),
    ];
    if (!q) return all.slice(0, 12);
    const qq = q.toLowerCase();
    return all.filter(i => i.label.toLowerCase().includes(qq) || (i.cat + '').toLowerCase().includes(qq)).slice(0, 14);
  }, [q]);
  const pick = useCallback((i) => {
    const it = items[i];
    if (!it) return;
    if (it.type === 'page') setPage(it.id);
    if (it.type === 'event') setPage('event');
    setOpen(false);
  }, [items, setPage]);
  useEffect(() => {
    const v = document.getElementById('cmdk-veil');
    const input = document.getElementById('cmdk-input');
    const list = document.getElementById('cmdk-list');
    if (!v || !list) return;
    v.classList.toggle('open', open);
    if (open) setTimeout(() => input?.focus(), 20);
    list.innerHTML = items.map((it, i) => `<li class="${i === idx ? 'active' : ''}" data-i="${i}"><span class="cat">${it.cat}</span> ${it.label} ${it.sub ? `<span style="color:var(--muted);margin-left:auto;font-size:10px">${it.sub}</span>` : ''}</li>`).join('');
    list.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => pick(+li.dataset.i));
    });
    input.oninput = (e) => { setQ(e.target.value); setIdx(0); };
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); pick(idx); }
    };
    v.onclick = (e) => { if (e.target === v) setOpen(false); };
  }, [open, items, idx, pick]);
  return { open: () => setOpen(true) };
}

// ── App ──────────────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState('overview');
  const cmdk = useCmdk(setPage);
  return (
    <div className="eden-shell" data-screen-label="EDEN Terminal">
      <Topbar openCmdk={cmdk.open} />
      <Nav page={page} setPage={setPage} />
      <div className="main">
        <Ticker />
        <div style={{ height: 10 }} />
        {page === 'overview' && <OverviewPage />}
        {page === 'forecast' && <ForecastPage />}
        {page === 'event' && <EventPage />}
        {page === 'compare' && <ComparePage />}
        {page === 'whatif' && <WhatIfPage />}
        {page === 'graph' && <GraphPage />}
        {page === 'rsvp' && <RsvpPage />}
      </div>
      <StatusBar page={page} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
