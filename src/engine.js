// ============================================================================
//  DUNGEON HEART  -  engine: renderer (Pest Panic's setup), the ten themes'
//  textures, and the room built in 3D from the game's 16 x 11 tile map.
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as D from './data.js';

export const V3 = THREE.Vector3;
export const TAU = Math.PI * 2;
export const IS_TOUCH = matchMedia('(pointer:coarse)').matches;
// the SNES game's pixel space -> world: a 16-pixel cell is CELL units; the room's middle is 0, 0
export const CELL = 3, PX = CELL / 16;
export const wx = px => (px - 128) * PX;            // a cell's left edge px -> world x
export const wz = py => (py - D.PLAY_Y - 88) * PX;  // a cell's top edge py -> world z
// an actor's 16x16 box at (x, y): where it stands
export const ax = x => wx(x + 8), az = y => wz(y + 11);
export const ROOM_W = 16 * CELL, ROOM_D = 11 * CELL;

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

export const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0908');
scene.fog = new THREE.Fog('#0b0908', 70, 130);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

export const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
export const hemi = new THREE.HemisphereLight('#ffe8cc', '#241c18', 0.55);
scene.add(hemi);
export const sun = new THREE.DirectionalLight('#ffe2bd', 1.3);
sun.position.set(-14, 40, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 24, bottom: -24, near: 5, far: 100 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

export const view = { w: 1, h: 1, dist: 40, pitch: 0.98, bloomOn: true, follow: false, quality: 2 };
export function resize() {
  const w = innerWidth, h = innerHeight;
  view.w = w; view.h = h;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h;
  // landscape: the whole room (it is 48 x 33); upright phones: about 18 units across, following the hero
  const t = Math.tan(THREE.MathUtils.degToRad(19));
  view.follow = camera.aspect < 1.25;
  const S = camera.aspect >= 1.25 ? Math.max(29, 45 / camera.aspect) : Math.max(26, 17 / camera.aspect);
  view.dist = Math.min(120, (S / 2) / t * 1.06);
  camera.updateProjectionMatrix();
}
const camFocus = new V3();
export const shake = { x: 0, z: 0, t: 0, amp: 0 };
export function placeCamera(x, z, snap) {
  const t = Math.tan(THREE.MathUtils.degToRad(19));
  const visW = t * view.dist * camera.aspect, visD = t * view.dist * 0.9;
  const mx = Math.max(0, ROOM_W / 2 + 1 - visW), mz = Math.max(0, ROOM_D / 2 - visD + 2);
  const tx = view.follow ? THREE.MathUtils.clamp(x, -mx, mx) : THREE.MathUtils.clamp(x * 0.12, -mx, mx);
  const tz = view.follow ? THREE.MathUtils.clamp(z, -mz, mz) : THREE.MathUtils.clamp(z * 0.12, -1.2, 1.2);
  if (snap) camFocus.set(tx, 0, tz); else camFocus.lerp(new V3(tx, 0, tz), 0.08);
  const p = view.pitch, d = view.dist;
  if (shake.t > 0) { shake.x = (Math.random() - 0.5) * shake.amp; shake.z = (Math.random() - 0.5) * shake.amp; } else shake.x = shake.z = 0;
  camera.position.set(camFocus.x + shake.x, Math.sin(p) * d, camFocus.z + 1.5 + Math.cos(p) * d + shake.z);
  camera.lookAt(camFocus.x + shake.x, 0, camFocus.z + 1.5 + shake.z);
  sun.position.set(camFocus.x - 14, 40, camFocus.z + 18); sun.target.position.set(camFocus.x, 0, camFocus.z);
}
export function render() { if (view.bloomOn) composer.render(); else renderer.render(scene, camera); }
export function setQuality(level) {
  view.quality = level;
  const pr = Math.min(devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2);
  renderer.setPixelRatio(level >= 2 ? pr : 1);
  view.bloomOn = level >= 1;
  renderer.shadowMap.enabled = level >= 1;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  resize();
}

// ---------------------------------------------------------------- textures
export function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// stones: rows of staggered blocks; color, normal (from a beveled height map) and roughness maps
function stoneTextures({ W, H, rows, minW, maxW, seed, palette, mortar, moss = 0, mossCol = [70, 110, 45], cracks = 0, glow = null, speck = 1 }) {
  const r = rng(seed);
  const [c, x] = cnv(W, H), [hc, hx] = cnv(W, H), [rc, rx] = cnv(W, H);
  x.fillStyle = mortar; x.fillRect(0, 0, W, H);
  hx.fillStyle = '#000'; hx.fillRect(0, 0, W, H);
  rx.fillStyle = '#eee'; rx.fillRect(0, 0, W, H);
  const rh = H / rows, gap = Math.max(4, W / 160);
  for (let row = 0; row < rows; row++) {
    let px = -r() * maxW;
    while (px < W) {
      const w = minW + r() * (maxW - minW), y0 = row * rh, base = palette[Math.floor(r() * palette.length)];
      const shade = (r() - 0.5) * 22, col = base.map(v => Math.max(0, Math.min(255, v + shade)));
      const rough = 170 + Math.floor(r() * 50);
      for (const dx of [-W, 0, W]) {
        const X = px + dx, rad = Math.min(14, w / 6);
        const rr = (ctx, fill, ins) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(X + gap / 2 + ins, y0 + gap / 2 + ins, w - gap - ins * 2, rh - gap - ins * 2, rad); ctx.fill(); };
        rr(x, `rgb(${col.join(',')})`, 0);
        rr(hx, '#9a9a9a', 0); rr(hx, '#ffffff', gap * 0.9);
        rr(rx, `rgb(${rough},${rough},${rough})`, 0);
      }
      for (let i = 0; i < w * rh / 140 * speck; i++) {
        const sx = px + gap + r() * (w - gap * 2), sy = y0 + gap + r() * (rh - gap * 2), s = 1 + r() * 4;
        x.fillStyle = `rgba(${r() < 0.5 ? '255,240,220' : '0,0,0'},${0.04 + r() * 0.07})`;
        x.fillRect(sx, sy, s, s);
      }
      if (r() < cracks) {
        x.strokeStyle = glow ? glow : 'rgba(20,16,14,.55)'; hx.strokeStyle = '#555'; x.lineWidth = glow ? 3 : 2; hx.lineWidth = 2;
        let cx = px + w * (0.2 + r() * 0.6), cy = y0 + gap;
        x.beginPath(); hx.beginPath(); x.moveTo(cx, cy); hx.moveTo(cx, cy);
        for (let k = 0; k < 5; k++) { cx += (r() - 0.5) * w * 0.25; cy += rh / 6; x.lineTo(cx, cy); hx.lineTo(cx, cy); }
        x.stroke(); hx.stroke();
      }
      if (r() < moss) {
        for (let i = 0; i < 70; i++) {
          const e = r() < 0.5, sx = px + (e ? r() * w : (r() < 0.5 ? gap : w - gap * 2)), sy = y0 + (e ? (r() < 0.5 ? gap : rh - gap * 2) : r() * rh);
          x.fillStyle = `rgba(${mossCol[0] + r() * 30},${mossCol[1] + r() * 40},${mossCol[2] + r() * 20},${0.35 + r() * 0.4})`;
          x.beginPath(); x.arc(sx, sy, 1.5 + r() * 4, 0, TAU); x.fill();
        }
      }
      px += w;
    }
  }
  const [bc, bx] = cnv(W, H);
  bx.filter = 'blur(3px)'; bx.drawImage(hc, 0, 0);
  const src = bx.getImageData(0, 0, W, H).data, hgt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) hgt[i] = src[i * 4] / 255 + (r() - 0.5) * 0.03;
  const [nc, nx] = cnv(W, H), img = nx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const hL = hgt[y * W + ((xx + W - 1) % W)], hR = hgt[y * W + ((xx + 1) % W)];
    const hU = hgt[((y + H - 1) % H) * W + xx], hD = hgt[((y + 1) % H) * W + xx];
    const dx = (hL - hR) * 3, dy = (hU - hD) * 3, l = Math.hypot(dx, dy, 1), i = (y * W + xx) * 4;
    img.data[i] = (dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  return { map: tex(c), normal: tex(nc, false), rough: tex(rc, false) };
}
export function glowTex(stops, size = 128) {
  const [c, x] = cnv(size, size), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const TEX = {
  flame: glowTex([[0, 'rgba(255,250,220,1)'], [0.25, 'rgba(255,190,80,.95)'], [0.55, 'rgba(255,90,20,.45)'], [1, 'rgba(255,40,0,0)']]),
  soft: glowTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]),
  ring: (() => { const [c, x] = cnv(128, 128); x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); const t = new THREE.CanvasTexture(c); return t; })(),
  shadow: glowTex([[0, 'rgba(0,0,0,.55)'], [0.6, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]),
  spark: glowTex([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,.15)'], [1, 'rgba(255,255,255,0)']], 64),
};

// ---------------------------------------------------------------- the ten themes
// floor / wall stone colors, light, fog, torch flame, hazard look
export const THEMES = [
  { name: 'STONE', floor: [[78, 73, 67], [86, 80, 72], [70, 67, 64], [90, 82, 70], [74, 71, 69]], wall: [[78, 72, 66], [86, 78, 70], [70, 66, 62], [92, 84, 72]],
    mortar: '#1d1916', wmortar: '#16120f', moss: 0.12, cracks: 0.18, sky: '#ffe8cc', ground: '#241c18', hemi: 0.55, sun: '#ffe2bd', sunI: 1.3, fog: '#0b0908', torch: '#ff9a48', flame: '#ffb35c', pillar: '#7a7168' },
  { name: 'MOSS', floor: [[66, 78, 58], [74, 84, 62], [60, 70, 56], [80, 86, 66]], wall: [[62, 74, 56], [70, 80, 60], [56, 66, 52]], mossCol: [60, 120, 40],
    mortar: '#121a10', wmortar: '#0f150d', moss: 0.65, cracks: 0.1, sky: '#e4ffd8', ground: '#16200f', hemi: 0.55, sun: '#e8ffd0', sunI: 1.2, fog: '#070b06', torch: '#ffb860', flame: '#ffc070', pillar: '#6d7a5f' },
  { name: 'FROST', floor: [[150, 176, 198], [166, 190, 210], [136, 162, 186], [176, 198, 216]], wall: [[112, 138, 164], [126, 150, 176], [100, 126, 152]],
    mortar: '#2a3c50', wmortar: '#1e2c3c', moss: 0, cracks: 0.25, sky: '#dff2ff', ground: '#1a2633', hemi: 0.55, sun: '#e6f4ff', sunI: 1.05, fog: '#08101a', torch: '#7fd2ff', flame: '#9fe6ff', pillar: '#a9c4dc', icy: 1, dim: 0.68 },
  { name: 'EMBER', floor: [[54, 40, 36], [62, 44, 38], [46, 36, 34], [70, 48, 40]], wall: [[48, 34, 30], [58, 40, 34], [42, 30, 28]], glow: 'rgba(255,110,30,.85)',
    mortar: '#120807', wmortar: '#0e0605', moss: 0, cracks: 0.45, sky: '#ffcfa8', ground: '#2a0c06', hemi: 0.5, sun: '#ffb880', sunI: 1.1, fog: '#100403', torch: '#ff6a24', flame: '#ff8a3a', pillar: '#4e3a34' },
  { name: 'BONE', floor: [[150, 138, 112], [162, 150, 122], [138, 126, 104], [170, 156, 126]], wall: [[118, 106, 86], [130, 118, 96], [108, 98, 80]],
    mortar: '#2a2418', wmortar: '#211c12', moss: 0.08, mossCol: [90, 100, 50], cracks: 0.3, sky: '#f4ffe0', ground: '#201c10', hemi: 0.55, sun: '#f0ffd8', sunI: 1.15, fog: '#0a0a06', torch: '#b8ff7a', flame: '#d4ff9a', pillar: '#b8a888', dim: 0.74 },
  { name: 'SAND', floor: [[176, 144, 96], [188, 156, 104], [164, 134, 90], [196, 162, 110]], wall: [[150, 118, 76], [162, 128, 84], [140, 110, 70]],
    mortar: '#4a3418', wmortar: '#3a2812', moss: 0, cracks: 0.2, sky: '#fff0d0', ground: '#3a2810', hemi: 0.65, sun: '#ffe6b8', sunI: 1.15, fog: '#120c04', torch: '#ffa040', flame: '#ffc060', pillar: '#c09a64', dim: 0.74 },
  { name: 'CRYSTAL', floor: [[70, 56, 96], [80, 64, 108], [62, 50, 88], [88, 70, 116]], wall: [[58, 46, 84], [68, 54, 96], [52, 42, 76]], glow: 'rgba(190,120,255,.7)',
    mortar: '#150f24', wmortar: '#100b1c', moss: 0, cracks: 0.2, sky: '#ead8ff', ground: '#1a1030', hemi: 0.6, sun: '#e2d0ff', sunI: 1.15, fog: '#0a0612', torch: '#c78aff', flame: '#d8a8ff', pillar: '#8a64c8', crystal: 1 },
  { name: 'SHADOW', floor: [[44, 40, 54], [50, 46, 60], [38, 36, 48], [54, 50, 64]], wall: [[36, 32, 46], [42, 38, 52], [32, 30, 42]],
    mortar: '#0c0a12', wmortar: '#08070c', moss: 0.05, mossCol: [60, 50, 90], cracks: 0.15, sky: '#b8a8e8', ground: '#0c0812', hemi: 0.22, sun: '#a898e0', sunI: 0.35, fog: '#040306', torch: '#8a5cff', flame: '#a87cff', pillar: '#4a4458' },
  { name: 'BLOOD', floor: [[86, 40, 40], [96, 44, 44], [76, 36, 36], [104, 50, 46]], wall: [[70, 32, 32], [80, 36, 36], [62, 28, 28]],
    mortar: '#1c0606', wmortar: '#140404', moss: 0, cracks: 0.25, sky: '#ffd0c8', ground: '#2a0808', hemi: 0.5, sun: '#ffc0b0', sunI: 1.15, fog: '#100303', torch: '#ff4a3a', flame: '#ff6a5a', pillar: '#6a3434' },
  { name: 'STORM', floor: [[84, 92, 104], [92, 100, 112], [76, 84, 96], [100, 108, 120]], wall: [[68, 76, 90], [76, 84, 98], [60, 68, 82]],
    mortar: '#14181e', wmortar: '#0e1116', moss: 0.04, mossCol: [70, 90, 80], cracks: 0.2, sky: '#d8e8ff', ground: '#121820', hemi: 0.6, sun: '#d8e6ff', sunI: 1.2, fog: '#060a10', torch: '#7aa8ff', flame: '#a8c8ff', pillar: '#68768a' },
];
// (the pale stones are darkened so the light, the bloom and the hazards still read)
for (const th of THEMES) if (th.dim) for (const k of ['floor', 'wall']) th[k] = th[k].map(c => c.map(v => Math.round(v * th.dim)));
const themeTex = {};
export function themeTextures(t) {
  if (themeTex[t]) return themeTex[t];
  const th = THEMES[t], N = IS_TOUCH ? 512 : 1024;
  const floor = stoneTextures({ W: N, H: N, rows: 6, minW: N * 0.15, maxW: N * 0.3, seed: 11 + t * 7, mortar: th.mortar, palette: th.floor,
    moss: th.moss, mossCol: th.mossCol, cracks: th.cracks, glow: th.glow });
  const wall = stoneTextures({ W: N, H: N / 2, rows: 4, minW: N * 0.17, maxW: N * 0.26, seed: 5 + t * 13, mortar: th.wmortar, palette: th.wall,
    moss: th.moss * 0.7, mossCol: th.mossCol, cracks: th.cracks * 0.5, glow: th.glow });
  return (themeTex[t] = { floor, wall });
}

// ---------------------------------------------------------------- geometry helpers
export function std(o) { return new THREE.MeshStandardMaterial(o); }
export function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; return m; }
export const sph = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
// world-projected UVs (so a texture keeps its scale across merged blocks of any size)
function worldUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = Math.abs(n.getY(i)), nx = Math.abs(n.getX(i));
    if (ny > 0.5) uv.setXY(i, x / scale, z / scale);
    else if (nx > 0.5) uv.setXY(i, z / scale, y / (scale / 2));
    else uv.setXY(i, x / scale, y / (scale / 2));
  }
  uv.needsUpdate = true;
  return geo;
}

