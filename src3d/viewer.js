// 3D-wandeling door het ontwerp: lopen op ooghoogte of rondkijken in vogelvlucht, met de zon op een
// gekozen dag en tijd. Werkt met muis en toetsenbord (laptop) en met aanraken (iPad: joystick + slepen).
// Wordt gebundeld met three.js tot js/vendor/tuin3d.js (zie tools/build3d.sh); zowel de app als een
// los geëxporteerd bestand (.html) gebruiken deze viewer.

import * as THREE from 'three';
import { sunPosition, localDate, sunTimes } from '../js/sun.js';

const EYE = 1.6; // ooghoogte (m)
const WALK = 1.4; // wandeltempo (m/s)

const CSS = `
.w3d{position:absolute;inset:0;overflow:hidden;background:#bcd7ea;font:14px/1.35 system-ui,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2b36;user-select:none;-webkit-user-select:none}
.w3d canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block;outline:none}
.w3d-bar{position:absolute;left:10px;right:10px;top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;pointer-events:none}
.w3d-bar>*{pointer-events:auto}
.w3d-grp{display:flex;gap:4px;align-items:center;background:rgba(255,255,255,.9);border-radius:10px;padding:4px;box-shadow:0 1px 4px rgba(0,0,0,.18)}
.w3d button{font:inherit;border:0;background:transparent;color:inherit;padding:7px 11px;border-radius:7px;cursor:pointer;white-space:nowrap}
.w3d button:hover{background:rgba(0,0,0,.06)}
.w3d button.on{background:#2f6b3a;color:#fff}
.w3d input[type=date]{font:inherit;border:1px solid #cfd6d0;border-radius:6px;padding:4px 6px;background:#fff;color:inherit}
.w3d input[type=range]{width:150px}
.w3d .w3d-clock{min-width:44px;text-align:right;font-variant-numeric:tabular-nums}
.w3d-grp[hidden]{display:none}
.w3d-title{font-weight:600;padding:0 8px}
.w3d-help{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(29,43,54,.78);color:#fff;padding:7px 12px;border-radius:9px;font-size:13px;max-width:calc(100% - 180px);text-align:center;pointer-events:none;transition:opacity .4s}
.w3d-stick{position:absolute;left:22px;bottom:22px;width:124px;height:124px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.75);touch-action:none;display:none}
.w3d.touch .w3d-stick{display:block}
.w3d.orbit .w3d-stick{display:none}
.w3d-knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 1px 5px rgba(0,0,0,.3)}
.w3d-err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center}
@media (pointer:coarse){.w3d-stick{display:block}}
@media (max-width:700px){.w3d input[type=range]{width:100px}.w3d-help{max-width:calc(100% - 40px);bottom:160px}}
`;

function injectCss(doc) {
  if (doc.getElementById('w3d-css')) return;
  const st = doc.createElement('style');
  st.id = 'w3d-css';
  st.textContent = CSS;
  doc.head.appendChild(st);
}

