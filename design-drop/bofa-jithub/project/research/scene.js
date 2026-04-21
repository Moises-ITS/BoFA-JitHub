// research/scene.js — JitHub Research Districts 3D scene (vanilla Three.js)

const ResearchScene = (() => {
  'use strict';

  // ── Module state ───────────────────────────────────────────────────────────
  let renderer, scene, camera, clock, animId;
  let container, labelContainer;
  let districtObjs = []; // { clickMesh, glowMesh, glowMat, district, labelEl }
  let buildingObjs = []; // { mesh, edgeMesh, glowMesh, glowMat, mat, edgeMat, district, building, baseY, anim, target }
  let beams = [];        // { mesh, start, dir, len, speed, phase }
  let focused = null;
  let selected = null;
  let hoveredBldg = null;
  let hoveredDist = null;

  const mouse  = { x: 0, y: 0 };
  const rc     = { ray: null };
  const cbs    = { onDistrict: null, onBuilding: null, onHover: null, onEmpty: null };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function darken(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }

  // ── Orbit (horizontal drag only) ─────────────────────────────────────────
  const orbit = {
    theta: 0.4, phi: 1.08,
    curTx: 0, curTy: 0, curTz: 0,
    desTx: 0, desTy: 0, desTz: 0,
    curR: 16.2, desR: 16.2,
    _down: false, _sx: 0, _sy: 0,
    _cbs: [],

    attach(el) {
      el.addEventListener('mousedown',  e => this._start(e.clientX, e.clientY));
      window.addEventListener('mousemove', e => this._move(e.clientX));
      window.addEventListener('mouseup',   e => this._end(e.clientX, e.clientY));
      el.addEventListener('touchstart', e => { if (e.touches.length === 1) this._start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
      window.addEventListener('touchmove',  e => { if (e.touches.length === 1) this._move(e.touches[0].clientX); }, { passive: true });
      window.addEventListener('touchend',   e => { const t = e.changedTouches[0]; this._end(t.clientX, t.clientY); });
    },
    _start(x, y) { this._down = true; this._sx = x; this._sy = y; },
    _move(x)     { if (this._down) { this.theta -= (x - this._sx) * 0.005; this._sx = x; } },
    _end(x, y)   { if (this._down && Math.hypot(x - this._sx, y - this._sy) < 6) this._cbs.forEach(fn => fn(x, y)); this._down = false; },
    onClick(fn)  { this._cbs.push(fn); },

    focusOn(px, pz) { this.desTx = px; this.desTy = 0; this.desTz = pz; this.desR = 8.4; },
    reset()          { this.desTx = 0; this.desTy = 0; this.desTz = 0; this.desR = 16.2; },

    update() {
      this.curTx = lerp(this.curTx, this.desTx, 0.08);
      this.curTy = lerp(this.curTy, this.desTy, 0.08);
      this.curTz = lerp(this.curTz, this.desTz, 0.08);
      this.curR  = lerp(this.curR,  this.desR,  0.08);
      const cx = this.curTx + this.curR * Math.sin(this.phi) * Math.sin(this.theta);
      const cy = this.curTy + this.curR * Math.cos(this.phi);
      const cz = this.curTz + this.curR * Math.sin(this.phi) * Math.cos(this.theta);
      camera.position.set(cx, cy, cz);
      camera.lookAt(this.curTx, this.curTy, this.curTz);
    }
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(el, lblEl) {
    container = el; labelContainer = lblEl;
    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b10);
    scene.fog = new THREE.Fog(0x090b10, 22, 42);

    camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 100);

    orbit.attach(container);
    orbit.update();

    rc.ray = new THREE.Raycaster();
    orbit.onClick((x, y) => handleClick(x, y));
    container.addEventListener('mousemove', handleMouseMove);

    window.addEventListener('resize', onResize);

    buildLights();
    buildGround();
    buildHub();
    DISTRICTS.forEach(d => { buildDistrict(d); buildBuildings(d); });
    buildBeams();

    loop();
  }

  // ── Lights ────────────────────────────────────────────────────────────────
  function buildLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xb8d4f8, 1.3);
    dir.position.set(10, 14, 6);
    scene.add(dir);
    DISTRICTS.forEach(d => {
      const pl = new THREE.PointLight(new THREE.Color(d.color), 1.6, 20);
      pl.position.set(d.position[0], 5, d.position[2]);
      scene.add(pl);
    });
  }

  // ── Ground ────────────────────────────────────────────────────────────────
  function buildGround() {
    const gm = new THREE.MeshStandardMaterial({ color: 0x050816, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 72), gm);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    const gmat = new THREE.MeshBasicMaterial({ color: 0x0d1428, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (let i = -14; i <= 14; i += 2) {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.02), gmat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, -0.01, i); scene.add(h);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 28), gmat);
      v.rotation.x = -Math.PI / 2; v.position.set(i, -0.01, 0); scene.add(v);
    }
  }

  // ── Central hub ───────────────────────────────────────────────────────────
  function buildHub() {
    const mat1 = new THREE.MeshStandardMaterial({ color: 0xe8eef8, roughness: 0.18, metalness: 0.42, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.22 });
    const hub1 = new THREE.Mesh(new THREE.SphereGeometry(0.54, 28, 28), mat1);
    hub1.position.set(0, 0.62, 0); scene.add(hub1);

    const mat2 = new THREE.MeshStandardMaterial({ color: 0xb7c8de, roughness: 0.22, metalness: 0.36, emissive: new THREE.Color(0xdce8f8), emissiveIntensity: 0.18 });
    const hub2 = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 20), mat2);
    hub2.position.set(0, 0.62, 0); scene.add(hub2);

    const tubeMat = new THREE.MeshStandardMaterial({ color: 0xcfd7e2, roughness: 0.3, metalness: 0.32, transparent: true, opacity: 0.76 });
    DISTRICTS.forEach(d => {
      const s = new THREE.Vector3(0, 0.62, 0);
      const e = new THREE.Vector3(d.position[0], 0.24, d.position[2]);
      const dir = new THREE.Vector3().subVectors(e, s);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
      const q   = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 10), tubeMat);
      tube.position.copy(mid); tube.quaternion.copy(q); scene.add(tube);
    });
  }

  // ── District platforms + labels ───────────────────────────────────────────
  function buildDistrict(d) {
    const [px,, pz] = d.position;
    const rs = d.ringScale;
    const col = new THREE.Color(d.color);

    // Platform
    const platMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(darken(d.color, 0.14)), roughness: 0.84, metalness: 0.2, emissive: col, emissiveIntensity: 0.06 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(rs * 0.78, rs * 0.78, 0.06, 48), platMat);
    plat.position.set(px, -0.02, pz); scene.add(plat);

    // Outer ring
    const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(rs * 0.92, rs * 1.06, 72), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(px, 0.01, pz); scene.add(ring);

    // Glow disk (animatable opacity)
    const glowMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
    const glowMesh = new THREE.Mesh(new THREE.CircleGeometry(rs * 0.86, 48), glowMat);
    glowMesh.rotation.x = -Math.PI / 2; glowMesh.position.set(px, 0.015, pz); scene.add(glowMesh);

    // Click target (invisible, sits above glow)
    const clickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });
    const clickMesh = new THREE.Mesh(new THREE.CircleGeometry(rs * 0.86, 48), clickMat);
    clickMesh.rotation.x = -Math.PI / 2; clickMesh.position.set(px, 0.02, pz); scene.add(clickMesh);

    // HTML label
    const lbl = document.createElement('div');
    lbl.className = 'district-label';
    lbl.innerHTML = `<div class="dl-dot" style="background:${d.color}"></div><div class="dl-name">${d.name}</div><div class="dl-stat">${d.buildings.length} buildings</div>`;
    labelContainer.appendChild(lbl);

    districtObjs.push({ clickMesh, glowMesh, glowMat, district: d, labelEl: lbl, col });
  }

  // ── Buildings ─────────────────────────────────────────────────────────────
  function buildBuildings(d) {
    const [px,, pz] = d.position;
    const dcol = new THREE.Color(d.color);

    d.buildings.forEach(b => {
      const [ox,, oz] = b.offset;
      const [bw, bh, bd] = b.size;
      const wx = px + ox, wz = pz + oz;
      const baseY = bh / 2 + 0.05;

      // Body
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x0c1220), roughness: 0.25, metalness: 0.88,
        emissive: dcol, emissiveIntensity: 0.35, transparent: true, opacity: 1.0
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      mesh.position.set(wx, baseY, wz); mesh.visible = false; scene.add(mesh);

      // Wireframe edges
      const edgeMat = new THREE.LineBasicMaterial({ color: dcol, transparent: true, opacity: 0.28 });
      const edgeMesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(bw, bh, bd)), edgeMat);
      edgeMesh.position.set(wx, baseY, wz); edgeMesh.visible = false; scene.add(edgeMesh);

      // Glow disk at base
      const glowMat = new THREE.MeshBasicMaterial({ color: dcol, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
      const glowMesh = new THREE.Mesh(new THREE.CircleGeometry(Math.max(bw, bd) * 0.85, 28), glowMat);
      glowMesh.rotation.x = -Math.PI / 2; glowMesh.position.set(wx, 0.04, wz); glowMesh.visible = false; scene.add(glowMesh);

      buildingObjs.push({ mesh, edgeMesh, glowMesh, glowMat, mat, edgeMat, district: d, building: b, baseY, anim: 0, target: 0 });
    });
  }

  // ── Flow beams (animated glowing particles along hub lines) ──────────────
  function buildBeams() {
    DISTRICTS.forEach((d, i) => {
      const s = new THREE.Vector3(d.position[0], 0.24, d.position[2]);
      const e = new THREE.Vector3(0, 0.62, 0);
      const raw = new THREE.Vector3().subVectors(e, s);
      const len  = raw.length();
      const norm = raw.clone().normalize();
      const q    = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
      const blen = 0.36;
      const bmat = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.color), transparent: true, opacity: 0.9, depthWrite: false });
      const bmesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, blen, 6), bmat);
      bmesh.quaternion.copy(q); scene.add(bmesh);
      beams.push({ mesh: bmesh, start: s, norm, len, blen, speed: 0.07 + i * 0.012, phase: i * 0.2 });
    });
  }

  // ── Raycasting helpers ────────────────────────────────────────────────────
  function getClickTargets() {
    if (!focused) return districtObjs.map(o => o.clickMesh);
    return buildingObjs.filter(o => o.mesh.visible && o.district.id === focused.id).map(o => o.mesh);
  }

  function getRay(cx, cy) {
    const rect = container.getBoundingClientRect();
    const nx   = ((cx - rect.left)  / rect.width)  * 2 - 1;
    const ny   = -((cy - rect.top)  / rect.height) * 2 + 1;
    rc.ray.setFromCamera({ x: nx, y: ny }, camera);
    return rc.ray.intersectObjects(getClickTargets());
  }

  function handleClick(cx, cy) {
    const hits = getRay(cx, cy);
    if (hits.length > 0) {
      if (!focused) {
        const obj = districtObjs.find(o => o.clickMesh === hits[0].object);
        if (obj && cbs.onDistrict) cbs.onDistrict(obj.district);
      } else {
        const obj = buildingObjs.find(o => o.mesh === hits[0].object);
        if (obj && cbs.onBuilding) cbs.onBuilding(obj.building, obj.district);
      }
    } else {
      if (cbs.onEmpty) cbs.onEmpty();
    }
  }

  function handleMouseMove(e) {
    const hits = getRay(e.clientX, e.clientY);
    if (hits.length > 0) {
      container.style.cursor = 'pointer';
      if (!focused) {
        hoveredDist = districtObjs.find(o => o.clickMesh === hits[0].object)?.district || null;
        hoveredBldg = null;
      } else {
        const obj = buildingObjs.find(o => o.mesh === hits[0].object) || null;
        hoveredBldg = obj;
        hoveredDist = null;
        if (cbs.onHover) cbs.onHover(obj ? obj.building : null, e.clientX, e.clientY);
      }
    } else {
      container.style.cursor = 'default';
      if (hoveredBldg && cbs.onHover) cbs.onHover(null, 0, 0);
      hoveredBldg = null; hoveredDist = null;
    }
  }

  // ── Public controls ───────────────────────────────────────────────────────
  function focusDistrict(d) {
    focused = d; selected = null;
    orbit.focusOn(d.position[0], d.position[2]);
    buildingObjs.forEach(o => {
      if (o.district.id === d.id) {
        o.mesh.visible = true; o.edgeMesh.visible = true; o.glowMesh.visible = true; o.target = 1;
      } else { o.target = 0; }
    });
  }

  function resetFocus() {
    focused = null; selected = null; hoveredBldg = null;
    orbit.reset();
    buildingObjs.forEach(o => { o.target = 0; });
  }

  function setSelected(b) { selected = b; }

  // ── Render loop ───────────────────────────────────────────────────────────
  function loop() {
    animId = requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
    orbit.update();

    // Beams
    beams.forEach(bm => {
      const frac = (t * bm.speed + bm.phase) % 1.0;
      const dist = frac * (bm.len - bm.blen) + bm.blen * 0.5;
      const pos  = bm.start.clone().addScaledVector(bm.norm, dist);
      bm.mesh.position.copy(pos);
    });

    // Buildings
    buildingObjs.forEach(o => {
      const isSel  = selected?.id === o.building.id;
      const isHov  = hoveredBldg?.building?.id === o.building.id;
      const isDim  = !!selected && !isSel && !!focused;

      o.anim = lerp(o.anim, o.target, 0.12);
      const s = o.anim;

      if (s < 0.01 && o.target === 0) {
        if (o.mesh.visible) { o.mesh.visible = false; o.edgeMesh.visible = false; o.glowMesh.visible = false; }
      } else {
        o.mesh.scale.y = s; o.edgeMesh.scale.y = s;
      }

      const ty = o.baseY + (isSel ? 0.22 : isHov ? 0.12 : 0);
      const ny = lerp(o.mesh.position.y, ty, 0.12);
      o.mesh.position.setY(ny);
      o.edgeMesh.position.setY(ny);

      const tei = isSel ? 1.4 : isHov ? 0.9 : isDim ? 0.07 : 0.35;
      const top = isDim ? 0.25 : 1.0;
      const teo = isHov || isSel ? 0.65 : isDim ? 0.06 : 0.28;
      const tgo = isSel ? 0.18 : isHov ? 0.10 : 0.0;

      o.mat.emissiveIntensity = lerp(o.mat.emissiveIntensity, tei, 0.12);
      o.mat.opacity           = lerp(o.mat.opacity, top, 0.10);
      o.edgeMat.opacity       = lerp(o.edgeMat.opacity, teo, 0.12);
      o.glowMat.opacity       = lerp(o.glowMat.opacity, tgo, 0.12);
    });

    // District glow disks
    districtObjs.forEach(o => {
      const isF = focused?.id === o.district.id;
      const isH = hoveredDist?.id === o.district.id;
      o.glowMat.opacity = lerp(o.glowMat.opacity, isF ? 0.10 : isH ? 0.07 : 0.0, 0.08);
    });

    updateLabels();
    renderer.render(scene, camera);
  }

  // ── Label projection ──────────────────────────────────────────────────────
  function updateLabels() {
    const w = container.clientWidth, h = container.clientHeight;
    districtObjs.forEach(({ district, labelEl }) => {
      const wp = new THREE.Vector3(district.position[0], 2.2, district.position[2]);
      wp.project(camera);
      if (wp.z > 1.0) { labelEl.style.display = 'none'; return; }
      const x = (wp.x * 0.5 + 0.5) * w;
      const y = (-wp.y * 0.5 + 0.5) * h;
      labelEl.style.display = 'block';
      labelEl.style.left    = x + 'px';
      labelEl.style.top     = y + 'px';
      const op = focused ? 0 : 1;
      labelEl.style.opacity = op;
    });
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  return {
    init,
    focusDistrict,
    resetFocus,
    setSelected,
    cb: cbs,
  };
})();