// ---------------------------------------------------------------- the room
export const roomGroup = new THREE.Group();
scene.add(roomGroup);
const under = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), std({ color: '#050404', roughness: 1 }));
under.rotation.x = -Math.PI / 2; under.position.y = -0.06; under.receiveShadow = false; scene.add(under);
export const R = { torches: [], hz: [], doors: {}, objs: [], cracks: {}, pits: [], spikes: [], lava: [], anim: [] };
const WH = 6.2, WH_FRONT = 1.1, IN_H = 3.4;
export function cellCenter(c) { return [wx((c & 15) * 16 + 8), wz(D.PLAY_Y + (c >> 4) * 16 + 8)]; }

export function buildRoom(G, seed) {
  // clear the old one
  roomGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  roomGroup.clear();
  R.torches = []; R.hz = []; R.doors = {}; R.objs = []; R.cracks = {}; R.pits = []; R.spikes = []; R.lava = []; R.anim = [];
  const th = THEMES[G.theme], T = themeTextures(G.theme), map = G.map, r = rng(seed);
  scene.background.set(th.fog); scene.fog.color.set(th.fog);
  hemi.color.set(th.sky); hemi.groundColor.set(th.ground); hemi.intensity = th.hemi;
  sun.color.set(th.sun); sun.intensity = th.sunI;
  under.material.color.set(th.fog);
  // floor (with holes cut where the pits are: the pits are boxes below it)
  const fm = {};
  for (const k of ['map', 'normal', 'rough']) { fm[k] = T.floor[k]; fm[k].repeat.set(1, 1); }
  const floorMat = std({ map: fm.map, normalMap: fm.normal, normalScale: new THREE.Vector2(1.1, 1.1), roughnessMap: fm.rough, roughness: th.icy ? 0.55 : 0.9, envMapIntensity: th.icy ? 0.6 : 0.35 });
  const fparts = [];
  for (let cy = 1; cy < 10; cy++) for (let cx = 1; cx < 15; cx++) {
    const t = map[cy * 16 + cx];
    if (t === D.T_PIT) continue;
    const g = new THREE.PlaneGeometry(CELL, CELL); g.rotateX(-Math.PI / 2);
    const [x, z] = cellCenter(cy * 16 + cx); g.translate(x, 0, z);
    fparts.push(g);
  }
  // under the doors too
  for (let c = 0; c < 176; c++) {
    const t = map[c];
    if (t !== D.T_DOOR && t !== D.T_DOORWAY && t !== D.T_STAIRS) continue;
    const g = new THREE.PlaneGeometry(CELL, CELL); g.rotateX(-Math.PI / 2);
    const [x, z] = cellCenter(c); g.translate(x, 0, z); fparts.push(g);
  }
  const floorGeo = worldUV(mergeGeometries(fparts), 12);
  const floor = new THREE.Mesh(floorGeo, floorMat); floor.receiveShadow = true; roomGroup.add(floor);

  // walls: the border cells (the front row low, so the room stays in view), inner walls lower
  const wmat = std({ map: T.wall.map, normalMap: T.wall.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: T.wall.rough, roughness: 0.95, envMapIntensity: 0.3 });
  const capMat = std({ color: new THREE.Color(th.pillar).multiplyScalar(0.55), roughness: 0.85 });
  const wparts = [], cparts = [];
  for (let c = 0; c < 176; c++) {
    if (map[c] !== D.T_WALL) continue;
    const cx = c & 15, cy = c >> 4, edge = cx === 0 || cx === 15 || cy === 0 || cy === 10;
    const h = !edge ? IN_H : (cy === 10 ? WH_FRONT : WH);
    let [x, z] = cellCenter(c);
    let w = CELL, d = CELL;
    if (cy === 10 && edge) { d = CELL * 0.5; z -= CELL * 0.25; }
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, h / 2, z); wparts.push(g);
    const cap = new THREE.BoxGeometry(w + 0.12, 0.35, d + 0.12); cap.translate(x, h + 0.17, z); cparts.push(cap);
  }
  if (wparts.length) {
    const wg = worldUV(mergeGeometries(wparts), 10);
    const walls = new THREE.Mesh(wg, wmat); walls.castShadow = walls.receiveShadow = true; roomGroup.add(walls);
    const caps = new THREE.Mesh(mergeGeometries(cparts), capMat); caps.castShadow = true; caps.receiveShadow = true; roomGroup.add(caps);
  }
  // the pits: dark shafts
  const pitMat = std({ color: '#050404', roughness: 1 }), pitWall = std({ color: new THREE.Color(th.wall[0].map(v => v / 255 * 0.5).join ? `rgb(${th.wall[0].map(v => Math.round(v * 0.5)).join(',')})` : '#222'), roughness: 1 });
  for (let c = 0; c < 176; c++) {
    if (map[c] !== D.T_PIT) continue;
    const [x, z] = cellCenter(c);
    const box = new THREE.Mesh(new THREE.BoxGeometry(CELL, 4, CELL), [pitWall, pitWall, pitMat, pitMat, pitWall, pitWall]);
    box.material = [pitWall, pitWall, pitMat, pitMat, pitWall, pitWall];
    box.geometry.scale(-1, 1, 1); // (inside faces)
    box.position.set(x, -2, z); roomGroup.add(box);
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), new THREE.MeshBasicMaterial({ color: '#000' }));
    bottom.rotation.x = -Math.PI / 2; bottom.position.set(x, -3.9, z); roomGroup.add(bottom);
    R.pits.push(c);
  }
  // bridges over them
  const plank = std({ color: '#6b4428', roughness: 0.8 }), rope = std({ color: '#8a7050', roughness: 0.9 });
  for (let c = 0; c < 176; c++) {
    if (map[c] !== D.T_BRIDGE) continue;
    const [x, z] = cellCenter(c), v = map[c - 1] === D.T_PIT || map[c - 1] === D.T_BRIDGE ? 0 : 1; // planks across the pit's run
    const b = new THREE.Group(); b.position.set(x, 0, z);
    for (let i = 0; i < 5; i++) {
      const p = mesh(new THREE.BoxGeometry(v ? CELL * 0.18 : CELL, 0.18, v ? CELL : CELL * 0.18), plank);
      if (v) p.position.x = -CELL * 0.4 + i * CELL * 0.2; else p.position.z = -CELL * 0.4 + i * CELL * 0.2;
      p.position.y = 0.02; p.receiveShadow = true; b.add(p);
    }
    for (const s of [-1, 1]) {
      const rp = mesh(new THREE.CylinderGeometry(0.06, 0.06, CELL, 6), rope);
      if (v) { rp.rotation.x = 0; rp.rotation.z = Math.PI / 2; rp.position.set(0, 0.5, s * CELL * 0.45); rp.rotation.set(0, 0, Math.PI / 2); }
      else { rp.rotation.x = Math.PI / 2; rp.position.set(s * CELL * 0.45, 0.5, 0); }
      b.add(rp);
    }
    roomGroup.add(b);
  }
  // pillars
  for (let c = 0; c < 176; c++) {
    if (map[c] !== D.T_PILLAR) continue;
    const [x, z] = cellCenter(c);
    const p = th.crystal || G.hz === D.HZ_CRYSTAL ? crystalPillar(th) : stonePillar(th);
    p.position.set(x, 0, z); p.rotation.y = Math.floor(r() * 4) * Math.PI / 2; roomGroup.add(p);
  }
  // hazards
  buildHazards(G, th, r);
  // doors
  for (let c = 0; c < 176; c++) {
    const t = map[c];
    if (t !== D.T_DOOR && t !== D.T_DOORWAY && t !== D.T_STAIRS) continue;
    const d = buildDoor(c, th, G);
    roomGroup.add(d.g); R.doors[c] = d;
  }
  // torches on the walls: the top wall and the sides, away from doors
  const spots = [];
  for (let cx = 2; cx <= 13; cx += 1) if (map[cx] === D.T_WALL && map[cx - 1] === D.T_WALL && map[cx + 1] === D.T_WALL) spots.push([cx, 0, 0]);
  const tSpots = [];
  const want = [3, 12, 7.5];
  for (const w of want) {
    let best = null, bd = 9;
    for (const s of spots) { const d = Math.abs(s[0] - w); if (d < bd && !tSpots.some(t => Math.abs(t[0] - s[0]) < 3)) { bd = d; best = s; } }
    if (best && tSpots.length < 2) tSpots.push(best);
  }
  for (const [cx] of tSpots) torch(wx(cx * 16 + 8), wz(D.PLAY_Y + 16), 0, th);
  for (const side of [0, 15]) {
    const cy = [3, 4, 6, 7].find(cy => map[cy * 16 + side] === D.T_WALL && map[(cy - 1) * 16 + side] === D.T_WALL && map[(cy + 1) * 16 + side] === D.T_WALL);
    if (cy !== undefined) torch(side ? wx(240) : wx(16), wz(D.PLAY_Y + cy * 16 + 8), side ? -Math.PI / 2 : Math.PI / 2, th);
  }
  // decorations (look only: the game never sees them)
  buildProps(G, th, r);
  // special room objects
  for (let k = 0; k < G.nobj; k++) R.objs[k] = buildObject(G, k, th);
}

