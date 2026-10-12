// ============================================================================
//  DUNGEON HEART  -  the title screen's world (after the owner's picture): the knight on a stone
//  bridge over a misty drop, stairs climbing to his wife in a lit alcove at the top of the tower,
//  dark battlements, chains and torches all around.
// ============================================================================
import { THREE, std, mesh, sph, TEX, TAU, V3, GlowLight, themeTextures, rng } from './engine.js';
import { buildHero, equipHeroWeapon, animHero, buildWife } from './models.js';

// a box whose stone texture tiles at `unit` world units instead of stretching over every face
function sbox(w, h, d, m, unit = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / unit, uv.getY(i) * dims[f][1] / unit); }
  const b = mesh(g, m); b.receiveShadow = true; return b;
}
function tiled(T, color) {
  const rep = t => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.needsUpdate = true; return c; };
  return std({ map: rep(T.map), normalMap: rep(T.normal), roughnessMap: rep(T.rough), color, roughness: 0.95, envMapIntensity: 0.25 });
}
const flameMat = () => new THREE.SpriteMaterial({ map: TEX.flame, color: '#ffb35c', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
const haloMat = (o = 0.22) => new THREE.SpriteMaterial({ map: TEX.soft, color: '#ff9a48', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o });

export function buildTitleWorld() {
  const root = new THREE.Group();
  const T = themeTextures(0);
  const stone = tiled(T.wall, '#9a8e80'), floor = tiled(T.floor, '#b0a290'), dark = tiled(T.wall, '#4a423c'), far = tiled(T.wall, '#2e2a2a');
  const cap = std({ color: '#6e6258', roughness: 0.9 }), capDark = std({ color: '#26201c', roughness: 0.9 });
  const iron = std({ color: '#2a2725', metalness: 0.7, roughness: 0.5 });
  const flames = [], lights = [];
  const r = rng(77);
  // (a warm fill of its own, so the dark stone reads)
  const fill = new THREE.HemisphereLight('#ffc890', '#30202a', 1.4); root.add(fill);

  // a square post with the carved square cap the owner draws (a dark inset in the top)
  function post(x, y, z, w, h, m = stone) {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    const b = sbox(w, h, w, m); b.position.y = h / 2; g.add(b);
    const c = sbox(w + 0.4, 0.5, w + 0.4, cap, 2); c.position.y = h + 0.25; g.add(c);
    const ring = mesh(new THREE.BoxGeometry(w * 0.62, 0.06, w * 0.62), capDark, false); ring.position.y = h + 0.52; g.add(ring);
    const inner = mesh(new THREE.BoxGeometry(w * 0.42, 0.08, w * 0.42), cap, false); inner.position.y = h + 0.54; g.add(inner);
    const hole = mesh(new THREE.BoxGeometry(w * 0.2, 0.1, w * 0.2), capDark, false); hole.position.y = h + 0.56; g.add(hole);
    return g;
  }
  // a fire bowl on a post top, or a torch on a wall
  function brazier(x, y, z, big = true, light = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    const bowl = mesh(new THREE.CylinderGeometry(big ? 0.75 : 0.35, big ? 0.4 : 0.2, big ? 0.55 : 0.35, 12), iron); bowl.position.y = big ? 0.28 : 0.18; g.add(bowl);
    const coal = mesh(new THREE.CylinderGeometry(big ? 0.62 : 0.28, big ? 0.62 : 0.28, 0.05, 12), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }), false); coal.position.y = big ? 0.56 : 0.36; g.add(coal);
    const f = new THREE.Sprite(flameMat()); f.position.y = big ? 1.4 : 0.85; f.scale.set(big ? 1.9 : 0.9, big ? 2.6 : 1.3, 1); g.add(f);
    const h = new THREE.Sprite(haloMat(big ? 0.28 : 0.18)); h.position.y = f.position.y; h.scale.setScalar(big ? 7 : 3.5); g.add(h);
    flames.push({ f, h, ph: r() * 10, big });
    if (light) { const l = new GlowLight('#ff9a48', light, 16, 1.6); l.position.y = 2; g.add(l); lights.push(l); }
    return g;
  }
  // a red banner with a dark horned emblem, hanging from a wall face that looks toward +z
  const bannerTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#8a1418'; x.fillRect(0, 0, 64, 128);
    x.fillStyle = '#5a0a0e'; x.fillRect(0, 0, 64, 10); x.fillRect(4, 14, 56, 3);
    x.beginPath(); x.moveTo(0, 104); x.lineTo(32, 128); x.lineTo(64, 104); x.lineTo(64, 128); x.lineTo(0, 128); x.closePath(); x.globalCompositeOperation = 'destination-out'; x.fill(); x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#3a0408'; x.beginPath(); x.moveTo(32, 40); x.lineTo(46, 50); x.lineTo(52, 34); x.lineTo(48, 62); x.lineTo(32, 76); x.lineTo(16, 62); x.lineTo(12, 34); x.lineTo(18, 50); x.closePath(); x.fill();
    x.fillStyle = '#c0282c'; x.fillRect(24, 54, 5, 4); x.fillRect(35, 54, 5, 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  function banner(x, y, z, s = 1, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * s, 3.2 * s), new THREE.MeshStandardMaterial({ map: bannerTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.set(x, y - 1.6 * s, z); m.rotation.y = ry; root.add(m);
    const rod = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9 * s, 6), iron); rod.rotation.z = Math.PI / 2; rod.position.set(x, y, z); rod.rotation.y = ry; root.add(rod);
    return m;
  }
  // a hanging chain between two points (a sagging line of links)
  function chain(a, b, sag) {
    const n = Math.round(a.distanceTo(b) / 0.55);
    const linkG = new THREE.TorusGeometry(0.22, 0.07, 5, 10);
    for (let i = 0; i <= n; i++) {
      const k = i / n, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * sag;
      const l = mesh(linkG, iron, false); l.position.copy(p);
      const d = b.clone().sub(a).normalize(); l.lookAt(p.clone().add(d)); if (i & 1) l.rotateZ(Math.PI / 2); root.add(l);
    }
  }

  // ---------------------------------------------------------------- the bridge (y = 0 is its deck)
  const BW = 9; // deck width
  const deck = sbox(BW, 3, 30, floor, 2.4); deck.position.set(0, -1.5, 9); root.add(deck);
  const under = sbox(BW - 1.2, 30, 26, dark); under.position.set(0, -18, 9); root.add(under);
  for (const s of [-1, 1]) {
    const wall = sbox(1, 1.1, 30, stone); wall.position.set(s * (BW / 2 - 0.5), 0.55, 9); root.add(wall);
    const lip = sbox(1.3, 0.25, 30, stone, 2); lip.position.set(s * (BW / 2 - 0.5), 1.22, 9); root.add(lip);
    // the big square pillars along it, and the fire posts at the foot of the stairs
    post(s * (BW / 2 + 0.2), 0, 18, 2.8, 3.6);
    post(s * (BW / 2 + 0.2), 0, 1.5, 2.8, 3.6);
    post(s * (BW / 2 + 1.8), 0, -3.5, 1.9, 3.2); brazier(s * (BW / 2 + 1.8), 3.75, -3.5, true, 14);
    post(s * (BW / 2 - 0.3), 0, -4.8, 1.5, 2.4); brazier(s * (BW / 2 - 0.3), 2.95, -4.8, false);
    // chains from the pillars out to the towers
    chain(new V3(s * (BW / 2 + 1.4), 2.6, 1.5), new V3(s * 17, 1, -2), 4);
    chain(new V3(s * (BW / 2 + 1.4), 2.6, 18), new V3(s * 18, 0, 22), 4);
  }

  // ---------------------------------------------------------------- the stairs up to the alcove
  const STEPS = 14, RISE = 0.55, RUN = 0.85, SW = 7;
  for (let i = 0; i < STEPS; i++) {
    const st = sbox(SW, RISE * (i + 1), RUN, floor, 2.4); st.position.set(0, RISE * (i + 1) / 2, -6 - i * RUN - RUN / 2); root.add(st);
  }
  const topY = STEPS * RISE, topZ = -6 - STEPS * RUN; // (7.7 up, at z = -17.9)
  for (const s of [-1, 1]) {
    // side walls stepping up with the stairs, candles on them
    const sw = sbox(1.6, topY + 1.2, STEPS * RUN + 2, stone); sw.position.set(s * (SW / 2 + 0.8), (topY + 1.2) / 2 - 0.6, -6 - STEPS * RUN / 2 + 0.5); root.add(sw);
    for (let k = 0; k < 3; k++) brazier(s * (SW / 2 + 0.8), topY + 0.6, -8 - k * 4, false);
    // the tower walls either side of the alcove, with banners
    const tw = sbox(6, topY + 9, 10, stone); tw.position.set(s * (SW / 2 + 4.6), (topY + 9) / 2 - 2, topZ - 3); root.add(tw);
    banner(s * (SW / 2 + 4.6), topY + 6.2, topZ + 2.05, 1.5);
    post(s * (SW / 2 + 1.2), topY, topZ - 0.6, 1.4, 1.6); brazier(s * (SW / 2 + 1.2), topY + 2.15, topZ - 0.6, false, 6);
  }
  // the alcove: a landing, a back wall with a lit arched recess, a stepped pediment
  const land = sbox(SW + 0.4, 1, 7, floor, 2.4); land.position.set(0, topY - 0.5, topZ - 3.5); root.add(land);
  const back = sbox(SW + 2, 12, 2, stone); back.position.set(0, topY + 6, topZ - 7.5); root.add(back);
  const recessM = new THREE.MeshBasicMaterial({ color: '#ffcf80' });
  const arch = new THREE.Shape(); arch.moveTo(-1.8, 0); arch.lineTo(-1.8, 3.6); arch.absarc(0, 3.6, 1.8, Math.PI, 0, true); arch.lineTo(1.8, 0); arch.lineTo(-1.8, 0);
  const rec = new THREE.Mesh(new THREE.ShapeGeometry(arch, 16), recessM); rec.position.set(0, topY, topZ - 6.48); root.add(rec);
  const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#ffb84a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.15 }));
  glowS.position.set(0, topY + 2.5, topZ - 6.3); glowS.scale.setScalar(9); root.add(glowS);
  for (let k = 0; k < 3; k++) { const p = sbox(SW + 2 - k * 2.4, 1.2, 2.4 - k * 0.3, stone); p.position.set(0, topY + 12.6 + k * 1.2, topZ - 7.3); root.add(p); }
  const wife = buildWife(); wife.scale.multiplyScalar(1.25); wife.position.set(0, topY, topZ - 4.2); root.add(wife);
  const wl = new GlowLight('#ffc070', 12, 12, 1.4); wl.position.set(0, topY + 4, topZ - 1.5); root.add(wl); lights.push(wl);

  // ---------------------------------------------------------------- the knight on the bridge
  const knight = buildHero(0); equipHeroWeapon(knight, 0, 1, 0); knight.scale.multiplyScalar(1.15); knight.position.set(0, 0, 3); knight.rotation.y = Math.PI; root.add(knight);

  // ---------------------------------------------------------------- the dark towers and battlements all round
  const towers = [[-19, -16, 9, 12], [19, -15, 9, 12], [-24, 2, 8, 14], [24, 4, 8, 14], [-19, 22, 10, 10], [19, 21, 10, 10], [-12, -28, 8, 8], [12, -28, 8, 8], [-30, -12, 6, 10], [30, -10, 6, 10], [-30, 16, 6, 8], [30, 16, 6, 8], [-22, -34, 10, 10], [22, -34, 10, 10], [0, -42, 14, 8], [-36, -26, 8, 10], [36, -26, 8, 10], [-10, -48, 8, 8], [10, -50, 8, 8]];
  for (const [x, z, w, d] of towers) {
    const top = -2 + r() * 8, h = top + 40;
    const tw = sbox(w, h, d, Math.abs(x) > 26 || z < -24 ? far : dark); tw.position.set(x, top - h / 2, z); root.add(tw);
    // crenellations round the top
    for (let i = -w / 2 + 0.6; i <= w / 2 - 0.6; i += 1.6) for (const s of [-1, 1]) { const c = sbox(0.9, 0.9, 0.9, stone, 1.5); c.position.set(x + i, top + 0.45, z + s * (d / 2 - 0.45)); root.add(c); }
    for (let i = -d / 2 + 2.2; i <= d / 2 - 2.2; i += 1.6) for (const s of [-1, 1]) { const c = sbox(0.9, 0.9, 0.9, stone, 1.5); c.position.set(x + s * (w / 2 - 0.45), top + 0.45, z + i); root.add(c); }
    // arched openings down the face that looks toward the camera, glowing
    for (let k = 0; k < 2; k++) {
      const a = new THREE.Mesh(new THREE.ShapeGeometry(arch, 10), new THREE.MeshBasicMaterial({ color: k ? '#2a160c' : '#ff9a48', transparent: true, opacity: k ? 1 : 0.5 }));
      a.scale.setScalar(0.5); a.position.set(x + (r() - 0.5) * (w - 3), top - 4 - k * 6 - r() * 2, z + d / 2 + 0.02); root.add(a);
    }
    if (r() < 0.6) banner(x + (r() - 0.5) * (w - 3), top - 1.2, z + d / 2 + 0.05, 1.1);
    for (let k = 0; k < 2; k++) brazier(x + (k ? 1 : -1) * (w / 2 - 0.8), top + 0.1, z + d / 2 - 0.8, false);
  }
  // walkways and arches bridging the towers in the distance
  for (const [x1, z1, x2, z2, y] of [[-19, -10, -24, -4, -3], [19, -9, 24, -2, -2], [-24, 9, -19, 17, -4], [24, 11, 19, 16, -3]]) {
    const len = Math.hypot(x2 - x1, z2 - z1), wk = sbox(2.4, 1.2, len, dark);
    wk.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); wk.rotation.y = Math.atan2(x2 - x1, z2 - z1); root.add(wk);
  }
  // the drop: mist below
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), new THREE.MeshBasicMaterial({ color: '#3a3058', transparent: true, opacity: 0.6, depthWrite: false }));
  mist.rotation.x = -Math.PI / 2; mist.position.y = -16; root.add(mist);
  const mist2 = mist.clone(); mist2.material = mist.material.clone(); mist2.material.opacity = 0.35; mist2.position.y = -8; root.add(mist2);
  const deepFloor = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), new THREE.MeshBasicMaterial({ color: '#0c0c14' })); deepFloor.rotation.x = -Math.PI / 2; deepFloor.position.y = -40; root.add(deepFloor);

  root.traverse(o => { if (o.isMesh) o.castShadow = o.castShadow && o.position.y > -5; });

  function update(t) {
    wife.userData.anim(t, { moving: false, happy: false });
    animHero(knight, t, { walk: 0, move: 0, swing: -1, whirl: false, cast: -1, roll: 0, orbColor: null });
    for (const q of flames) { const k = 1 + Math.sin(t * 9 + q.ph) * 0.08 + Math.sin(t * 23 + q.ph) * 0.05; q.f.scale.y = (q.big ? 2.6 : 1.3) * k; q.h.material.opacity = (q.big ? 0.28 : 0.18) * (0.85 + 0.15 * k); }
    glowS.material.opacity = 0.14 + Math.sin(t * 1.6) * 0.03;
    wl.intensity = 12 + Math.sin(t * 2) * 2;
  }
  // the camera: behind and above the knight, looking up the bridge and the stairs at her
  const cam = { pos: new V3(0, 22, 23), look: new V3(0, 2.5, -7.5), fov: 50, posP: new V3(0, 27, 31), lookP: new V3(0, 2, -6), fovP: 64 };
  return { root, update, cam };
}
