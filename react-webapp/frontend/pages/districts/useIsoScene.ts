import { useEffect, useRef, type RefObject } from "react";
import {
  BLDGS,
  DISTRICTS,
  DIST_META,
  type GridBuilding,
  type Tweaks,
  type DistrictId,
} from "./data";

type Pt = { x: number; y: number };

export type IsoSceneControls = {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  rotateCW(): void;
  rotateCCW(): void;
  focusBuilding(id: string): void;
};

type Options = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rotIndicatorRef: RefObject<SVGGElement | null>;
  rightChromeWidth: number;
  tweaks: Tweaks;
  selectedId: string | null;
  hoveredExternalId: string | null;
  onSelect: (id: string | null) => void;
  onHoverChange: (id: string | null) => void;
};

const TX = 46;
const TH = 26;
const ZMIN = 0.35;
const ZMAX = 3.0;
const ROT_PIVOT = { col: 9, row: 6 };
const CAMERA_TY: Record<Tweaks["camera"], number> = { steep: 18, standard: 24, low: 30 };

export function useIsoScene(opts: Options): IsoSceneControls {
  const { canvasRef, rotIndicatorRef } = opts;

  // Mutable scene state kept in refs so the render loop doesn't reach into React state.
  const stateRef = useRef({
    W: 0,
    H: 0,
    panX: 0,
    panY: 0,
    zoom: 1.0,
    TY: CAMERA_TY[opts.tweaks.camera],
    rotation: 0,
    rotAnim: 0,
    rotTarget: 0,
    rotRafOn: false,
    rightChromeWidth: opts.rightChromeWidth,
    tweaks: opts.tweaks,
    selectedId: opts.selectedId,
    hoveredId: null as string | null,
    needsRedraw: true,
    isDragging: false,
    dragMode: "pan" as "pan" | "rotate",
    dragSx: 0,
    dragSy: 0,
    startPX: 0,
    startPY: 0,
    rotStartAngle: 0,
  });

  // Keep the imperative controls reference stable across re-renders.
  const controlsRef = useRef<IsoSceneControls | null>(null);

  // Sync prop changes into the mutable state ref without re-creating the loop.
  useEffect(() => {
    stateRef.current.tweaks = opts.tweaks;
    stateRef.current.TY = CAMERA_TY[opts.tweaks.camera];
    stateRef.current.needsRedraw = true;
  }, [opts.tweaks]);

  useEffect(() => {
    stateRef.current.rightChromeWidth = opts.rightChromeWidth;
    clampPan();
    stateRef.current.needsRedraw = true;
  }, [opts.rightChromeWidth]);

  useEffect(() => {
    stateRef.current.selectedId = opts.selectedId;
    stateRef.current.needsRedraw = true;
  }, [opts.selectedId]);

  useEffect(() => {
    stateRef.current.hoveredId = opts.hoveredExternalId;
    stateRef.current.needsRedraw = true;
  }, [opts.hoveredExternalId]);

  // ── Helpers (closed over stateRef) ──────────────────────────────────────
  function rotateColRow(col: number, row: number, rot = stateRef.current.rotAnim) {
    const dx = col - ROT_PIVOT.col;
    const dy = row - ROT_PIVOT.row;
    const a = rot * Math.PI / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return {
      col: ROT_PIVOT.col + dx * c - dy * s,
      row: ROT_PIVOT.row + dx * s + dy * c,
    };
  }

  function iso(col: number, row: number, gy = 0): Pt {
    const s = stateRef.current;
    const r = rotateColRow(col, row);
    return {
      x: s.panX + (r.col - r.row) * TX * s.zoom,
      y: s.panY + (r.col + r.row) * s.TY * s.zoom - gy * TH * s.zoom,
    };
  }

  function sceneScreenBounds() {
    const corners: [number, number, number][] = [
      [-3, -3, 0], [22, -3, 0], [22, 15, 0], [-3, 15, 0],
      [16, 0, 20], [18, 0, 20], [18, 2, 20], [16, 2, 20],
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [c, r, h] of corners) {
      const p = iso(c, r, h);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY };
  }

  function clampPan() {
    const s = stateRef.current;
    const b = sceneScreenBounds();
    const margin = 120;
    const viewL = 0;
    const viewR = s.W - s.rightChromeWidth;
    const viewT = 0;
    const viewB = s.H;
    let dx = 0;
    let dy = 0;
    if (b.maxX < viewL + margin) dx = (viewL + margin) - b.maxX;
    else if (b.minX > viewR - margin) dx = (viewR - margin) - b.minX;
    if (b.maxY < viewT + margin) dy = (viewT + margin) - b.maxY;
    else if (b.minY > viewB - margin) dy = (viewB - margin) - b.minY;
    s.panX += dx;
    s.panY += dy;
  }

  function resetView() {
    const s = stateRef.current;
    s.zoom = 1.0;
    const aw = s.W - s.rightChromeWidth;
    const minSX = (0 - 13) * TX;
    const maxSX = 18 * TX;
    const minSY = -20 * TH;
    const maxSY = 30 * s.TY;
    s.panX = (aw - (maxSX - minSX)) / 2 - minSX + aw * 0.04;
    s.panY = (s.H - (maxSY - minSY)) / 2 - minSY - s.H * 0.04;
    clampPan();
    s.needsRedraw = true;
  }

  function zoomAt(sx: number, sy: number, factor: number) {
    const s = stateRef.current;
    const newZoom = Math.max(ZMIN, Math.min(ZMAX, s.zoom * factor));
    if (newZoom === s.zoom) return;
    const k = newZoom / s.zoom;
    s.panX = sx - (sx - s.panX) * k;
    s.panY = sy - (sy - s.panY) * k;
    s.zoom = newZoom;
    clampPan();
    s.needsRedraw = true;
  }

  function updateRotIndicator() {
    const el = rotIndicatorRef.current;
    if (el) el.style.transform = `rotate(${stateRef.current.rotTarget * 90}deg)`;
  }

  function stepRotation() {
    const s = stateRef.current;
    const diff = s.rotTarget - s.rotAnim;
    if (Math.abs(diff) < 0.002) {
      s.rotAnim = s.rotTarget;
      s.rotation = ((s.rotTarget % 4) + 4) % 4;
      s.rotRafOn = false;
      clampPan();
    } else {
      s.rotAnim += diff * 0.18;
      clampPan();
      requestAnimationFrame(stepRotation);
    }
    s.needsRedraw = true;
  }

  function rotateBy(delta: number) {
    const s = stateRef.current;
    s.rotTarget += delta;
    if (!s.rotRafOn) {
      s.rotRafOn = true;
      requestAnimationFrame(stepRotation);
    }
    updateRotIndicator();
  }

  // ── Painter sort & hit test ─────────────────────────────────────────────
  function sortKey(b: GridBuilding) {
    const corners: [number, number][] = [
      [b.col,       b.row],
      [b.col + b.w, b.row],
      [b.col + b.w, b.row + b.d],
      [b.col,       b.row + b.d],
    ];
    let minK = Infinity, maxK = -Infinity;
    for (const [c, r] of corners) {
      const p = rotateColRow(c, r);
      const k = p.col + p.row;
      if (k < minK) minK = k;
      if (k > maxK) maxK = k;
    }
    return minK * 1000 + maxK;
  }

  function pip(px: number, py: number, pts: Pt[]) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function hitTest(mx: number, my: number): GridBuilding | null {
    const sorted = BLDGS.slice().sort((a, b) => sortKey(a) - sortKey(b));
    for (let i = sorted.length - 1; i >= 0; i--) {
      const b = sorted[i];
      const { col, row, w, d, h } = b;
      const tl  = iso(col,   row,   h), tr  = iso(col + w, row,   h);
      const tfr = iso(col + w, row + d, h), tf = iso(col, row + d, h);
      const br  = iso(col + w, row,   0), bfr = iso(col + w, row + d, 0);
      const bf  = iso(col,   row + d, 0), bl = iso(col,   row, 0);
      if (
        pip(mx, my, [tl, tr, tfr, tf]) ||
        pip(mx, my, [tr, br, bfr, tfr]) ||
        pip(mx, my, [tf, tfr, bfr, bf]) ||
        pip(mx, my, [tl, tr, br, bl]) ||
        pip(mx, my, [tl, tf, bf, bl])
      ) return b;
    }
    return null;
  }

  // ── Drawing primitives ──────────────────────────────────────────────────
  function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill?: string) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }

  function edgeLine(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt, col: string, w: number, glowAlpha: number) {
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = col.replace(/[\d.]+\)$/, `${glowAlpha})`);
    ctx.lineWidth = w + 2.5;
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  function castellate(ctx: CanvasRenderingContext2D, tl: Pt, tr: Pt, color: string, notchCount = 6) {
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.9;
    const notchH = 4;
    for (let i = 0; i < notchCount; i++) {
      if (i % 2 === 0) continue;
      const t0 = i / notchCount;
      const t1 = (i + 1) / notchCount;
      const p0 = lerp(tl, tr, t0);
      const p1 = lerp(tl, tr, t1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y - notchH);
      ctx.lineTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x, p1.y - notchH);
      ctx.stroke();
    }
  }

  function windowFrames(ctx: CanvasRenderingContext2D, tl: Pt, tr: Pt, br: Pt, bl: Pt, cols: number, rows: number, color: string, lw = 0.5) {
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    const padU = 0.06, padV = 0.04;
    const cellU = (1 - padU * 2) / cols;
    const cellV = (1 - padV * 2) / rows;
    const winU = cellU * 0.68;
    const winV = cellV * 0.68;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = padU + (c + 0.5) * cellU;
        const v = padV + (r + 0.5) * cellV;
        const u0 = u - winU / 2, u1 = u + winU / 2;
        const v0 = v - winV / 2, v1 = v + winV / 2;
        const p00 = lerp(lerp(tl, tr, u0), lerp(bl, br, u0), v0);
        const p10 = lerp(lerp(tl, tr, u1), lerp(bl, br, u1), v0);
        const p11 = lerp(lerp(tl, tr, u1), lerp(bl, br, u1), v1);
        const p01 = lerp(lerp(tl, tr, u0), lerp(bl, br, u0), v1);
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
        ctx.closePath(); ctx.stroke();
      }
    }
  }

  function windowGrid(ctx: CanvasRenderingContext2D, tl: Pt, tr: Pt, br: Pt, bl: Pt, cols: number, rows: number, color: string) {
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    ctx.fillStyle = color;
    const padU = 0.14, padV = 0.10;
    const winU = (1 - padU * 2) / cols * 0.62;
    const winV = (1 - padV * 2) / rows * 0.62;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = padU + (c + 0.5) / cols * (1 - padU * 2);
        const v = padV + (r + 0.5) / rows * (1 - padV * 2);
        const u0 = u - winU / 2, u1 = u + winU / 2;
        const v0 = v - winV / 2, v1 = v + winV / 2;
        const p00 = lerp(lerp(tl, tr, u0), lerp(bl, br, u0), v0);
        const p10 = lerp(lerp(tl, tr, u1), lerp(bl, br, u1), v0);
        const p11 = lerp(lerp(tl, tr, u1), lerp(bl, br, u1), v1);
        const p01 = lerp(lerp(tl, tr, u0), lerp(bl, br, u0), v1);
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y); ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y); ctx.lineTo(p01.x, p01.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  function curtainStripes(ctx: CanvasRenderingContext2D, tl: Pt, tr: Pt, br: Pt, bl: Pt, cols: number, color: string) {
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < cols; c++) {
      const t = c / cols;
      const p0 = lerp(tl, tr, t);
      const p1 = lerp(bl, br, t);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }

  function horizontalBands(ctx: CanvasRenderingContext2D, tl: Pt, tr: Pt, br: Pt, bl: Pt, rows: number, color: string, lw = 0.4) {
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    for (let r = 1; r < rows; r++) {
      const t = r / rows;
      const p0 = lerp(tl, bl, t);
      const p1 = lerp(tr, br, t);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }

  function verticalPiers(ctx: CanvasRenderingContext2D, tl: Pt, tr: Pt, br: Pt, bl: Pt, cols: number, color: string, lw = 0.4) {
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    for (let c = 1; c < cols; c++) {
      const t = c / cols;
      const p0 = lerp(tl, tr, t);
      const p1 = lerp(bl, br, t);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }

  // ── Building render ─────────────────────────────────────────────────────
  type Corners = { tl: Pt; tr: Pt; tfr: Pt; tf: Pt; br: Pt; bfr: Pt; bf: Pt; bl: Pt };

  function drawFeature(ctx: CanvasRenderingContext2D, b: GridBuilding, c: Corners, edgeCol: string, ew: number, glowA: number) {
    const { col, row, w, d, h } = b;
    const feat = b.style.feat;
    if (!feat || feat === "none") return;
    const topFill = "#0d141e";
    const rightFill = "#070b11";
    const frontFill = "#090e15";
    const detailCol = edgeCol.replace(/rgba\(([^)]+)\)/, (_m, p: string) => {
      const parts = p.split(",");
      return `rgba(${parts[0]},${parts[1]},${parts[2]},0.42)`;
    });

    if (feat === "castellated") {
      castellate(ctx, c.tl, c.tr, edgeCol, Math.max(5, Math.round(w * 4)));
      castellate(ctx, c.tf, c.tfr, edgeCol, Math.max(5, Math.round(w * 4)));
    }

    if (feat === "spire") {
      const cx = col + w * 0.5, cz = row + d * 0.5;
      const tw = Math.min(w, d) * 0.35;
      const tcol0 = cx - tw / 2, tcol1 = cx + tw / 2;
      const trow0 = cz - tw / 2, trow1 = cz + tw / 2;
      const th = h + 4;
      const stl  = iso(tcol0, trow0, th);
      const str  = iso(tcol1, trow0, th);
      const stfr = iso(tcol1, trow1, th);
      const stf  = iso(tcol0, trow1, th);
      const sbr  = iso(tcol1, trow0, h);
      const sbfr = iso(tcol1, trow1, h);
      const sbf  = iso(tcol0, trow1, h);
      poly(ctx, [stl, str, stfr, stf], topFill);
      poly(ctx, [str, sbr, sbfr, stfr], rightFill);
      poly(ctx, [stf, stfr, sbfr, sbf], frontFill);
      edgeLine(ctx, stl, str, edgeCol, ew, glowA);
      edgeLine(ctx, str, stfr, edgeCol, ew, glowA);
      edgeLine(ctx, stfr, stf, edgeCol, ew, glowA);
      edgeLine(ctx, stf, stl, edgeCol, ew, glowA);
      edgeLine(ctx, str, sbr, edgeCol, ew, glowA);
      edgeLine(ctx, stfr, sbfr, edgeCol, ew, glowA);
      edgeLine(ctx, stf, sbf, edgeCol, ew, glowA);
      castellate(ctx, stl, str, edgeCol, 4);
      castellate(ctx, stf, stfr, edgeCol, 4);
    }

    if (feat === "setback") {
      const sw = w * 0.55, sd = d * 0.55;
      const scol = col + (w - sw) * 0.5;
      const srow = row + (d - sd) * 0.5;
      const sh = h + 1.2;
      const stl  = iso(scol,      srow,      sh);
      const str  = iso(scol + sw, srow,      sh);
      const stfr = iso(scol + sw, srow + sd, sh);
      const stf  = iso(scol,      srow + sd, sh);
      const sbr  = iso(scol + sw, srow,      h);
      const sbfr = iso(scol + sw, srow + sd, h);
      const sbf  = iso(scol,      srow + sd, h);
      poly(ctx, [stl, str, stfr, stf], topFill);
      poly(ctx, [str, sbr, sbfr, stfr], rightFill);
      poly(ctx, [stf, stfr, sbfr, sbf], frontFill);
      edgeLine(ctx, stl, str, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, str, stfr, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stfr, stf, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stf, stl, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, str, sbr, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stfr, sbfr, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stf, sbf, edgeCol, ew * 0.8, glowA);
    }

    if (feat === "parapet") {
      ctx.strokeStyle = edgeCol.replace(/[\d.]+\)$/, "0.55)");
      ctx.lineWidth = ew * 0.6;
      for (let k = 0; k < 2; k++) {
        const off = 3 + k * 2.5;
        const pa = { x: c.tf.x, y: c.tf.y + off };
        const pb = { x: c.tfr.x, y: c.tfr.y + off };
        const pc = { x: c.tr.x, y: c.tr.y + off };
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pc.x, pc.y); ctx.stroke();
      }
    }

    if (feat === "ribbon") {
      const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      ctx.strokeStyle = "rgba(50,70,90,0.55)";
      ctx.lineWidth = 1.4;
      const rows = Math.max(2, Math.round(h * 0.5));
      for (let r = 1; r < rows; r++) {
        const t = r / rows;
        const p0 = lerp(c.tf, c.bf, t);
        const p1 = lerp(c.tfr, c.bfr, t);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        const q0 = lerp(c.tr, c.br, t);
        const q1 = lerp(c.tfr, c.bfr, t);
        ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
      }
    }

    if (feat === "gothic-pavilion") {
      const cx = col + w * 0.5, cz = row + d * 0.5;
      const pw = Math.min(w, 1.4), pd = Math.min(d, 1.4);
      const pcol0 = cx - pw / 2, pcol1 = cx + pw / 2;
      const prow0 = cz - pd / 2, prow1 = cz + pd / 2;
      const ph = h + 4.5;
      const ptl  = iso(pcol0, prow0, ph);
      const ptr  = iso(pcol1, prow0, ph);
      const ptfr = iso(pcol1, prow1, ph);
      const ptf  = iso(pcol0, prow1, ph);
      const pbr  = iso(pcol1, prow0, h);
      const pbfr = iso(pcol1, prow1, h);
      const pbf  = iso(pcol0, prow1, h);
      poly(ctx, [ptl, ptr, ptfr, ptf], topFill);
      poly(ctx, [ptr, pbr, pbfr, ptfr], rightFill);
      poly(ctx, [ptf, ptfr, pbfr, pbf], frontFill);
      windowGrid(ctx, ptr, ptfr, pbfr, pbr, 2, 3, detailCol);
      windowGrid(ctx, ptf, ptfr, pbfr, pbf, 2, 3, detailCol);
      edgeLine(ctx, ptl, ptr, edgeCol, ew, glowA);
      edgeLine(ctx, ptr, ptfr, edgeCol, ew, glowA);
      edgeLine(ctx, ptfr, ptf, edgeCol, ew, glowA);
      edgeLine(ctx, ptf, ptl, edgeCol, ew, glowA);
      edgeLine(ctx, ptr, pbr, edgeCol, ew, glowA);
      edgeLine(ctx, ptfr, pbfr, edgeCol, ew, glowA);
      edgeLine(ctx, ptf, pbf, edgeCol, ew, glowA);
      castellate(ctx, ptl, ptr, edgeCol, 5);
      castellate(ctx, ptf, ptfr, edgeCol, 5);
      castellate(ctx, c.tl, c.tr, edgeCol, Math.max(6, Math.round(w * 3)));
      castellate(ctx, c.tf, c.tfr, edgeCol, Math.max(6, Math.round(w * 3)));
    }

    if (feat === "atrium-cyl") {
      const cxCol = col + 0.2, cxRow = row + d - 0.1;
      const rad = 0.3;
      const cylH = h + 0.8;
      const topC  = iso(cxCol, cxRow, cylH);
      const baseC = iso(cxCol, cxRow, 0);
      const s = stateRef.current;
      const rx = rad * TX * s.zoom;
      const ry = rad * s.TY * s.zoom;
      ctx.save();
      ctx.fillStyle = "rgba(14,20,30,0.70)";
      ctx.beginPath();
      ctx.moveTo(baseC.x - rx, baseC.y);
      ctx.lineTo(topC.x - rx, topC.y);
      ctx.ellipse(topC.x, topC.y, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(baseC.x + rx, baseC.y);
      ctx.ellipse(baseC.x, baseC.y, rx, ry, 0, 0, Math.PI, false);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edgeCol;
      ctx.lineWidth = ew * 0.9;
      ctx.beginPath(); ctx.moveTo(baseC.x - rx, baseC.y); ctx.lineTo(topC.x - rx, topC.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(baseC.x + rx, baseC.y); ctx.lineTo(topC.x + rx, topC.y); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(topC.x, topC.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      const aw = w * 0.5;
      const acol = col + w * 0.5 - aw * 0.5;
      const ah = h * 0.7;
      const adepth = 0.4;
      const aRow0 = row + d, aRow1 = row + d + adepth;
      const atl  = iso(acol,      aRow0, ah);
      const atr  = iso(acol + aw, aRow0, ah);
      const atfr = iso(acol + aw, aRow1, ah);
      const atf  = iso(acol,      aRow1, ah);
      const abr  = iso(acol + aw, aRow0, 0);
      const abfr = iso(acol + aw, aRow1, 0);
      const abf  = iso(acol,      aRow1, 0);
      poly(ctx, [atl, atr, atfr, atf], "rgba(20,28,40,0.75)");
      poly(ctx, [atr, abr, abfr, atfr], "rgba(12,18,26,0.80)");
      poly(ctx, [atf, atfr, abfr, abf], "rgba(14,22,32,0.80)");
      curtainStripes(ctx, atr, atfr, abfr, abr, 3, "rgba(160,185,215,0.45)");
      curtainStripes(ctx, atf, atfr, abfr, abf, 5, "rgba(160,185,215,0.45)");
      edgeLine(ctx, atl, atr, edgeCol, ew * 0.85, glowA);
      edgeLine(ctx, atr, atfr, edgeCol, ew * 0.85, glowA);
      edgeLine(ctx, atfr, atf, edgeCol, ew * 0.85, glowA);
      edgeLine(ctx, atr, abr, edgeCol, ew * 0.85, glowA);
      edgeLine(ctx, atfr, abfr, edgeCol, ew * 0.85, glowA);
      edgeLine(ctx, atf, abf, edgeCol, ew * 0.85, glowA);
    }

    if (feat === "tower-crown") {
      const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      const crownT = 0.78;
      ctx.save();
      const rtl = c.tr, rbl = c.br, rtr = c.tfr, rbr = c.bfr;
      const rt0 = lerp(rtl, rbl, 1 - crownT), rt1 = lerp(rtr, rbr, 1 - crownT);
      poly(ctx, [rtl, rtr, rt1, rt0], "rgba(16,24,36,0.65)");
      const ftl = c.tf, fbl = c.bf, ftr = c.tfr, fbr = c.bfr;
      const ft0 = lerp(ftl, fbl, 1 - crownT), ft1 = lerp(ftr, fbr, 1 - crownT);
      poly(ctx, [ftl, ftr, ft1, ft0], "rgba(18,26,38,0.65)");
      ctx.strokeStyle = "rgba(180,200,225,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(rt0.x, rt0.y); ctx.lineTo(rt1.x, rt1.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ft0.x, ft0.y); ctx.lineTo(ft1.x, ft1.y); ctx.stroke();
      ctx.restore();
      const sw = w * 0.45, sd = d * 0.45;
      const scol = col + (w - sw) * 0.5, srow = row + (d - sd) * 0.5;
      const sh = h + 1.5;
      const stl  = iso(scol,      srow,      sh);
      const str  = iso(scol + sw, srow,      sh);
      const stfr = iso(scol + sw, srow + sd, sh);
      const stf  = iso(scol,      srow + sd, sh);
      const sbr  = iso(scol + sw, srow,      h);
      const sbfr = iso(scol + sw, srow + sd, h);
      const sbf  = iso(scol,      srow + sd, h);
      poly(ctx, [stl, str, stfr, stf], topFill);
      poly(ctx, [str, sbr, sbfr, stfr], rightFill);
      poly(ctx, [stf, stfr, sbfr, sbf], frontFill);
      edgeLine(ctx, stl, str, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, str, stfr, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stfr, stf, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stf, stl, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, str, sbr, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stfr, sbfr, edgeCol, ew * 0.8, glowA);
      edgeLine(ctx, stf, sbf, edgeCol, ew * 0.8, glowA);
    }
  }

  function drawBuilding(ctx: CanvasRenderingContext2D, b: GridBuilding) {
    const s = stateRef.current;
    const { col, row, w, d, h, dist } = b;
    const isHov = s.hoveredId === b.id;
    const isSel = s.selectedId === b.id;
    const dc = DIST_META[dist as DistrictId]?.color || "#aaa";
    const style = b.style;

    const glowMap: Record<Tweaks["glow"], number> = { subtle: 0.04, medium: 0.10, vivid: 0.18 };
    const glowA = glowMap[s.tweaks.glow];
    const ew = isSel ? 0.9 : isHov ? 0.75 : 0.55;

    const edgeBase = isSel ? "rgba(240,250,255,1.0)"
                   : isHov ? "rgba(230,245,255,0.98)"
                           : "rgba(200,225,250,0.95)";
    const detailCol = isSel ? "rgba(230,245,255,0.95)"
                    : isHov ? "rgba(210,235,250,0.82)"
                            : "rgba(180,210,235,0.72)";

    // Ground footprint (district tint)
    const gpad = 0.12;
    const gbl0  = iso(col - gpad, row - gpad, 0);
    const gbr0  = iso(col + w + gpad, row - gpad, 0);
    const gbfr0 = iso(col + w + gpad, row + d + gpad, 0);
    const gbf0  = iso(col - gpad, row + d + gpad, 0);
    ctx.save();
    ctx.fillStyle = dc + "10";
    ctx.strokeStyle = dc + (isSel ? "cc" : isHov ? "88" : "55");
    ctx.lineWidth = isSel ? 1.6 : 1.0;
    ctx.beginPath();
    ctx.moveTo(gbl0.x, gbl0.y);
    ctx.lineTo(gbr0.x, gbr0.y);
    ctx.lineTo(gbfr0.x, gbfr0.y);
    ctx.lineTo(gbf0.x, gbf0.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const tl  = iso(col,       row,       h);
    const tr  = iso(col + w,   row,       h);
    const tfr = iso(col + w,   row + d,   h);
    const tf  = iso(col,       row + d,   h);
    const br  = iso(col + w,   row,       0);
    const bfr = iso(col + w,   row + d,   0);
    const bf  = iso(col,       row + d,   0);
    const bl  = iso(col,       row,       0);

    const sides = [
      { name: "right", tlC: tr, trC: br, brC: bfr, blC: tfr, key: rotateColRow(col + w, row + d / 2) },
      { name: "front", tlC: tf, trC: tfr, brC: bfr, blC: bf, key: rotateColRow(col + w / 2, row + d) },
      { name: "left",  tlC: tl, trC: tf, brC: bf,  blC: bl, key: rotateColRow(col,     row + d / 2) },
      { name: "back",  tlC: tl, trC: tr, brC: br,  blC: bl, key: rotateColRow(col + w / 2, row    ) },
    ];
    sides.sort((a, b2) => (a.key.col + a.key.row) - (b2.key.col + b2.key.row));
    const visibleFaces = sides.slice(2);

    const topFill   = isSel ? "#162030" : isHov ? "#111a27" : "#0d141e";
    const rightFill = isSel ? "#0c131d" : isHov ? "#090e16" : "#070b11";
    const frontFill = isSel ? "#0f1823" : isHov ? "#0b1219" : "#090e15";

    poly(ctx, [tl, tr, tfr, tf], topFill);
    for (const f of visibleFaces) {
      const fill = f === visibleFaces[0] ? rightFill : frontFill;
      poly(ctx, [f.tlC, f.trC, f.brC, f.blC], fill);
    }

    const wCols = Math.max(2, Math.round(w * 3));
    const dCols = Math.max(2, Math.round(d * 3));
    const wRows = Math.max(3, Math.round(h * 0.7));

    if (style.feat === "curtain-wall" || style.feat === "tower-crown") {
      for (const f of visibleFaces) {
        const cols = (f.name === "right" || f.name === "left") ? dCols : wCols;
        verticalPiers(ctx, f.tlC, f.trC, f.brC, f.blC, cols * 2, detailCol, ew * 0.35);
        horizontalBands(ctx, f.tlC, f.trC, f.brC, f.blC, Math.round(wRows / 2), detailCol, ew * 0.3);
      }
    } else if (style.mat === "stone-gray") {
      for (const f of visibleFaces) {
        horizontalBands(ctx, f.tlC, f.trC, f.brC, f.blC, wRows, detailCol, ew * 0.45);
        verticalPiers(ctx, f.tlC, f.trC, f.brC, f.blC, 2, detailCol, ew * 0.35);
      }
    } else if (style.mat === "gothic" || style.mat === "industrial-brick" || style.mat === "red-brick") {
      for (const f of visibleFaces) {
        const cols = (f.name === "right" || f.name === "left") ? dCols : wCols;
        windowFrames(ctx, f.tlC, f.trC, f.brC, f.blC, cols, wRows, detailCol, ew * 0.35);
        horizontalBands(ctx, f.tlC, f.trC, f.brC, f.blC, wRows, detailCol, ew * 0.25);
      }
    } else {
      for (const f of visibleFaces) {
        const cols = (f.name === "right" || f.name === "left") ? dCols : wCols;
        windowFrames(ctx, f.tlC, f.trC, f.brC, f.blC, cols, wRows, detailCol, ew * 0.35);
      }
    }

    if (isHov || isSel) {
      ctx.save();
      poly(ctx, [tl, tr, tfr, tf]);
      ctx.clip();
      ctx.fillStyle = dc + (isSel ? "26" : "12");
      ctx.fill();
      ctx.restore();
    }

    edgeLine(ctx, tl, tr, edgeBase, ew, glowA);
    edgeLine(ctx, tr, tfr, edgeBase, ew, glowA);
    edgeLine(ctx, tfr, tf, edgeBase, ew, glowA);
    edgeLine(ctx, tf, tl, edgeBase, ew, glowA);
    edgeLine(ctx, tr, br, edgeBase, ew, glowA);
    edgeLine(ctx, tfr, bfr, edgeBase, ew, glowA);
    edgeLine(ctx, tf, bf, edgeBase, ew, glowA);
    edgeLine(ctx, tl, bl, edgeBase, ew, glowA);
    for (const f of visibleFaces) {
      edgeLine(ctx, f.blC, f.brC, edgeBase, ew, glowA);
    }

    drawFeature(ctx, b, { tl, tr, tfr, tf, br, bfr, bf, bl }, edgeBase, ew, glowA);
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Cache district bounds once (relative to grid — rotation-independent).
  const districtBoundsCache: Partial<Record<DistrictId, { col0: number; col1: number; row0: number; row1: number }>> = {};
  for (const bb of BLDGS) {
    const current = districtBoundsCache[bb.dist] ?? { col0: Infinity, col1: -Infinity, row0: Infinity, row1: -Infinity };
    current.col0 = Math.min(current.col0, bb.col);
    current.col1 = Math.max(current.col1, bb.col + bb.w);
    current.row0 = Math.min(current.row0, bb.row);
    current.row1 = Math.max(current.row1, bb.row + bb.d);
    districtBoundsCache[bb.dist] = current;
  }

  function drawDistrictPlates(ctx: CanvasRenderingContext2D) {
    const pad = 0.6;
    for (const id of Object.keys(districtBoundsCache) as DistrictId[]) {
      const bb = districtBoundsCache[id];
      const meta = DIST_META[id];
      if (!bb || !meta) continue;
      const c0 = bb.col0 - pad, c1 = bb.col1 + pad;
      const r0 = bb.row0 - pad, r1 = bb.row1 + pad;
      const p00 = iso(c0, r0, 0);
      const p10 = iso(c1, r0, 0);
      const p11 = iso(c1, r1, 0);
      const p01 = iso(c0, r1, 0);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fillStyle = meta.color + "18";
      ctx.fill();
      ctx.strokeStyle = meta.color + "55";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = meta.color + "88";
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      const labelAnchor = iso(c0 + 0.2, r0 + 0.2, 0);
      ctx.font = "600 10px Inter, sans-serif";
      ctx.fillStyle = meta.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(meta.short, labelAnchor.x + 4, labelAnchor.y + 12);
    }
  }

  const nameLookup = new Map<string, string>();
  for (const d of DISTRICTS) for (const b of d.buildings) nameLookup.set(b.id, b.name);

  // ── Main render ─────────────────────────────────────────────────────────
  function render(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    if (!s.needsRedraw) return;
    s.needsRedraw = false;

    ctx.clearRect(0, 0, s.W, s.H);
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, s.W, s.H);

    const vg = ctx.createRadialGradient(s.W * 0.42, s.H * 0.5, 0, s.W * 0.42, s.H * 0.5, s.W * 0.75);
    vg.addColorStop(0, "rgba(10,16,28,0)");
    vg.addColorStop(1, "rgba(2,3,8,0.85)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, s.W, s.H);

    const gc = [iso(-3, -3, 0), iso(22, -3, 0), iso(22, 15, 0), iso(-3, 15, 0)];
    ctx.fillStyle = "#080c14";
    ctx.beginPath();
    ctx.moveTo(gc[0].x, gc[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(gc[i].x, gc[i].y);
    ctx.closePath();
    ctx.fill();

    if (s.tweaks.floors !== "off") {
      ctx.strokeStyle = "rgba(140,170,200,0.08)";
      ctx.lineWidth = 0.5;
      for (let cc = -3; cc <= 22; cc++) {
        const a = iso(cc, -3, 0), b = iso(cc, 15, 0);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (let rr = -3; rr <= 15; rr++) {
        const a = iso(-3, rr, 0), b = iso(22, rr, 0);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    drawDistrictPlates(ctx);

    const sortedBldgs = BLDGS.slice().sort((a, b) => sortKey(a) - sortKey(b));
    for (const b of sortedBldgs) drawBuilding(ctx, b);

    const hoveredB = s.hoveredId ? BLDGS.find((x) => x.id === s.hoveredId) : null;
    const selectedB = s.selectedId ? BLDGS.find((x) => x.id === s.selectedId) : null;
    if (hoveredB && hoveredB.id !== selectedB?.id) drawLabelWithName(ctx, hoveredB);
    if (selectedB) drawLabelWithName(ctx, selectedB);
  }

  function drawLabelWithName(ctx: CanvasRenderingContext2D, b: GridBuilding) {
    const name = nameLookup.get(b.id) || b.id;
    const { col, row, w, d, h } = b;
    const cx = col + w / 2, cz = row + d / 2;
    const top = iso(cx, cz, h);
    const lx = top.x, ly = top.y - 20;
    const label = (name.length > 22 ? name.slice(0, 20) + "…" : name).toUpperCase();

    ctx.font = '500 10px "JetBrains Mono", "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(label).width;
    const pw = tw + 22, ph = 22;
    const bx = lx - pw / 2, by = ly - ph;

    ctx.beginPath();
    ctx.moveTo(lx, top.y - 2);
    ctx.lineTo(lx, by + ph);
    ctx.strokeStyle = "rgba(210,225,245,0.5)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.fillStyle = "#03060b";
    ctx.strokeStyle = "rgba(210,225,245,0.85)";
    ctx.lineWidth = 0.8;
    roundRect(ctx, bx, by, pw, ph, 1);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(235,245,255,0.95)";
    ctx.fillText(label, lx, by + ph / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = canvas.parentElement;

    function resize() {
      const rect = container?.getBoundingClientRect();
      const s = stateRef.current;
      s.W = canvas.width = rect?.width ?? window.innerWidth;
      s.H = canvas.height = rect?.height ?? window.innerHeight;
      resetView();
    }

    resize();

    const resizeObserver = new ResizeObserver(resize);
    if (container) resizeObserver.observe(container);

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const f = Math.pow(1.0015, -e.deltaY);
      zoomAt(sx, sy, f);
    }

    function onMouseMove(e: MouseEvent) {
      const s = stateRef.current;
      if (s.isDragging) {
        if (s.dragMode === "rotate") {
          const dx = e.clientX - s.dragSx;
          s.rotTarget = s.rotStartAngle + dx / 90;
          s.rotAnim = s.rotTarget;
          s.rotation = ((Math.round(s.rotTarget) % 4) + 4) % 4;
          clampPan();
          updateRotIndicator();
          s.needsRedraw = true;
        } else {
          s.panX = s.startPX + (e.clientX - s.dragSx);
          s.panY = s.startPY + (e.clientY - s.dragSy);
          clampPan();
          s.needsRedraw = true;
        }
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      const newId = hit ? hit.id : null;
      if (newId !== s.hoveredId) {
        s.hoveredId = newId;
        canvas.style.cursor = hit ? "pointer" : "";
        s.needsRedraw = true;
        opts.onHoverChange(newId);
      }
    }

    function onMouseDown(e: MouseEvent) {
      const s = stateRef.current;
      s.dragSx = e.clientX;
      s.dragSy = e.clientY;
      s.startPX = s.panX;
      s.startPY = s.panY;
      s.dragMode = e.ctrlKey || e.metaKey || e.shiftKey ? "rotate" : "pan";
      s.rotStartAngle = s.rotTarget;
      s.isDragging = true;
      canvas.style.cursor = s.dragMode === "rotate" ? "grabbing" : "";
    }

    function onMouseUp(e: MouseEvent) {
      const s = stateRef.current;
      if (!s.isDragging) return;
      const dx = e.clientX - s.dragSx;
      const dy = e.clientY - s.dragSy;
      const wasRotate = s.dragMode === "rotate";
      s.isDragging = false;
      canvas.style.cursor = "";
      if (wasRotate) {
        s.rotTarget = Math.round(s.rotTarget);
        if (!s.rotRafOn) {
          s.rotRafOn = true;
          requestAnimationFrame(stepRotation);
        }
        updateRotIndicator();
        return;
      }
      if (Math.hypot(dx, dy) < 5) {
        const rect = canvas.getBoundingClientRect();
        const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) opts.onSelect(hit.id);
        else opts.onSelect(null);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") opts.onSelect(null);
      if (e.key === "r" || e.key === "R") rotateBy(1);
      if ((e.key === "Control" || e.key === "Meta" || e.key === "Shift") && !stateRef.current.isDragging) {
        canvas.style.cursor = "grab";
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if ((e.key === "Control" || e.key === "Meta" || e.key === "Shift") && !stateRef.current.isDragging) {
        canvas.style.cursor = "";
      }
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let rafId = 0;
    function loop() {
      render(ctx!);
      rafId = requestAnimationFrame(loop);
    }
    loop();

    controlsRef.current = {
      zoomIn: () => zoomAt(stateRef.current.W / 2, stateRef.current.H / 2, 1.25),
      zoomOut: () => zoomAt(stateRef.current.W / 2, stateRef.current.H / 2, 1 / 1.25),
      reset: () => resetView(),
      rotateCW: () => rotateBy(1),
      rotateCCW: () => rotateBy(-1),
      focusBuilding: (id: string) => {
        const s = stateRef.current;
        s.selectedId = id;
        s.needsRedraw = true;
      },
    };

    updateRotIndicator();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Return a stable proxy that delegates to the current controls (set inside effect).
  const stableControls = useRef<IsoSceneControls>({
    zoomIn:  () => controlsRef.current?.zoomIn(),
    zoomOut: () => controlsRef.current?.zoomOut(),
    reset:   () => controlsRef.current?.reset(),
    rotateCW:  () => controlsRef.current?.rotateCW(),
    rotateCCW: () => controlsRef.current?.rotateCCW(),
    focusBuilding: (id: string) => controlsRef.current?.focusBuilding(id),
  });

  return stableControls.current;
}