function stonePillar(th) {
  const g = new THREE.Group(), m1 = std({ color: th.pillar, roughness: 0.85, envMapIntensity: 0.3 }), m2 = std({ color: new THREE.Color(th.pillar).multiplyScalar(0.75), roughness: 0.9 });
  const base = mesh(new THREE.BoxGeometry(2.7, 0.6, 2.7), m2); base.position.y = 0.3; base.receiveShadow = true; g.add(base);
  const shaft = mesh(new THREE.CylinderGeometry(0.95, 1.05, 5.0, 16), m1); shaft.position.y = 3.1; shaft.receiveShadow = true; g.add(shaft);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, fl = mesh(new THREE.BoxGeometry(0.16, 4.8, 0.16), m2, false); fl.position.set(Math.cos(a) * 0.98, 3.1, Math.sin(a) * 0.98); g.add(fl); }
  const top = mesh(new THREE.BoxGeometry(2.5, 0.6, 2.5), m2); top.position.y = 5.8; g.add(top);
  return g;
}
function crystalPillar(th) {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.6, 7), std({ color: '#3a2c50', roughness: 0.8 })); base.position.y = 0.3; g.add(base);
  const cm = new THREE.MeshPhysicalMaterial({ color: '#b48cff', roughness: 0.08, metalness: 0, transmission: 0.0, clearcoat: 1, emissive: '#6a2cff', emissiveIntensity: 0.55, envMapIntensity: 1.2 });
  const shards = [[0, 0, 0, 4.6, 0.75], [0.7, 0.2, 0.25, 3.0, 0.5], [-0.6, -0.4, -0.3, 2.6, 0.45], [0.1, 0.6, -0.2, 2.0, 0.4]];
  for (const [x, z, tilt, h, rr] of shards) {
    const s = mesh(new THREE.ConeGeometry(rr, h, 6), cm); s.position.set(x, 0.5 + h / 2, z); s.rotation.z = tilt * 0.4; s.rotation.x = tilt * 0.3; g.add(s);
  }
  const l = new THREE.PointLight('#a874ff', 6, 7, 2); l.position.y = 2.6; g.add(l);
  return g;
}
export function torch(x, z, rotY, th) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; roomGroup.add(g);
  const iron = std({ color: '#2a2725', metalness: 0.7, roughness: 0.5 });
  const plate = mesh(new THREE.BoxGeometry(0.7, 1, 0.15), iron); plate.position.set(0, 3.9, 0.05); g.add(plate);
  const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), iron); arm.rotation.x = Math.PI / 2.6; arm.position.set(0, 4.05, 0.45); g.add(arm);
  const cup = mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.4, 10), iron); cup.position.set(0, 4.35, 0.85); g.add(cup);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.flame).lerp(new THREE.Color('#fff8e0'), 0.5) }));
  core.position.set(0, 4.8, 0.85); g.add(core);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: th.flame, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  fl.position.set(0, 4.95, 0.9); fl.scale.set(1.5, 2.1, 1); g.add(fl);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: th.torch, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2 }));
  halo.position.copy(fl.position); halo.scale.set(6, 6, 1); g.add(halo);
  const light = new THREE.PointLight(th.torch, 50, 26, 1.6); light.position.set(0, 5, 1.6); g.add(light);
  R.torches.push({ fl, core, light, halo, ph: Math.random() * 10 });
}

