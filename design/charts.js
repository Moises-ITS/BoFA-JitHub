// ───────────────────────────────────────────────────────────────────────────
// EDEN — Chart primitives (SVG, Bloomberg-terminal aesthetic)
// All charts take (svgEl, data, opts) and render in-place. No deps.
// Palette is set via CSS custom properties so it inherits from the parent.
// ───────────────────────────────────────────────────────────────────────────
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const clear = (svg) => { while (svg.firstChild) svg.removeChild(svg.firstChild); };

  // ── Fan chart ─────────────────────────────────────────────────────────
  // data: { paths: [[{day,value}]], mu, p10, p50, p90, historicalMu }
  function fanChart(svg, data, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 640, H = svg.clientHeight || 260;
    const pad = { l: 44, r: 12, t: 18, b: 24 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const allV = data.paths.flatMap(p => p.map(pt => pt.value));
    const ymin = 0, ymax = Math.max(...allV, data.p90) * 1.1;
    const days = data.paths[0].length - 1;

    const x = d => pad.l + (d / days) * iw;
    const y = v => pad.t + ih - ((v - ymin) / (ymax - ymin)) * ih;

    // Grid
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + (i / 4) * ih;
      el('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, stroke: 'var(--grid)', 'stroke-dasharray': '2 4' }, svg);
      const label = (ymax - (i / 4) * (ymax - ymin)).toFixed(2);
      el('text', { x: pad.l - 6, y: yy + 3, 'text-anchor': 'end', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = label;
    }

    // Paths (individual MC samples)
    for (const path of data.paths.slice(0, 40)) {
      const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.day)} ${y(p.value)}`).join(' ');
      el('path', { d, stroke: 'var(--line)', 'stroke-width': 0.6, fill: 'none', opacity: 0.18 }, svg);
    }

    // P10/P50/P90 percentile bands as horizontal reference lines at event day
    const drawRef = (v, label, color, dashed) => {
      el('line', { x1: pad.l, y1: y(v), x2: W - pad.r, y2: y(v), stroke: color, 'stroke-width': 1, 'stroke-dasharray': dashed ? '4 3' : '' }, svg);
      el('text', { x: W - pad.r - 4, y: y(v) - 3, 'text-anchor': 'end', fill: color, 'font-family': 'var(--mono)', 'font-size': 10, 'font-weight': 600 }, svg).textContent = label;
    };
    drawRef(data.p90, `P90  ${data.p90.toFixed(2)}`, 'var(--accent-dim)', true);
    drawRef(data.p50, `P50  ${data.p50.toFixed(2)}`, 'var(--accent)', false);
    drawRef(data.p10, `P10  ${data.p10.toFixed(2)}`, 'var(--accent-dim)', true);

    // Historical baseline
    if (data.historicalMu != null) {
      el('line', { x1: pad.l, y1: y(data.historicalMu), x2: W - pad.r, y2: y(data.historicalMu), stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '1 3' }, svg);
      el('text', { x: pad.l + 4, y: y(data.historicalMu) - 3, fill: 'var(--muted)', 'font-family': 'var(--mono)', 'font-size': 9 }, svg).textContent = `hist  μ=${data.historicalMu.toFixed(2)}`;
    }

    // X axis
    for (let i = 0; i <= days; i += Math.max(1, Math.floor(days / 6))) {
      el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = `T-${days - i}`;
    }
  }

  // ── Histogram ─────────────────────────────────────────────────────────
  function histogram(svg, samples, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 640, H = svg.clientHeight || 220;
    const pad = { l: 32, r: 12, t: 14, b: 22 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const bins = opts.bins || 28;
    const lo = Math.min(...samples), hi = Math.max(...samples);
    const step = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const s of samples) {
      const i = Math.min(bins - 1, Math.floor((s - lo) / step));
      counts[i]++;
    }
    const cmax = Math.max(...counts);
    const bw = iw / bins;
    for (let i = 0; i < bins; i++) {
      const h = (counts[i] / cmax) * ih;
      el('rect', {
        x: pad.l + i * bw + 0.5, y: pad.t + ih - h,
        width: bw - 1, height: h,
        fill: 'var(--accent)', opacity: 0.72,
      }, svg);
    }
    // P10/P50/P90 verticals
    const sorted = [...samples].sort((a,b) => a-b);
    const mark = (q, label) => {
      const v = sorted[Math.floor(q * sorted.length)];
      const xx = pad.l + ((v - lo) / (hi - lo)) * iw;
      el('line', { x1: xx, y1: pad.t, x2: xx, y2: pad.t + ih, stroke: 'var(--fg)', 'stroke-dasharray': '2 3', opacity: 0.7 }, svg);
      el('text', { x: xx, y: pad.t - 4, 'text-anchor': 'middle', fill: 'var(--fg)', 'font-family': 'var(--mono)', 'font-size': 9 }, svg).textContent = label;
    };
    mark(0.10, 'P10'); mark(0.50, 'P50'); mark(0.90, 'P90');
    // X axis labels
    for (let i = 0; i <= 4; i++) {
      const v = lo + (i / 4) * (hi - lo);
      el('text', { x: pad.l + (i / 4) * iw, y: H - 6, 'text-anchor': 'middle', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = v.toFixed(2);
    }
  }

  // ── Tornado chart ─────────────────────────────────────────────────────
  function tornado(svg, data) {
    clear(svg);
    const W = svg.clientWidth || 640, H = svg.clientHeight || 220;
    const pad = { l: 120, r: 50, t: 10, b: 24 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const bw = ih / data.length;
    const maxAbs = Math.max(...data.map(d => Math.max(Math.abs(d.low), Math.abs(d.high))));
    const xc = pad.l + iw / 2;
    const x = v => xc + (v / maxAbs) * (iw / 2);

    // Center axis
    el('line', { x1: xc, y1: pad.t, x2: xc, y2: pad.t + ih, stroke: 'var(--grid)' }, svg);

    data.forEach((d, i) => {
      const y0 = pad.t + i * bw + 6;
      const h = bw - 12;
      // Low (negative) bar
      el('rect', { x: x(d.low), y: y0, width: xc - x(d.low), height: h, fill: 'var(--bearish)', opacity: 0.8 }, svg);
      // High (positive) bar
      el('rect', { x: xc, y: y0, width: x(d.high) - xc, height: h, fill: 'var(--bullish)', opacity: 0.8 }, svg);
      // Label
      el('text', { x: pad.l - 8, y: y0 + h/2 + 3, 'text-anchor': 'end', fill: 'var(--fg)', 'font-family': 'var(--sans)', 'font-size': 11 }, svg).textContent = d.feature;
      // Values
      el('text', { x: x(d.low) - 4, y: y0 + h/2 + 3, 'text-anchor': 'end', fill: 'var(--bearish)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = d.low.toFixed(2);
      el('text', { x: x(d.high) + 4, y: y0 + h/2 + 3, fill: 'var(--bullish)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = '+' + d.high.toFixed(2);
    });
  }

  // ── Sparkline (for tables) ────────────────────────────────────────────
  function sparkline(svg, values, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 80, H = svg.clientHeight || 20;
    if (!values.length) return;
    const lo = Math.min(...values), hi = Math.max(...values);
    const range = hi - lo || 1;
    const x = i => (i / (values.length - 1)) * (W - 2) + 1;
    const y = v => H - ((v - lo) / range) * (H - 2) - 1;
    const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
    el('path', { d, stroke: opts.color || 'var(--accent)', 'stroke-width': 1.25, fill: 'none' }, svg);
    // Last point dot
    el('circle', { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 1.6, fill: opts.color || 'var(--accent)' }, svg);
  }

  // ── Sparkbar ──────────────────────────────────────────────────────────
  function sparkbar(svg, values) {
    clear(svg);
    const W = svg.clientWidth || 80, H = svg.clientHeight || 20;
    if (!values.length) return;
    const hi = Math.max(...values, 1);
    const bw = W / values.length;
    values.forEach((v, i) => {
      const h = (v / hi) * H;
      el('rect', { x: i * bw, y: H - h, width: Math.max(1, bw - 0.5), height: h, fill: 'var(--accent)', opacity: 0.75 }, svg);
    });
  }

  // ── Time-series line ──────────────────────────────────────────────────
  function lineChart(svg, series, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 640, H = svg.clientHeight || 200;
    const pad = { l: 36, r: 12, t: 14, b: 22 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    if (!series.length) return;
    const vals = series.map(p => p.value);
    const lo = Math.min(...vals, 0), hi = Math.max(...vals) * 1.1;
    const x = i => pad.l + (i / (series.length - 1 || 1)) * iw;
    const y = v => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

    // Grid
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + (i / 4) * ih;
      el('line', { x1: pad.l, y1: yy, x2: W - pad.r, y2: yy, stroke: 'var(--grid)', 'stroke-dasharray': '2 4' }, svg);
      const v = hi - (i / 4) * (hi - lo);
      el('text', { x: pad.l - 6, y: yy + 3, 'text-anchor': 'end', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = v.toFixed(2);
    }

    // Area fill
    const areaPath = [
      `M ${x(0)} ${y(lo)}`,
      ...series.map((p, i) => `L ${x(i)} ${y(p.value)}`),
      `L ${x(series.length - 1)} ${y(lo)} Z`,
    ].join(' ');
    el('path', { d: areaPath, fill: 'var(--accent)', opacity: 0.12 }, svg);

    // Line
    const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
    el('path', { d: linePath, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5 }, svg);

    // Dots
    series.forEach((p, i) => el('circle', { cx: x(i), cy: y(p.value), r: 2, fill: 'var(--accent)' }, svg));

    // Labels — only show a few dates
    if (opts.dates) {
      const step = Math.max(1, Math.floor(series.length / 5));
      series.forEach((p, i) => {
        if (i % step === 0) {
          el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 9 }, svg).textContent = (opts.dates[i] || '').slice(5);
        }
      });
    }
  }

  // ── Network graph (force-directed, cheap) ─────────────────────────────
  function networkGraph(svg, graph, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 600, H = svg.clientHeight || 420;
    const { nodes, edges } = graph;
    // Initial circular layout
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      n.x = W/2 + Math.cos(a) * Math.min(W,H) * 0.32;
      n.y = H/2 + Math.sin(a) * Math.min(W,H) * 0.32;
      n.vx = 0; n.vy = 0;
    });
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    // Simulate
    for (let it = 0; it < 180; it++) {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i+1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx*dx + dy*dy + 0.01;
          const f = 1800 / d2;
          const d = Math.sqrt(d2);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      }
      // Attraction along edges
      for (const e of edges) {
        const a = byId[e.source], b = byId[e.target];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        const f = (d - 80) * 0.015 * (e.weight || 1);
        a.vx += (dx/d) * f; a.vy += (dy/d) * f;
        b.vx -= (dx/d) * f; b.vy -= (dy/d) * f;
      }
      // Centering + damping
      for (const n of nodes) {
        n.vx += (W/2 - n.x) * 0.003;
        n.vy += (H/2 - n.y) * 0.003;
        n.x += n.vx * 0.5; n.y += n.vy * 0.5;
        n.vx *= 0.6; n.vy *= 0.6;
        n.x = Math.max(20, Math.min(W - 20, n.x));
        n.y = Math.max(20, Math.min(H - 20, n.y));
      }
    }
    // Draw edges
    for (const e of edges) {
      const a = byId[e.source], b = byId[e.target];
      if (!a || !b) continue;
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--accent)', 'stroke-width': Math.min(3, e.weight * 0.8), opacity: 0.35 }, svg);
    }
    // Draw nodes
    for (const n of nodes) {
      const r = 5 + Math.sqrt(n.followers || 100) * 0.18;
      el('circle', { cx: n.x, cy: n.y, r, fill: 'var(--panel)', stroke: 'var(--accent)', 'stroke-width': 1.5 }, svg);
      el('text', { x: n.x, y: n.y + r + 11, 'text-anchor': 'middle', fill: 'var(--fg)', 'font-family': 'var(--sans)', 'font-size': 10 }, svg).textContent = n.id;
    }
  }

  // ── Heatmap (day x hour) ──────────────────────────────────────────────
  function heatmap(svg, matrix, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 640, H = svg.clientHeight || 220;
    const pad = { l: 42, r: 12, t: 14, b: 22 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const rows = matrix.length, cols = matrix[0].length;
    const cw = iw / cols, ch = ih / rows;
    const flat = matrix.flat().filter(v => v != null);
    const hi = Math.max(...flat, 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = matrix[r][c] || 0;
        const op = v / hi;
        el('rect', { x: pad.l + c * cw, y: pad.t + r * ch, width: cw - 1, height: ch - 1, fill: 'var(--accent)', opacity: op }, svg);
      }
    }
    // Row labels
    (opts.rowLabels || []).forEach((lb, r) => {
      el('text', { x: pad.l - 6, y: pad.t + r * ch + ch/2 + 3, 'text-anchor': 'end', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 10 }, svg).textContent = lb;
    });
    (opts.colLabels || []).forEach((lb, c) => {
      if (c % 2 === 0)
        el('text', { x: pad.l + c * cw + cw/2, y: H - 6, 'text-anchor': 'middle', fill: 'var(--axis)', 'font-family': 'var(--mono)', 'font-size': 9 }, svg).textContent = lb;
    });
  }

  // ── Donut ─────────────────────────────────────────────────────────────
  function donut(svg, entries, opts = {}) {
    clear(svg);
    const W = svg.clientWidth || 180, H = svg.clientHeight || 180;
    const cx = W/2, cy = H/2;
    const r1 = Math.min(W,H) * 0.42, r0 = r1 * 0.58;
    const total = entries.reduce((s,e) => s + e.value, 0) || 1;
    let a0 = -Math.PI / 2;
    entries.forEach((e, i) => {
      const a1 = a0 + (e.value / total) * Math.PI * 2;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const x0 = cx + Math.cos(a0) * r1, y0 = cy + Math.sin(a0) * r1;
      const x1 = cx + Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
      const xi1 = cx + Math.cos(a1) * r0, yi1 = cy + Math.sin(a1) * r0;
      const xi0 = cx + Math.cos(a0) * r0, yi0 = cy + Math.sin(a0) * r0;
      const d = `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r0} ${r0} 0 ${large} 0 ${xi0} ${yi0} Z`;
      el('path', { d, fill: e.color || `var(--accent)`, opacity: 0.85 - i * 0.08 }, svg);
      a0 = a1;
    });
    if (opts.centerLabel) {
      el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', fill: 'var(--fg)', 'font-family': 'var(--mono)', 'font-size': 18, 'font-weight': 600 }, svg).textContent = opts.centerLabel;
      if (opts.centerSub)
        el('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-family': 'var(--mono)', 'font-size': 9 }, svg).textContent = opts.centerSub;
    }
  }

  window.EDEN_CHARTS = { fanChart, histogram, tornado, sparkline, sparkbar, lineChart, networkGraph, heatmap, donut };
})();