const pad = (n) => String(n).padStart(2, '0');
const clock = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60) % 60)}`;
const todayYmd = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Richting naar de zon in de 3D-wereld (x = oost op de tekening, z = omlaag op de tekening, y = omhoog). */
export function sunDirection(sun, northRot = 0) {
  const az = (sun.azimuth * Math.PI) / 180, alt = (sun.altitude * Math.PI) / 180;
  const c = Math.cos(northRot), s = Math.sin(northRot);
  const north = [s, -c]; // [0,-1] gedraaid
  const east = [c, s]; // [1,0] gedraaid
  const tx = north[0] * Math.cos(az) + east[0] * Math.sin(az);
  const tz = north[1] * Math.cos(az) + east[1] * Math.sin(az);
  return new THREE.Vector3(tx * Math.cos(alt), Math.sin(alt), tz * Math.cos(alt)).normalize();
}

/**
 * opts: {
 *   container, content (THREE.Object3D, in meters), info: { title, box:{minX,minY,maxX,maxY}, start:{x,y,yaw},
 *   lat, lon, northRot, ymd, minutes }, onDate(ymd) (optioneel: andere maand → host bouwt opnieuw), onClose
 * }
 */
export function createViewer(opts) {
  const { container } = opts;
  const info = { ...opts.info };
  const doc = container.ownerDocument;
  injectCss(doc);

  const root = doc.createElement('div');
  root.className = 'w3d';
  container.appendChild(root);
  const canvas = doc.createElement('canvas');
  canvas.tabIndex = 0;
  root.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    root.innerHTML = `<div class="w3d-err">3D wordt op dit apparaat of in deze browser niet ondersteund (WebGL ontbreekt).</div>`;
    return { el: root, toolbar: root, dispose: () => root.remove(), setContent() {}, render() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const box = info.box || { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  const cx = (box.minX + box.maxX) / 2, cz = (box.minY + box.maxY) / 2;
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY, 10);

  const scene = new THREE.Scene();
  const sky = new THREE.Color('#bcd7ea');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, size * 2.5, size * 9 + 150);
  const hemi = new THREE.HemisphereLight('#e4f0ff', '#6d7a52', 0.55);
  scene.add(hemi);
  // licht uit de hele lucht (omgevingskaart): zachter, voller licht en weerspiegeling in water en glas
  try {
    const envScene = new THREE.Scene();
    const eg = new THREE.SphereGeometry(10, 32, 16), ec = [], ep = eg.attributes.position, top = new THREE.Color('#5d8fd0'), hor = new THREE.Color('#eef3f2'), gnd = new THREE.Color('#6f7f52'), t2 = new THREE.Color();
    for (let i = 0; i < ep.count; i++) { const y = ep.getY(i) / 10; if (y >= 0) t2.copy(hor).lerp(top, Math.pow(y, 0.55)); else t2.copy(hor).lerp(gnd, Math.min(1, -y * 4)); ec.push(t2.r, t2.g, t2.b); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(ec, 3));
    envScene.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.7;
    pm.dispose();
  } catch (err) { /* zonder omgevingslicht */ }
  // lucht: van licht aan de horizon naar blauw boven
  const domeGeo = new THREE.SphereGeometry(size * 10 + 300, 32, 16);
  const dc = [], dp = domeGeo.attributes.position, horizon = new THREE.Color('#e3ecef'), zenith = new THREE.Color('#6f9fd6'), tmp = new THREE.Color();
  for (let i = 0; i < dp.count; i++) { const t = Math.max(0, dp.getY(i) / (size * 10 + 300)); tmp.copy(horizon).lerp(zenith, Math.pow(t, 0.6)); dc.push(tmp.r, tmp.g, tmp.b); }
  domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.name = 'lucht';
  dome.position.set(cx, 0, cz);
  dome.renderOrder = -1;
  scene.add(dome);
  const sunLight = new THREE.DirectionalLight('#fff4e2', 2.6);
  sunLight.castShadow = true;
  const sr = size * 0.75 + 6;
  Object.assign(sunLight.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr, near: 0.5, far: sr * 4 });
  sunLight.shadow.mapSize.set(size > 60 ? 4096 : 2048, size > 60 ? 4096 : 2048);
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  sunLight.target.position.set(cx, 0, cz);
  scene.add(sunLight, sunLight.target);

  // omgeving buiten het ontwerp: een groot, rustig grasveld
  const outer = new THREE.Mesh(new THREE.CircleGeometry(size * 9 + 150, 48), new THREE.MeshStandardMaterial({ color: '#a9b48e', roughness: 1 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(cx, -0.02, cz);
  outer.receiveShadow = true;
  outer.name = 'omgeving';
  scene.add(outer);

  // wind: planten en bomen bewegen zachtjes (in de vertex shader; kost bijna niets)
  const windTime = { value: 0 };
  let windOn = !(typeof location !== 'undefined' && /[?&]nowind\b/.test(location.search)) && !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  let lastRender = 0;
  const hookWind = (m) => {
    if (!m || m.userData.wind || m.name !== 'planten') return;
    m.userData.wind = true;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = windTime;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 wp = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #ifdef USE_INSTANCING
            wp += instanceMatrix[3].xyz;
          #endif
          float hgt = clamp(position.y, 0.0, 7.0);
          float ph = wp.x * 0.37 + wp.z * 0.29 + position.x * 0.9 + position.z * 0.8;
          float sway = sin(uWind * 1.3 + ph) * 0.6 + sin(uWind * 2.1 + ph * 1.7) * 0.4;
          float flutter = sin(uWind * 6.5 + position.x * 11.0 + position.y * 7.0 + position.z * 9.0);
          transformed.x += (sway * 0.011 * hgt + flutter * 0.004) * step(0.02, hgt);
          transformed.z += (cos(uWind * 1.1 + ph * 1.3) * 0.008 * hgt + flutter * 0.003) * step(0.02, hgt);
        }`);
    };
    m.customProgramCacheKey = () => 'wind';
    m.needsUpdate = true;
  };

  let content = null;
  function setContent(obj) {
    if (content) {
      scene.remove(content);
      disposeTree(content);
    }
    content = obj;
    content.traverse((o) => {
      if (!o.isMesh) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(hookWind);
      const ground = o.name === 'grond' || o.userData.ground;
      o.receiveShadow = true;
      o.castShadow = !ground && !(o.material && o.material.transparent && o.material.opacity < 0.3);
    });
    scene.add(content);
    pickables = [];
    content.traverse((o) => { if (o.isMesh) pickables.push(o); });
    pickables.push(outer);
    dirty = true;
  }
  let pickables = [];

  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, size * 12 + 400);
  camera.rotation.order = 'YXZ';

  // ---------------------------------------------------------------- bediening
  const st = info.start || { x: cx, y: box.maxY - 1, yaw: 0 };
  const walk = { x: st.x, z: st.y, yaw: st.yaw ?? 0, pitch: -0.08 };
  const orbit = { target: new THREE.Vector3(cx, 0, cz), dist: size * 1.15 + 6, theta: walk.yaw, phi: 0.95 };
  let mode = 'walk';
  let dirty = true;
  let glide = null; // naar een aangetikt punt lopen

  function placeCamera() {
    if (mode === 'walk') {
      camera.position.set(walk.x, EYE, walk.z);
      camera.rotation.set(walk.pitch, walk.yaw, 0);
    } else {
      const o = orbit;
      camera.position.set(
        o.target.x + o.dist * Math.sin(o.phi) * Math.sin(o.theta),
        o.target.y + o.dist * Math.cos(o.phi),
        o.target.z + o.dist * Math.sin(o.phi) * Math.cos(o.theta),
      );
      camera.lookAt(o.target);
    }
  }

  const keys = new Set();
  const onKey = (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.code;
    if (!/^(Key[WASDQE]|Arrow(Up|Down|Left|Right)|ShiftLeft|ShiftRight|PageUp|PageDown)$/.test(k)) return;
    e.preventDefault();
    if (e.type === 'keydown') keys.add(k); else keys.delete(k);
    glide = null;
    dirty = true;
  };
  const clearKeys = () => keys.clear();
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', clearKeys);

  // slepen = rondkijken (lopen) of draaien (vogelvlucht); twee vingers = knijpen
  const ptrs = new Map();
  let pinch = null, lastTap = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') root.classList.add('touch');
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true });
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    glide = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) {
        const f = d / pinch;
        if (mode === 'walk') step(0, (d - pinch) * 0.03);
        else orbit.dist = clamp(orbit.dist / f, 3, size * 6);
      }
      pinch = d;
    } else if (mode === 'walk') {
      walk.yaw += dx * 0.0045;
      walk.pitch = clamp(walk.pitch + dy * 0.0045, -1.35, 1.35);
    } else {
      orbit.theta -= dx * 0.007;
      orbit.phi = clamp(orbit.phi - dy * 0.006, 0.08, 1.5);
    }
    dirty = true;
  });
  const up = (e) => {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!p || e.type === 'pointercancel') return;
    // dubbel tikken / dubbelklikken: daarheen lopen
    const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
    const now = performance.now();
    if (moved < 10 && now - p.t < 350) {
      if (lastTap && now - lastTap.t < 380 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        goTo(e.clientX, e.clientY);
        lastTap = null;
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (mode === 'walk') step(0, -e.deltaY * 0.01);
    else orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0012), 3, size * 6);
    glide = null;
    dirty = true;
  }, { passive: false });

  const ray = new THREE.Raycaster();
  function goTo(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (!hit) return;
    if (mode === 'orbit') {
      orbit.target.set(hit.point.x, 0, hit.point.z);
      dirty = true;
      return;
    }
    // tot vlak voor wat je aantikt (een boom, een muur), of precies op de plek op de grond
    const dx = hit.point.x - walk.x, dz = hit.point.z - walk.z, L = Math.hypot(dx, dz);
    const stopShort = hit.point.y > 0.15 ? 0.7 : 0;
    if (L < 0.2) return;
    const k = Math.max(0, L - stopShort) / L;
    glide = { x: walk.x + dx * k, z: walk.z + dz * k };
    dirty = true;
  }

  // joystick (aanraken): lopen in de richting van de knop
  const stick = doc.createElement('div');
  stick.className = 'w3d-stick';
  stick.innerHTML = '<div class="w3d-knob"></div>';
  root.appendChild(stick);
  const knob = stick.firstChild;
  let stickVec = null, stickId = null;
  const stickMove = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const R = r.width / 2, L = Math.hypot(dx, dy);
    if (L > R) { dx *= R / L; dy *= R / L; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    stickVec = { x: dx / R, y: dy / R };
    dirty = true;
  };
  stick.addEventListener('pointerdown', (e) => { root.classList.add('touch'); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); glide = null; stickMove(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
  const stickUp = (e) => { if (e.pointerId !== stickId) return; stickId = null; stickVec = null; knob.style.transform = ''; };
  stick.addEventListener('pointerup', stickUp);
  stick.addEventListener('pointercancel', stickUp);

  const limit = size * 4 + 40;
  function step(right, fwd) {
    if (mode === 'walk') {
      const s = Math.sin(walk.yaw), c = Math.cos(walk.yaw);
      walk.x += -s * fwd + c * right;
      walk.z += -c * fwd - s * right;
      walk.x = clamp(walk.x, cx - limit, cx + limit);
      walk.z = clamp(walk.z, cz - limit, cz + limit);
    } else {
      const s = Math.sin(orbit.theta), c = Math.cos(orbit.theta);
      orbit.target.x += -s * fwd + c * right;
      orbit.target.z += -c * fwd - s * right;
    }
  }

  // ---------------------------------------------------------------- zon
  const lat = Number.isFinite(info.lat) ? info.lat : 52.1, lon = Number.isFinite(info.lon) ? info.lon : 5.3;
  let ymd = info.ymd || todayYmd();
  let minutes = info.minutes;
  function dayRange() {
    const t = sunTimes(ymd, lat, lon);
    const lo = t.rise != null ? Math.ceil(t.rise / 10) * 10 : 360, hi = t.set != null ? Math.floor(t.set / 10) * 10 : 1260;
    return { lo, hi, noon: t.noon };
  }
  function applySun() {
    const sun = sunPosition(localDate(ymd, minutes), lat, lon);
    const up = clamp(sun.altitude / 12, 0, 1);
    if (sun.altitude > 0) {
      const d = sunDirection(sun, info.northRot || 0);
      sunLight.position.set(cx + d.x * sr * 2, d.y * sr * 2, cz + d.z * sr * 2);
      sunLight.intensity = 0.6 + 2.2 * up;
      sunLight.color.set(up < 0.6 ? '#ffd9a8' : '#fff4e2');
      sunLight.visible = true;
    } else sunLight.visible = false;
    hemi.intensity = 0.45 + 0.7 * up;
    sky.set('#cfdde6').lerp(new THREE.Color('#e9c9a6'), (1 - up) * 0.55);
    if (sun.altitude <= 0) sky.set('#6f7f99');
    domeMat.color.setScalar(sun.altitude <= 0 ? 0.45 : 0.75 + 0.25 * up);
    scene.fog.color.copy(sky);
    dirty = true;
  }

  // ---------------------------------------------------------------- knoppenbalk
  const bar = doc.createElement('div');
  bar.className = 'w3d-bar';
  root.appendChild(bar);
  const modes = doc.createElement('div');
  modes.className = 'w3d-grp';
  modes.innerHTML = `${info.title ? `<span class="w3d-title"></span>` : ''}<button type="button" data-m="walk" class="on" title="Op ooghoogte door de tuin lopen">Lopen</button><button type="button" data-m="orbit" title="Van bovenaf rond de tuin kijken">Vogelvlucht</button><button type="button" data-wind title="Planten bewegen in de wind (uit: zuiniger voor de batterij)">Wind</button>`;
  if (info.title) modes.querySelector('.w3d-title').textContent = info.title;
  bar.appendChild(modes);
  const time = doc.createElement('div');
  time.className = 'w3d-grp';
  time.innerHTML = `<span title="Zon">☀</span><input type="date"><input type="range" step="10"><span class="w3d-clock"></span>`;
  bar.appendChild(time);
  const toolbar = doc.createElement('div');
  toolbar.className = 'w3d-grp';
  toolbar.hidden = true;
  bar.appendChild(toolbar);
  const help = doc.createElement('div');
  help.className = 'w3d-help';
  root.appendChild(help);

  const dateIn = time.querySelector('input[type=date]'), slider = time.querySelector('input[type=range]'), clk = time.querySelector('.w3d-clock');
  function syncTime() {
    const r = dayRange();
    if (minutes == null) minutes = Math.round(r.noon / 10) * 10 + 120;
    minutes = clamp(minutes, r.lo, r.hi);
    dateIn.value = ymd;
    slider.min = r.lo; slider.max = r.hi; slider.value = minutes;
    clk.textContent = clock(minutes);
    applySun();
  }
  dateIn.addEventListener('change', () => {
    if (!/^\d{4}-\d\d-\d\d$/.test(dateIn.value)) return;
    const oldMonth = ymd.slice(5, 7);
    ymd = dateIn.value;
    syncTime();
    if (opts.onDate && ymd.slice(5, 7) !== oldMonth) opts.onDate(ymd);
  });
  slider.addEventListener('input', () => { minutes = Number(slider.value); clk.textContent = clock(minutes); applySun(); });

  const touchy = () => root.classList.contains('touch') || window.matchMedia?.('(pointer: coarse)').matches;
  function setHelp() {
    help.textContent = mode === 'walk'
      ? (touchy() ? 'Joystick: lopen · slepen: rondkijken · knijpen: vooruit/achteruit · dubbeltik: ga daarheen'
        : 'W A S D of pijltjes: lopen (Shift: sneller) · slepen: rondkijken · scrollen: vooruit/achteruit · dubbelklik: ga daarheen')
      : (touchy() ? 'Slepen: draaien · knijpen: in- en uitzoomen · dubbeltik: daarop richten'
        : 'Slepen: draaien · scrollen: zoomen · W A S D: verschuiven · dubbelklik: daarop richten');
    help.style.opacity = 1;
    clearTimeout(setHelp.t);
    setHelp.t = setTimeout(() => { help.style.opacity = 0.0; }, 9000);
  }
  function setMode(m) {
    if (m === mode) return;
    if (m === 'orbit') { orbit.theta = walk.yaw; orbit.target.set(walk.x, 0, walk.z).lerp(new THREE.Vector3(cx, 0, cz), 0.6); }
    else {
      // terug op de grond, ongeveer waar je van bovenaf naar keek
      walk.x = orbit.target.x + Math.sin(orbit.theta) * 4; walk.z = orbit.target.z + Math.cos(orbit.theta) * 4;
      walk.yaw = orbit.theta; walk.pitch = -0.08;
    }
    mode = m;
    root.classList.toggle('orbit', m === 'orbit');
    for (const b of modes.querySelectorAll('[data-m]')) b.classList.toggle('on', b.dataset.m === m);
    glide = null;
    setHelp();
    dirty = true;
  }
  for (const b of modes.querySelectorAll('[data-m]')) b.addEventListener('click', () => setMode(b.dataset.m));
  const wb = modes.querySelector('[data-wind]');
  wb.classList.toggle('on', windOn);
  wb.addEventListener('click', () => { windOn = !windOn; wb.classList.toggle('on', windOn); dirty = true; });

  /** Eigen knop in de balk (de app: downloads en sluiten). */
  function addButton(label, title, onClick) {
    toolbar.hidden = false;
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', onClick);
    toolbar.appendChild(b);
    return b;
  }

  // ---------------------------------------------------------------- tekenen
  function resize() {
    const w = root.clientWidth || 1, h = root.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(root);
  window.addEventListener('resize', resize);

  let last = performance.now(), raf = 0, alive = true;
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1;
    const v = (mode === 'walk' ? WALK : Math.max(3, orbit.dist * 0.5)) * run * dt;
    let f = 0, r = 0, turn = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD')) r += 1;
    if (keys.has('KeyA')) r -= 1;
    if (keys.has('ArrowLeft') || keys.has('KeyQ')) turn += 1;
    if (keys.has('ArrowRight') || keys.has('KeyE')) turn -= 1;
    if (stickVec) { f -= stickVec.y; r += stickVec.x; }
    if (f || r) { step(r * v, f * v); dirty = true; }
    if (turn) {
      if (mode === 'walk') walk.yaw += turn * 1.7 * dt; else orbit.theta += turn * 1.7 * dt;
      dirty = true;
    }
    if (mode === 'orbit' && (keys.has('PageUp') || keys.has('PageDown'))) {
      orbit.dist = clamp(orbit.dist * Math.exp((keys.has('PageDown') ? 1 : -1) * dt), 3, size * 6);
      dirty = true;
    }
    if (glide && mode === 'walk') {
      const dx = glide.x - walk.x, dz = glide.z - walk.z, L = Math.hypot(dx, dz);
      const s = Math.min(L, WALK * 2.2 * dt + L * 3 * dt);
      if (L < 0.02) glide = null; else { walk.x += (dx / L) * s; walk.z += (dz / L) * s; }
      dirty = true;
    }
    if (windOn && !dirty && now - lastRender > 33) { windTime.value = now / 1000; dirty = true; } // wind: hooguit 30 beelden per seconde
    else if (windOn) windTime.value = now / 1000;
    if (!dirty) return;
    dirty = false;
    lastRender = now;
    placeCamera();
    renderer.render(scene, camera);
  }

  if (opts.content) setContent(opts.content);
  resize();
  syncTime();
  setHelp();
  raf = requestAnimationFrame(frame);

  function dispose() {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', clearKeys);
    window.removeEventListener('resize', resize);
    ro?.disconnect();
    if (content) disposeTree(content);
    disposeTree(outer);
    disposeTree(dome);
    renderer.dispose();
    renderer.forceContextLoss?.();
    root.remove();
  }

  return {
    el: root, canvas, scene, camera, renderer, addButton, setContent, setMode, dispose,
    get mode() { return mode; },
    get content() { return content; },
    get date() { return ymd; },
    get state() { return { mode, walk: { ...walk }, orbit: { ...orbit, target: orbit.target.toArray() }, ymd, minutes }; },
    render() { dirty = true; },
    /** Camera instellen (vogelvlucht: target [x, z], dist, theta, phi; lopen: x, z, yaw, pitch). */
    view(v) {
      if (v.target) { setMode('orbit'); orbit.target.set(v.target[0], 0, v.target[1]); if (v.dist) orbit.dist = v.dist; if (v.theta != null) orbit.theta = v.theta; if (v.phi != null) orbit.phi = v.phi; }
      else { setMode('walk'); Object.assign(walk, v); }
      dirty = true;
    },
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/** Geometrie, materialen en texturen opruimen (geheugen van de grafische kaart). */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}