// the exit: an arch; its oak door opens when the room is clear; after a boss, stairs up
function buildDoor(c, th, G) {
  const cx = c & 15, cy = c >> 4, [x, z] = cellCenter(c);
  const g = new THREE.Group(); g.position.set(x, 0, z);
  // facing into the room
  const rotY = cx === 15 ? -Math.PI / 2 : (cy === 0 ? 0 : Math.PI);
  g.rotation.y = rotY;
  const front = cy === 10;
  const H = front ? WH_FRONT : WH;
  const stoneD = std({ color: new THREE.Color(th.pillar).multiplyScalar(0.85), roughness: 0.8, envMapIntensity: 0.3 });
  if (!front) {
    for (const s of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(0.7, H, CELL), stoneD); p.position.set(s * (CELL / 2 - 0.05), H / 2, 0); p.rotation.y = Math.PI / 2; p.scale.set(1, 1, 0.34); g.add(p); }
    const lintel = mesh(new THREE.BoxGeometry(CELL + 0.6, 1.1, 1.2), stoneD); lintel.position.set(0, H - 0.3, 0); g.add(lintel);
    const key = mesh(new THREE.BoxGeometry(0.9, 1.3, 1.3), std({ color: new THREE.Color(th.pillar), roughness: 0.7 })); key.position.set(0, H - 0.2, 0.05); g.add(key);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 0.6, Math.max(1, H - 1.2)), new THREE.MeshBasicMaterial({ color: '#ffcf6a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(0, (H - 1.2) / 2, -0.6); g.add(glow);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 0.6, Math.max(1, H - 1.2)), new THREE.MeshBasicMaterial({ color: '#000' }));
  back.position.set(0, (H - 1.2) / 2, -0.9); g.add(back);
  // the oak door (two leaves)
  const plank = std({ color: '#6b4428', roughness: 0.75, envMapIntensity: 0.3 }), iron = std({ color: '#2b2a2c', metalness: 0.8, roughness: 0.45 });
  const leaves = [];
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group(); leaf.position.set(s * (CELL / 2 - 0.3), 0, -0.2); g.add(leaf);
    const dh = front ? 1.0 : H - 1.2;
    const p = mesh(new THREE.BoxGeometry(CELL / 2 - 0.3, dh, 0.3), plank); p.position.set(-s * (CELL / 4 - 0.15), dh / 2, 0); leaf.add(p);
    for (const y of [0.25, 0.75]) { const b = mesh(new THREE.BoxGeometry(CELL / 2 - 0.25, 0.22, 0.36), iron); b.position.set(-s * (CELL / 4 - 0.15), dh * y, 0); leaf.add(b); }
    const ring = mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16), iron); ring.position.set(-s * 0.55, dh * 0.5, 0.2); leaf.add(ring);
    leaves.push({ leaf, s });
  }
  // stairs up (after the boss)
  const stairs = new THREE.Group(); stairs.visible = false; g.add(stairs);
  for (let i = 0; i < 4; i++) { const st = mesh(new THREE.BoxGeometry(CELL - 0.7, 0.35, 0.7), stoneD); st.position.set(0, 0.2 + i * 0.35, -0.2 - i * 0.55); stairs.add(st); }
  // room 5's boss doors: a skull lantern each (easy green, medium orange, hard red)
  let lamp = null;
  if (G.room_num === D.BOSS_ROOM - 1 && cy === 0 && (cx === D.BDOOR_EASY || cx === D.BDOOR_MED || cx === D.BDOOR_HARD)) {
    const col = cx === D.BDOOR_EASY ? '#5fe36a' : (cx === D.BDOOR_MED ? '#ffa53a' : '#ff3a3a');
    lamp = new THREE.Group(); lamp.position.set(0, H + 0.6, 0.6); g.add(lamp);
    const sk = mesh(sph(0.45, 12, 10), std({ color: '#e6dccb', roughness: 0.6 })); lamp.add(sk);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(sph(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: col })); e.position.set(0.16 * s, 0.05, 0.38); lamp.add(e); }
    const l = new THREE.PointLight(col, 10, 8, 2); l.position.set(0, 0, 1); lamp.add(l);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    halo.scale.set(2.6, 2.6, 1); lamp.add(halo);
    const label = textSprite(cx === D.BDOOR_EASY ? 'EASY' : (cx === D.BDOOR_MED ? 'MEDIUM' : 'HARD'), col);
    label.position.set(0, 1.2, 0); lamp.add(label);
  }
  return { g, glow, leaves, stairs, open: 0, cell: c, lamp };
}
export function textSprite(text, color = '#fff', size = 64) {
  const [c, x] = cnv(512, 128);
  x.font = `${size}px "Luckiest Guy", "Arial Black", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.strokeStyle = '#000'; x.strokeText(text, 256, 68);
  x.fillStyle = color; x.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(4, 1, 1); s.renderOrder = 10;
  return s;
}

// ---------------------------------------------------------------- hazards
function lavaTexture() {
  const [c, x] = cnv(256, 256), r = rng(9);
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#ff5a10'); g.addColorStop(1, '#ffb030');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${120 + r() * 60},${20 + r() * 20},0,${0.5 + r() * 0.4})`; x.beginPath(); x.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, TAU); x.fill(); }
  for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(255,${220 + r() * 35},${120 + r() * 80},${0.4 + r() * 0.5})`; x.beginPath(); x.arc(r() * 256, r() * 256, 2 + r() * 6, 0, TAU); x.fill(); }
  return tex(c);
}
function sandTexture() {
  const [c, x] = cnv(256, 256);
  x.fillStyle = '#b08850'; x.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 9; k++) { x.strokeStyle = `rgba(${k & 1 ? '90,60,30' : '230,200,140'},.5)`; x.lineWidth = 6; x.beginPath(); for (let a = 0; a < TAU * 3; a += 0.1) { const rr = 8 + a * 9 + k * 3; x.lineTo(128 + Math.cos(a + k) * rr, 128 + Math.sin(a + k) * rr); } x.stroke(); }
  return tex(c);
}
let LAVA_TEX = null, SAND_TEX = null;
function buildHazards(G, th, r) {
  const map = G.map, hz = G.hz;
  if (hz === D.HZ_NONE) return;
  for (let c = 0; c < 176; c++) {
    if (map[c] !== D.T_HAZARD) continue;
    const [x, z] = cellCenter(c);
    const g = new THREE.Group(); g.position.set(x, 0, z); roomGroup.add(g);
    switch (hz) {
      case D.HZ_SPIKES: {
        const plate = mesh(new THREE.BoxGeometry(CELL - 0.2, 0.12, CELL - 0.2), std({ color: '#3a3836', metalness: 0.6, roughness: 0.5 })); plate.position.y = 0.06; plate.receiveShadow = true; g.add(plate);
        const sp = new THREE.Group(); g.add(sp);
        const metal = std({ color: '#c9ced6', metalness: 0.9, roughness: 0.25 });
        for (let i = 0; i < 9; i++) { const s = mesh(new THREE.ConeGeometry(0.22, 1.1, 6), metal); s.position.set(((i % 3) - 1) * 0.9, 0.55, (Math.floor(i / 3) - 1) * 0.9); sp.add(s); }
        for (let i = 0; i < 9; i++) { const h = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 8), std({ color: '#111' }), false); h.position.set(((i % 3) - 1) * 0.9, 0.13, (Math.floor(i / 3) - 1) * 0.9); g.add(h); }
        sp.position.y = -1.0;
        R.spikes.push(sp);
        break;
      }
      case D.HZ_THORNS: {
        const vine = std({ color: '#2f4a1e', roughness: 0.7 }), thorn = std({ color: '#c8b88a', roughness: 0.5 });
        for (let i = 0; i < 4; i++) {
          const pts = []; let a = r() * TAU;
          for (let k = 0; k < 6; k++) { pts.push(new V3((r() - 0.5) * 2.4, 0.15 + r() * 0.6, (r() - 0.5) * 2.4)); a += 1; }
          const tube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6), vine); g.add(tube);
          for (let k = 0; k < 6; k++) { const t = mesh(new THREE.ConeGeometry(0.05, 0.3, 4), thorn, false); t.position.copy(pts[k]); t.rotation.set(r() * 3, r() * 3, r() * 3); g.add(t); }
        }
        const leaf = std({ color: '#3f6a28', roughness: 0.6, side: THREE.DoubleSide });
        for (let k = 0; k < 6; k++) { const l = mesh(new THREE.CircleGeometry(0.25, 5), leaf, false); l.position.set((r() - 0.5) * 2.4, 0.3 + r() * 0.4, (r() - 0.5) * 2.4); l.rotation.set(-1.2 + r(), r() * 3, 0); g.add(l); }
        break;
      }
      case D.HZ_ICE: {
        const ice = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.1, CELL), new THREE.MeshPhysicalMaterial({ color: '#7fb8e4', roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.5, transparent: true, opacity: 0.7 }));
        ice.position.y = 0.05; ice.receiveShadow = true; g.add(ice);
        break;
      }
      case D.HZ_LAVA: {
        LAVA_TEX ||= lavaTexture();
        const m = new THREE.MeshBasicMaterial({ map: LAVA_TEX, color: '#ffffff' });
        const lava = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), m); lava.rotation.x = -Math.PI / 2; lava.position.y = 0.03; g.add(lava);
        const rim = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.48, CELL * 0.72, 4, 1), std({ color: '#1a0c08', roughness: 1 })); rim.rotation.x = -Math.PI / 2; rim.rotation.z = Math.PI / 4; rim.position.y = 0.04; g.add(rim);
        R.lava.push(m);
        break;
      }
      case D.HZ_SAND: {
        SAND_TEX ||= sandTexture();
        const s = new THREE.Mesh(new THREE.CircleGeometry(CELL * 0.62, 32), std({ map: SAND_TEX, roughness: 1 })); s.rotation.x = -Math.PI / 2; s.position.y = 0.03; s.receiveShadow = true; g.add(s);
        R.anim.push(t => { s.rotation.z = t * 0.6; });
        break;
      }
      case D.HZ_BLOOD: {
        const p = new THREE.Mesh(new THREE.CircleGeometry(CELL * 0.55, 24), new THREE.MeshPhysicalMaterial({ color: '#5a0408', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 }));
        p.rotation.x = -Math.PI / 2; p.position.y = 0.03; p.scale.set(1 + r() * 0.2, 1 + r() * 0.2, 1); g.add(p);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- decorations by theme
function buildProps(G, th, r) {
  const map = G.map, t = G.theme;
  const free = [];
  for (let cy = 1; cy <= 9; cy++) for (let cx = 1; cx <= 14; cx++) {
    const c = cy * 16 + cx;
    if (map[c] !== D.T_FLOOR) continue;
    if (cx <= 3 && cy >= 4 && cy <= 6) continue; // the way in
    const edge = cx === 1 || cx === 14 || cy === 1 || cy === 9;
    if (edge) free.push(c);
  }
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n && free.length; i++) {
    const c = free.splice(Math.floor(r() * free.length), 1)[0];
    let [x, z] = cellCenter(c);
    const cx = c & 15, cy = c >> 4;
    x += cx === 1 ? -0.8 : cx === 14 ? 0.8 : (r() - 0.5);
    z += cy === 1 ? -0.8 : cy === 9 ? 0.6 : (r() - 0.5);
    const p = prop(t, r);
    p.position.set(x, 0, z); p.rotation.y = r() * TAU;
    roomGroup.add(p);
  }
  // banners / chains on the back wall
  for (let cx = 4; cx <= 11; cx += 7) {
    if (map[cx] !== D.T_WALL || map[cx + 1] !== D.T_WALL) continue;
    const b = wallBanner(t, r); b.position.set(wx(cx * 16 + 16), 0, wz(D.PLAY_Y + 16) + 0.02); roomGroup.add(b);
  }
}
const BANNER = ['#8a1c22', '#2c5a28', '#2a4a7a', '#7a2a10', '#5a5040', '#8a6020', '#5a2a8a', '#3a2a5a', '#6a0a12', '#2a4060'];
function wallBanner(t, r) {
  const g = new THREE.Group();
  const cloth = std({ color: BANNER[t], roughness: 0.8, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(1.6, 3.2, 1, 6);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < -1.4) pa.setY(i, y - (Math.abs(pa.getX(i)) < 0.1 ? 0.5 : 0)); }
  geo.computeVertexNormals();
  const b = mesh(geo, cloth, false); b.position.set(0, 3.4, 0.08); g.add(b);
  const rod = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 6), std({ color: '#3a2a1a' }), false); rod.rotation.z = Math.PI / 2; rod.position.set(0, 5.0, 0.12); g.add(rod);
  const em = mesh(new THREE.CircleGeometry(0.35, 6), std({ color: '#e0b040', metalness: 1, roughness: 0.3 }), false); em.position.set(0, 3.7, 0.1); g.add(em);
  return g;
}
const propMats = {};
const pm = (k, o) => propMats[k] || (propMats[k] = std(o));
function prop(t, r) {
  const g = new THREE.Group();
  const kind = r();
  const wood = pm('wood', { color: '#6a4426', roughness: 0.75 }), iron = pm('iron', { color: '#33302e', metalness: 0.7, roughness: 0.5 });
  const bone = pm('bone', { color: '#cfc3ac', roughness: 0.7 });
  const addBarrel = () => {
    const b = mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.9, 16), wood); b.position.y = 0.95; g.add(b);
    const mid = mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.2, 16), wood); mid.position.y = 0.95; g.add(mid);
    for (const y of [0.35, 1.55]) { const h = mesh(new THREE.TorusGeometry(0.9, 0.06, 6, 20), iron); h.rotation.x = Math.PI / 2; h.position.y = y; g.add(h); }
  };
  const addSkull = (x = 0, z = 0) => {
    const s = new THREE.Group(); s.position.set(x, 0.36, z);
    s.add(mesh(sph(0.36), bone)); const jaw = mesh(new THREE.BoxGeometry(0.36, 0.2, 0.26), bone); jaw.position.set(0, -0.24, 0.14); s.add(jaw);
    for (const q of [-1, 1]) { const e = mesh(sph(0.1, 8, 6), pm('dark', { color: '#1a1412', roughness: 1 }), false); e.position.set(0.13 * q, 0.04, 0.29); s.add(e); }
    g.add(s);
  };
  switch (t) {
    case 1: // moss: glowing mushrooms
      for (let i = 0; i < 4; i++) {
        const h = 0.4 + r() * 0.7, x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.6;
        const st = mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 6), pm('stem', { color: '#d8e0c0', roughness: 0.6 })); st.position.set(x, h / 2, z); g.add(st);
        const cap = mesh(new THREE.SphereGeometry(0.28 + r() * 0.2, 12, 8, 0, TAU, 0, Math.PI / 2), pm('cap', { color: '#3fae74', emissive: '#178a4c', emissiveIntensity: 0.4, roughness: 0.4 })); cap.position.set(x, h, z); g.add(cap);
      }
      break;
    case 2: // frost: ice crystals
      for (let i = 0; i < 3; i++) { const s = mesh(new THREE.ConeGeometry(0.3 + r() * 0.2, 1 + r() * 1.2, 5), pm('ice', { color: '#cdeaff', roughness: 0.1, metalness: 0.1, emissive: '#3a7aa8', emissiveIntensity: 0.25, envMapIntensity: 1.3 })); s.position.set((r() - 0.5) * 1.2, 0.5, (r() - 0.5) * 1.2); s.rotation.z = (r() - 0.5) * 0.5; g.add(s); }
      break;
    case 3: // ember: a brazier
      { const b = mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.6, 10), iron); b.position.y = 1.3; g.add(b);
        const leg = mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.1, 6), iron); leg.position.y = 0.55; g.add(leg);
        const coal = mesh(sph(0.55, 10, 6), pm('coal', { color: '#3a1004', emissive: '#ff5a10', emissiveIntensity: 1.2 })); coal.position.y = 1.55; coal.scale.y = 0.4; g.add(coal);
        const l = new THREE.PointLight('#ff6a20', 8, 7, 2); l.position.y = 2.2; g.add(l); }
      break;
    case 4: // bone: skulls and bones
      addSkull(0, 0); addSkull(0.6, 0.4);
      for (let i = 0; i < 3; i++) { const b = mesh(new THREE.CapsuleGeometry(0.07, 0.8, 4, 6), bone); b.position.set((r() - 0.5) * 1.4, 0.08, (r() - 0.5) * 1.4); b.rotation.set(Math.PI / 2, 0, r() * 3); g.add(b); }
      break;
    case 5: // sand: urns
      for (let i = 0; i < 2; i++) { const u = mesh(new THREE.LatheGeometry([0, 0.5, 0.75, 0.6, 0.3, 0.35].map((w, k) => new THREE.Vector2(w * 0.9, k * 0.35)), 14), pm('clay', { color: '#b0643a', roughness: 0.8 })); u.position.set(i ? 0.6 : -0.3, 0, i ? 0.3 : -0.2); g.add(u); }
      break;
    case 6: // crystal: a glowing cluster
      for (let i = 0; i < 4; i++) { const s = mesh(new THREE.ConeGeometry(0.2 + r() * 0.2, 0.8 + r() * 1.2, 5), pm('crys', { color: '#c8a0ff', emissive: '#7a3cff', emissiveIntensity: 0.8, roughness: 0.15 })); s.position.set((r() - 0.5) * 1, 0.4, (r() - 0.5) * 1); s.rotation.set((r() - 0.5), 0, (r() - 0.5)); g.add(s); }
      break;
    case 7: // shadow: candles
      for (let i = 0; i < 3; i++) { const h = 0.3 + r() * 0.5, c = mesh(new THREE.CylinderGeometry(0.12, 0.12, h, 8), pm('wax', { color: '#d8d0c0', roughness: 0.6 })); c.position.set((r() - 0.5) * 1, h / 2, (r() - 0.5) * 1); g.add(c);
        const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: '#b088ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.position.set(c.position.x, h + 0.2, c.position.z); f.scale.set(0.4, 0.6, 1); g.add(f); }
      break;
    case 8: // blood: cages and chains
      { const cage = new THREE.Group(); cage.position.y = 0;
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, bar = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4), iron); bar.position.set(Math.cos(a) * 0.6, 0.9, Math.sin(a) * 0.6); cage.add(bar); }
        const top = mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 16), iron); top.rotation.x = Math.PI / 2; top.position.y = 1.8; cage.add(top); g.add(cage); addSkull(0, 0); }
      break;
    case 9: // storm: a lightning rod
      { const p = mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 6), pm('copper', { color: '#b87040', metalness: 1, roughness: 0.3 })); p.position.y = 1.3; g.add(p);
        const orb = mesh(sph(0.25, 10, 8), pm('stormorb', { color: '#bfe0ff', emissive: '#5aa8ff', emissiveIntensity: 1.2 })); orb.position.y = 2.7; g.add(orb); }
      break;
    default:
      if (kind < 0.5) addBarrel();
      else { addSkull(); const c = mesh(new THREE.BoxGeometry(1.4, 1, 1.4), wood); c.position.set(0.4, 0.5, 0.3); g.add(c); }
  }
  g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

// ---------------------------------------------------------------- special room objects
function buildObject(G, k, th) {
  const c = G.ob_k[k], t = G.ob_t[k], [x, z] = cellCenter(c);
  const g = new THREE.Group(); g.position.set(x, 0, z); roomGroup.add(g);
  const o = { g, t, k, parts: {} };
  const gold = std({ color: '#e0a83a', metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });
  if (t === D.OBJ_CHEST || t === D.OBJ_CHEST_OPEN) {
    const wood = std({ color: '#7a4a26', roughness: 0.7 });
    const b = mesh(new THREE.BoxGeometry(2.4, 1.3, 1.6), wood); b.position.y = 0.65; g.add(b);
    const lidG = new THREE.Group(); lidG.position.set(0, 1.3, -0.8); g.add(lidG);
    const lid = mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 14, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.position.z = 0.8; lidG.add(lid);
    for (const s of [-0.8, 0.8]) { const band = mesh(new THREE.BoxGeometry(0.2, 1.36, 1.66), gold); band.position.set(s, 0.66, 0); g.add(band); }
    const lock = mesh(new THREE.BoxGeometry(0.4, 0.45, 0.12), gold); lock.position.set(0, 1.2, 0.84); g.add(lock);
    const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#ffd36a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
    shine.scale.set(4, 4, 1); shine.position.y = 1; g.add(shine);
    o.parts = { lidG, shine };
  } else if (t === D.OBJ_SHRINE || t === D.OBJ_SHRINE_USED) {
    const stone = std({ color: '#a89c8c', roughness: 0.7 });
    const base = mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.7, 8), stone); base.position.y = 0.35; g.add(base);
    const ped = mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 8), stone); ped.position.y = 1.5; g.add(ped);
    const bowl = mesh(new THREE.CylinderGeometry(1, 0.5, 0.5, 12), gold); bowl.position.y = 2.5; g.add(bowl);
    const orb = mesh(sph(0.45, 16, 12), std({ color: '#ffe9a0', emissive: '#ffb02e', emissiveIntensity: 1.6, roughness: 0.2 })); orb.position.y = 3.2; g.add(orb);
    const l = new THREE.PointLight('#ffc060', 18, 12, 1.8); l.position.y = 3.4; g.add(l);
    o.parts = { orb, l };
  } else if (t === D.OBJ_FOUNTAIN || t === D.OBJ_FOUNTAIN_DRY) {
    const stone = std({ color: '#9aa0a8', roughness: 0.6 });
    const basin = mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.8, 20), stone); basin.position.y = 0.4; g.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshPhysicalMaterial({ color: '#ff5a6a', emissive: '#c01030', emissiveIntensity: 0.6, roughness: 0.05, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.75; g.add(water);
    const col = mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 8), stone); col.position.y = 1.4; g.add(col);
    const top = mesh(new THREE.CylinderGeometry(0.6, 0.2, 0.3, 12), stone); top.position.y = 2.4; g.add(top);
    const l = new THREE.PointLight('#ff4a6a', 10, 9, 2); l.position.y = 1.6; g.add(l);
    o.parts = { water, l };
  } else if (t === D.OBJ_CRACK) {
    const isWall = G.map[c] === D.T_CRACK;
    const blk = mesh(new THREE.BoxGeometry(CELL - 0.1, IN_H, CELL - 0.1), std({ color: new THREE.Color(th.pillar).multiplyScalar(0.8), roughness: 0.9 })); blk.position.y = IN_H / 2; g.add(blk);
    const crackM = new THREE.MeshBasicMaterial({ color: '#ffcf6a', transparent: true, opacity: 0.85 });
    for (let i = 0; i < 4; i++) { const cr = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.6 + i * 0.3), crackM); cr.position.set((i - 1.5) * 0.5, 1.4 + (i & 1) * 0.6, CELL / 2 - 0.02); cr.rotation.z = (i & 1 ? 0.5 : -0.4); g.add(cr); }
    o.parts = { crackM, isWall };
  } else if (t === D.OBJ_LAUNCHER) {
    const iron = std({ color: '#2b2a2c', metalness: 0.8, roughness: 0.45 });
    const box = mesh(new THREE.BoxGeometry(1.4, 1.2, 0.8), iron); box.position.set(0, 2.6, CELL / 2 + 0.2); g.add(box);
    const hole = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 10), std({ color: '#000' })); hole.rotation.x = Math.PI / 2; hole.position.set(0, 2.6, CELL / 2 + 0.65); g.add(hole);
    const eye = new THREE.Mesh(sph(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a2a' })); eye.position.set(0, 3.3, CELL / 2 + 0.6); g.add(eye);
    o.parts = { eye };
  } else if (t === D.OBJ_ALCH_L) {
    // the Tower King's alchemy cabinet (two cells)
    const wood = std({ color: '#4a2c1a', roughness: 0.7 });
    const cab = mesh(new THREE.BoxGeometry(CELL * 2 - 0.4, 4.2, 1.6), wood); cab.position.set(CELL / 2, 2.1, -0.6); g.add(cab);
    for (let s = 0; s < 3; s++) { const sh = mesh(new THREE.BoxGeometry(CELL * 2 - 0.6, 0.12, 1.4), wood); sh.position.set(CELL / 2, 1.2 + s * 1.2, 0.2); g.add(sh); }
    const cols = ['#5fe36a', '#4fa8ff', '#ff4a6a', '#ffd25a', '#b57cff', '#7fffd0'];
    for (let i = 0; i < 9; i++) {
      const cc = cols[i % cols.length];
      const b = mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.6, 10), new THREE.MeshPhysicalMaterial({ color: cc, emissive: cc, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }));
      b.position.set(-0.8 + (i % 5) * 1.0 + (Math.floor(i / 5)) * 0.4, 1.6 + Math.floor(i / 3) % 3 * 1.2, 0.4); g.add(b);
    }
    const l = new THREE.PointLight('#a0ff80', 10, 10, 2); l.position.set(CELL / 2, 3, 1.5); g.add(l);
  }
  return o;
}
export { THREE };
