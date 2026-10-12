// ============================================================================
//  DUNGEON HEART  -  view: draws the game's state (sim.js) in 3D each frame,
//  and turns its events into particles, flashes, shakes and numbers.
// ============================================================================
import { THREE, scene, camera, TEX, TAU, V3, R, ax, az, wx, wz, PX, CELL, buildRoom, placeCamera, shake, hemi, sun, roomGroup,
  textSprite, std, mesh, sph, THEMES, view as camView, IS_TOUCH } from './engine.js';
import { buildHero, animHero, buildMonster, buildBoss, buildKingWizard, buildWife, buildMerchant, buildItem, makeFlashable } from './models.js';
import * as D from './data.js';
import { G, faded, tame_zone, ANIM_LEN, ANIM_SHOT, slash_index, TAL } from './sim.js';

export const V = { hero: null, heroCls: -1, mons: [], items: [], boss: null, bossArt: -1, king: null, pet: null, petType: 0, merchant: null, wife: null,
  t: 0, walk: 0, roomSeed: 1, heroPos: new V3(), heroFace: Math.PI / 2, nums: [], flashA: 0, flashCol: '#fff', ui: null, lastSwing: -1 };
const tmp = new V3();

// ---------------------------------------------------------------- particles
const parts = [];
const partMats = {};
function partMat(color, add) {
  const k = color + (add ? 'a' : 'n');
  return partMats[k] || (partMats[k] = new THREE.SpriteMaterial({ map: TEX.soft, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
}
export function burst(x, y, z, color, n = 10, spd = 5, size = 0.9, add = false, life = 0.6, grav = 6) {
  const cap = camView.quality >= 2 ? 500 : 220;
  for (let i = 0; i < n && parts.length < cap; i++) {
    const m = partMat(color, add).clone();
    const s = new THREE.Sprite(m); s.position.set(x, y, z);
    const a = Math.random() * TAU, v = spd * (0.4 + Math.random());
    parts.push({ s, vx: Math.cos(a) * v, vy: Math.random() * spd * 0.8, vz: Math.sin(a) * v, t: 0, life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), grav });
    scene.add(s);
  }
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt;
    const k = p.t / p.life;
    if (k >= 1) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); continue; }
    p.vy -= p.grav * dt;
    p.s.position.x += p.vx * dt; p.s.position.y = Math.max(0.15, p.s.position.y + p.vy * dt); p.s.position.z += p.vz * dt;
    p.s.scale.setScalar(p.size * (1 + k)); p.s.material.opacity = 1 - k;
  }
}
// rings on the floor (slam shockwaves, novas, level ups)
const rings = [];
function ring(x, z, color, r0 = 0.5, r1 = 6, life = 0.5, y = 0.15) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m);
  rings.push({ m, r0, r1, life, t: 0 });
}
function stepRings(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt; const k = r.t / r.life;
    if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); continue; }
    const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)); r.m.scale.set(s, s, s); r.m.material.opacity = 0.9 * (1 - k);
  }
}
// lightning bolts (the storm, the King)
const bolts3d = [];
function lightning(x, z, color = '#cfe6ff') {
  const pts = []; let px = x, pz = z;
  for (let y = 14; y >= 0; y -= 1.4) { pts.push(new V3(px + (Math.random() - 0.5) * 1.2, y, pz + (Math.random() - 0.5) * 0.6)); }
  pts[pts.length - 1].set(x, 0.1, z);
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.12, 5);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(m);
  const l = new THREE.PointLight(color, 120, 30, 1.5); l.position.set(x, 4, z); scene.add(l);
  bolts3d.push({ m, l, t: 0 });
}
function stepLightning(dt) {
  for (let i = bolts3d.length - 1; i >= 0; i--) {
    const b = bolts3d[i]; b.t += dt;
    if (b.t > 0.25) { scene.remove(b.m, b.l); b.m.geometry.dispose(); bolts3d.splice(i, 1); continue; }
    b.m.material.opacity = 1 - b.t / 0.25; b.l.intensity = 120 * (1 - b.t / 0.25);
  }
}

// ---------------------------------------------------------------- pools: shots and bolts
const SHOT_COL = ['#ff7a2a', '#ff7a2a', '#d8c8a0', '#7a3cd0', '#9a5cff', '#ff4a3a'];
const shots = [];
for (let i = 0; i < D.MAXP; i++) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const core = new THREE.Mesh(sph(0.32, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffe0a0' }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#ff7a2a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(2.4, 2.4, 1);
  const arrow = new THREE.Group();
  arrow.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), std({ color: '#c8a070' })));
  const head = mesh(new THREE.ConeGeometry(0.1, 0.3, 5), std({ color: '#cfd6de', metalness: 1, roughness: 0.3 })); head.position.y = 0.8; arrow.add(head);
  arrow.rotation.x = Math.PI / 2;
  g.add(core, glow, arrow);
  shots.push({ g, core, glow, arrow, src: -1, trailT: 0 });
}
const bolts = [];
for (let i = 0; i < D.MAXB; i++) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const core = new THREE.Mesh(sph(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#7ad0ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(2.2, 2.2, 1);
  const arrow = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 5), std({ color: '#c8a070' })); arrow.add(shaft);
  const head = mesh(new THREE.ConeGeometry(0.11, 0.34, 5), std({ color: '#e0e6ee', metalness: 1, roughness: 0.25 })); head.position.y = 0.9; arrow.add(head);
  for (const s of [-1, 1]) { const f = mesh(new THREE.BoxGeometry(0.18, 0.28, 0.01), std({ color: '#e8e0d0' })); f.position.set(0.07 * s, -0.7, 0); arrow.add(f); }
  arrow.rotation.x = Math.PI / 2;
  const light = new THREE.PointLight('#7ad0ff', 6, 6, 2);
  g.add(core, glow, arrow, light);
  bolts.push({ g, core, glow, arrow, light });
}
// the mage's bolt colors by his talents' tree (fire, frost, arcane; none: pale)
function boltColor() {
  const t = [0, 0, 0];
  for (let k = 0; k < D.NTAL; k++) t[k >= 10 ? 2 : (k >= 5 ? 1 : 0)] += G.tal[k];
  if (!(t[0] | t[1] | t[2])) return '#cfe6ff';
  if (t[0] >= t[1] && t[0] >= t[2]) return '#ff7a2a';
  if (t[1] >= t[2]) return '#7ad8ff';
  return '#c27cff';
}

// ---------------------------------------------------------------- the hero's slash
const trail = new THREE.Mesh(new THREE.RingGeometry(1.8, 4.6, 32, 1, -1.15, 2.3),
  new THREE.MeshBasicMaterial({ color: '#fff1c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
trail.rotation.x = -Math.PI / 2; scene.add(trail);
const heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
heroShadow.rotation.x = -Math.PI / 2; heroShadow.position.y = 0.04; scene.add(heroShadow);
const heroLight = new THREE.PointLight('#ffd8a8', 0, 14, 1.6); scene.add(heroLight);
// the taming ring
const tameRing = new THREE.Group(); tameRing.visible = false; scene.add(tameRing);
{
  const base = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }));
  tameRing.add(base);
  tameRing.userData.zone = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.2, 8, 32, 1), new THREE.MeshBasicMaterial({ color: '#ffc93c' }));
  tameRing.add(tameRing.userData.zone);
  const dot = new THREE.Mesh(sph(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  tameRing.add(dot); tameRing.userData.dot = dot;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(1.6, 1.6, 1); dot.add(glow);
}
// the storm's mark
const stormMark = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ map: TEX.soft, color: '#bfe0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
stormMark.rotation.x = -Math.PI / 2; stormMark.position.y = 0.08; scene.add(stormMark);
// bones that will rise (HZ_BONES)
const bonePiles = [];
for (let k = 0; k < D.MAXBN; k++) {
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  const bm = std({ color: '#d8ccb4', roughness: 0.7 });
  const sk = mesh(sph(0.35, 10, 8), bm); sk.position.set(0, 0.3, 0); g.add(sk);
  for (let i = 0; i < 4; i++) { const b = mesh(new THREE.CapsuleGeometry(0.07, 0.7, 4, 6), bm); b.position.set((Math.random() - 0.5) * 1, 0.1, (Math.random() - 0.5) * 1); b.rotation.set(Math.PI / 2, 0, Math.random() * 3); g.add(b); }
  bonePiles.push(g);
}
// the boss's ward bubble
const ward = new THREE.Mesh(sph(4.2, 24, 16), new THREE.MeshBasicMaterial({ color: '#7ad0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(ward);

// ---------------------------------------------------------------- per-room setup
export function onRoom() {
  V.roomSeed = (G.floor_num * 97 + G.room_num * 13 + G.door_pos * 7) | 0;
  buildRoom(G, V.roomSeed);
  for (const m of V.mons) if (m) scene.remove(m.root);
  V.mons = [];
  for (const it of V.items) if (it) scene.remove(it.g);
  V.items = [];
  if (V.boss) { scene.remove(V.boss); V.boss = null; V.bossArt = -1; }
  if (V.king) { scene.remove(V.king); V.king = null; }
  if (V.merchant) { scene.remove(V.merchant); V.merchant = null; }
  if (V.wife) { scene.remove(V.wife); V.wife = null; }
  for (const p of parts) scene.remove(p.s);
  parts.length = 0;
  ensureHero();
  V.heroPos.set(ax(G.px), 0, az(G.py));
  if (V.pet) { V.pet.root.position.set(ax(G.pet_x), 0, az(G.pet_y)); }
  // the shadow halls: dark, the hero carries a light
  const dark = G.hz === D.HZ_DARK;
  heroLight.intensity = dark ? 70 : 0;
  placeCamera(V.heroPos.x, V.heroPos.z, true);
}
function ensureHero() {
  if (V.heroCls === G.player_class && V.hero) return;
  if (V.hero) scene.remove(V.hero);
  V.hero = buildHero(G.player_class);
  V.heroCls = G.player_class;
  scene.add(V.hero);
}
function monModel(n) {
  const t = G.m_type[n];
  let m = V.mons[n];
  if (m && m.type === t) return m;
  if (m) scene.remove(m.root);
  if (!t) { V.mons[n] = null; return null; }
  const root = buildMonster(t, G.floor_num);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; root.add(sh);
  // elite aura sparkles, frozen block, flames
  const aura = new THREE.Group(); root.add(aura);
  const ice = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 2.6), new THREE.MeshPhysicalMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.45, roughness: 0.05, clearcoat: 1, depthWrite: false }));
  ice.position.y = 1.5; ice.visible = false; root.add(ice);
  const fire = new THREE.Group(); fire.visible = false; root.add(fire);
  for (let i = 0; i < 4; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: '#ff7a2a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.scale.set(1, 1.5, 1); fire.add(f); }
  root.position.set(ax(G.m_x[n]), 0, az(G.m_y[n]));
  scene.add(root);
  m = { root, type: t, aura, ice, fire, seed: Math.random() * 10, x: G.m_x[n], y: G.m_y[n], face: 0, auraBuilt: 0, lastX: G.m_x[n], lastY: G.m_y[n], spawnT: 0 };
  V.mons[n] = m;
  return m;
}
function itemModel(i) {
  const k = G.i_kind[i];
  let it = V.items[i];
  const key = k * 100 + G.i_rar[i] * 10 + G.player_class;
  if (it && it.key === key && it.x === G.i_x[i] && it.y === G.i_y[i]) return it;
  if (it) scene.remove(it.g);
  if (!k) { V.items[i] = null; return null; }
  const g = buildItem(k, G.i_rar[i], G.player_class);
  g.position.set(wx(G.i_x[i] + 4), 0, wz(G.i_y[i] + 6));
  scene.add(g);
  it = { g, key, x: G.i_x[i], y: G.i_y[i], seed: Math.random() * 10, pop: 0 };
  V.items[i] = it;
  return it;
}

// ---------------------------------------------------------------- events from the game
export function onEvents(ev, ui) {
  for (const e of ev) {
    switch (e.k) {
      case 'room': onRoom(); ui.roomStart(); break;
      case 'hit': {
        const m = V.mons[e.n]; const x = m ? m.root.position.x : ax(e.x), z = m ? m.root.position.z : az(e.y);
        burst(x, 1.5, z, e.crit ? '#ffd36a' : '#fff4d0', e.crit ? 10 : 6, 6, 0.55, true, 0.4);
        ui.num(x, 3.2, z, e.crit ? e.d + '!' : String(e.d), e.crit ? 'crit' : '');
        shake.t = Math.max(shake.t, e.crit ? 0.14 : 0.07); shake.amp = e.crit ? 0.6 : 0.35;
        break;
      }
      case 'die': {
        const m = V.mons[e.n]; const x = m ? m.root.position.x : ax(e.x), z = m ? m.root.position.z : az(e.y);
        const col = { 1: '#5ee05a', 2: '#7a5a8a', 3: '#e6dccb', 4: '#6a4a8a', 5: '#d8e8ff', 6: '#b07cff', 7: '#ff5a3a', 8: '#9a948a', 9: '#e6dccb',
          10: '#ff8a3a', 11: '#a02040', 12: '#7ae0ff', 13: '#e0502a', 14: '#9a6aff', 15: '#c03020', 16: '#6a4aaa', 17: '#ff7a2a' }[e.t] || '#ffffff';
        burst(x, 1.2, z, col, 18, 8, 1.1, false, 0.7);
        burst(x, 1.2, z, '#ffffff', 6, 6, 0.5, true, 0.3);
        if (m) { m.dying = 0.3; V.mons[e.n] = null; dying.push(m); }
        break;
      }
      case 'bosshit': {
        if (V.boss || V.king) {
          const b = V.king && V.king.visible ? V.king : V.boss;
          ui.num(b.position.x, 7, b.position.z, e.crit ? e.d + '!' : String(e.d), e.crit ? 'crit' : (e.ward ? 'ward' : ''));
          burst(b.position.x, 3, b.position.z, e.ward ? '#7ad0ff' : '#fff4d0', 6, 7, 0.7, true, 0.35);
        }
        shake.t = Math.max(shake.t, 0.08); shake.amp = 0.4;
        break;
      }
      case 'hurt': {
        burst(V.heroPos.x, 2, V.heroPos.z, '#ff5a4a', 8, 5, 0.6, false, 0.4);
        ui.num(V.heroPos.x, 4.2, V.heroPos.z, '-' + e.d, 'hurt');
        ui.hurt();
        shake.t = Math.max(shake.t, 0.18); shake.amp = 0.7;
        break;
      }
      case 'block': ui.num(V.heroPos.x, 4.2, V.heroPos.z, 'BLOCK', 'block'); burst(V.heroPos.x, 2, V.heroPos.z, '#bfe0ff', 8, 5, 0.6, true, 0.3); break;
      case 'iceblock': ring(V.heroPos.x, V.heroPos.z, '#7ad0ff', 1, 3, 0.6); break;
      case 'levelup': burst(V.heroPos.x, 2, V.heroPos.z, '#ffd36a', 26, 7, 0.9, true, 0.9); ring(V.heroPos.x, V.heroPos.z, '#ffd36a', 0.5, 5, 0.7); ui.banner('LEVEL ' + e.lvl + '!', e.lvl & 1 ? 'STRONGER!' : '+1 TALENT POINT', 1.8); break;
      case 'puff': burst(ax(e.x), 1.2, az(e.y), e.c || '#d8d0c0', 10, 4, 0.9, false, 0.5); break;
      case 'blink': burst(ax(e.x), 1.8, az(e.y), e.c || '#9ad8ff', e.big ? 24 : 14, 6, e.big ? 1.2 : 0.8, true, 0.5); break;
      case 'blinkto': burst(ax(e.x), 1.8, az(e.y), '#9ad8ff', 14, 5, 0.8, true, 0.5); V.heroPos.set(ax(G.px), 0, az(G.py)); break;
      case 'nova': ring(ax(e.x), az(e.y), '#9fe6ff', 0.5, e.r * PX * 1.3, 0.6); burst(ax(e.x), 1, az(e.y), '#cfeeff', 24, 9, 0.8, true, 0.6, 2); break;
      case 'meteor': ring(ax(e.x), az(e.y), '#ff8a2a', 0.5, 6, 0.5); burst(ax(e.x), 1.4, az(e.y), '#ff8a2a', 26, 10, 1.2, true, 0.6); shake.t = 0.2; shake.amp = 0.8; break;
      case 'explode': ring(ax(e.x), az(e.y), '#ff8a2a', 0.5, 5, 0.45); burst(ax(e.x), 1.4, az(e.y), '#ffb84a', 22, 9, 1.1, true, 0.5); shake.t = 0.15; shake.amp = 0.6; break;
      case 'slam': { const x = wx(e.x + 16), z = wz(e.y + 24); ring(x, z, '#ffd8a8', 1, e.big ? 9 : 7, 0.6); burst(x, 0.5, z, '#b8a890', 20, 8, 1.3, false, 0.6, 3); shake.t = 0.25; shake.amp = e.big ? 1.2 : 0.9; break; }
      case 'ring': break;
      case 'lightning': lightning(ax(e.x - 8), az(e.y - 12)); ui.flash('#cfe6ff', 0.5); shake.t = 0.2; shake.amp = 0.7; burst(ax(e.x - 8), 0.5, az(e.y - 12), '#cfe6ff', 20, 9, 0.8, true, 0.4); break;
      case 'flash': ui.flash(e.c || '#ffffff', 0.7); break;
      case 'drop': { const it = itemModel(e.s); if (it) { it.pop = 0.5; if (G.i_rar[e.s] >= 3 && G.i_kind[e.s] <= 7) ring(it.g.position.x, it.g.position.z, D.RAR_COLOR[G.i_rar[e.s]], 0.5, 3, 0.6); } break; }
      case 'pickup': { const it = V.items[e.s]; if (it) { burst(it.g.position.x, 1.2, it.g.position.z, e.kind === D.K_GOLD ? '#ffd36a' : (e.kind === D.K_POTION ? '#ff4a5a' : D.RAR_COLOR[e.rar || 0]), 12, 5, 0.6, true, 0.4); scene.remove(it.g); V.items[e.s] = null; }
        if (e.kind <= D.K_TRINKET) ui.lootCard(e); break; }
      case 'door': for (const d of Object.values(R.doors)) d.opening = 1; break;
      case 'tamed': burst(ax(e.x), 1.2, az(e.y), '#ffd36a', 24, 6, 0.9, true, 0.8); ring(ax(e.x), az(e.y), '#ffd36a', 0.5, 4, 0.6); break;
      case 'tamehit': ring(V.heroPos.x, V.heroPos.z, '#ffd36a', 1, 3, 0.3); break;
      case 'shop': ui.openShop(); break;
      case 'dead': ui.dead(); break;
      case 'win': ui.win(); break;
      case 'rescue': ui.banner('THE TOWER KING HAS FALLEN!', 'YOU FOUND HER!', 3); break;
      case 'kingflee': ui.banner('', 'THE KING FLEES TO HIS POTIONS!', 2); break;
      case 'kingchange': ring(wx(G.bx + 16), wz(G.by + 24), '#c9a2ff', 1, 8, 1.2); break;
      case 'kingtf': burst(wx(G.bx + 16), 3, wz(G.by + 20), '#c9a2ff', 40, 10, 1.4, true, 1); ui.flash('#ffffff', 0.9); break;
      case 'kingphase': ui.banner('TOWER KING', D.KING_SAYS[e.ph], 2); break;
      case 'bossdie': burst(wx(e.x + 16), 3, wz(e.y + 24), '#ffd36a', 50, 12, 1.4, true, 1.1); ring(wx(e.x + 16), wz(e.y + 24), '#ffd36a', 1, 10, 0.9); shake.t = 0.5; shake.amp = 1.3; ui.flash('#fff4d0', 0.6); break;
      case 'boss': ui.bossIntro(); break;
      case 'crack': burst(wx(e.x + 8), 2, wz(e.y + 8), '#b8a890', 24, 8, 1.2, false, 0.7, 4); shake.t = 0.2; shake.amp = 0.6; break;
      case 'obj': { const o = R.objs[e.k]; if (o) { o.t = G.ob_t[e.k]; o.changed = 1; } break; }
      case 'mimic': burst(wx(e.x + 8), 1.5, wz(e.y + 8), '#7a4a26', 20, 7, 1, false, 0.6); shake.t = 0.2; shake.amp = 0.7; break;
      case 'bless': ring(V.heroPos.x, V.heroPos.z, '#ffd36a', 0.5, 4, 0.8); burst(V.heroPos.x, 2, V.heroPos.z, '#ffd36a', 30, 5, 0.8, true, 1, -2); break;
      case 'drink': burst(V.heroPos.x, 2.5, V.heroPos.z, '#ff5a6a', 16, 3, 0.7, true, 0.8, -3); if (e.v) ui.num(V.heroPos.x, 4.4, V.heroPos.z, '+' + e.v, 'heal'); break;
      case 'heal': { const m = V.mons[e.n]; if (m) burst(m.root.position.x, 1.5, m.root.position.z, '#ff3a4a', 4, 2, 0.5, true, 0.5, -3); break; }
      case 'rise': { const m = monModel(e.n); if (m) { m.spawnT = 0.6; burst(m.root.position.x, 1, m.root.position.z, '#e6dccb', 16, 5, 0.9, false, 0.6); } break; }
      case 'bonesmash': burst(ax(e.x), 0.6, az(e.y), '#e6dccb', 14, 6, 0.6, false, 0.5); break;
      case 'elite': break;
      case 'split': burst(ax(e.x), 1.2, az(e.y), '#7dff86', 16, 6, 0.9, true, 0.5); break;
      case 'deflect': burst(ax(e.x - 4), 1.6, az(e.y - 8), '#ffffff', 6, 5, 0.5, true, 0.3); break;
      case 'shothero': case 'shotwall': burst(wx(e.x + 4), 1.4, wz(e.y + 4), SHOT_COL[e.s] || '#ff7a2a', 6, 4, 0.6, true, 0.3); break;
      case 'bolthit': case 'boltwall': burst(wx(e.x + 4), 1.6, wz(e.y + 4), G.player_class === 2 ? '#e8d8b0' : boltColor(), 6, 4, 0.6, true, 0.3); break;
      case 'crystal': burst(wx(e.x + 4), 1.6, wz(e.y + 4), '#c8a0ff', 8, 5, 0.6, true, 0.3); break;
      case 'wave': ui.banner('WAVE ' + (3 - G.arena_left) + ' OF 3', 'THE ARENA', 1.4); break;
      case 'summon': { const m = monModel(e.n); if (m) { m.spawnT = 0.5; burst(m.root.position.x, 1, m.root.position.z, '#9a5cff', 14, 5, 0.9, true, 0.5); } break; }
      case 'roll': burst(V.heroPos.x, 0.4, V.heroPos.z, '#c8b8a0', 6, 3, 0.7, false, 0.4, 1); break;
      case 'stomp': { const m = V.mons.find((m, i) => m && i === e.n); if (m) ring(m.root.position.x, m.root.position.z, '#a07cff', 0.5, 4, 0.4); break; }
      case 'launch': { const o = R.objs[e.k]; if (o) burst(o.g.position.x, 2.6, o.g.position.z + 2, '#ff8a4a', 4, 3, 0.4, true, 0.3); break; }
      case 'pethurt': if (V.pet) ui.num(V.pet.root.position.x, 3, V.pet.root.position.z, '-' + e.d, 'hurt'); break;
      case 'floor': break;
    }
  }
}
const dying = [];

// ---------------------------------------------------------------- each frame
const smooth = (cur, want, dt, k = 30) => cur + (want - cur) * Math.min(1, dt * k);
function faceTo(obj, ang, dt, k = 14) { let d = ang - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * Math.min(1, dt * k); }
const DIR_ANG = [0, Math.PI, Math.PI / 2, -Math.PI / 2]; // down, up, right, left
export function update(dt, input) {
  V.t += dt;
  const t = V.t;
  if (!V.hero) return;
  // the hero
  const hx = ax(G.px), hz = az(G.py);
  if (Math.hypot(hx - V.heroPos.x, hz - V.heroPos.z) > 6) V.heroPos.set(hx, 0, hz);
  V.heroPos.x = smooth(V.heroPos.x, hx, dt); V.heroPos.z = smooth(V.heroPos.z, hz, dt);
  V.hero.position.copy(V.heroPos);
  const moving = G.moving ? 1 : 0;
  V.walk += moving * dt * 11;
  // facing: where the stick points while walking, the attack direction while attacking
  let ang = DIR_ANG[G.pdir];
  if (!G.atk_timer && !G.anim_t && input && (input.dx || input.dy)) ang = Math.atan2(input.dx, input.dy);
  faceTo(V.hero, ang, dt, 16);
  const swing = G.player_class === 0 && G.atk_timer > 0 ? 1 - (G.atk_timer - 1) / 13 : -1;
  const cast = G.anim_t > 0 ? 1 - G.anim_t / ANIM_LEN : -1;
  animHero(V.hero, t, { walk: V.walk, move: moving, swing, whirl: TAL.WHIRL > 0, cast, roll: G.roll_timer > 0 ? G.roll_timer / 16 : 0, orbColor: G.player_class === 1 ? boltColor() : null });
  V.hero.visible = !(G.inv_timer > 0 && (Math.floor(t * 18) & 1) && !G.roll_timer) || G.state !== 'play';
  heroShadow.position.set(V.heroPos.x, 0.04, V.heroPos.z);
  heroLight.position.set(V.heroPos.x, 5, V.heroPos.z + 1);
  // the slash trail
  if (swing >= 0.25 && swing <= 0.9) {
    trail.position.set(V.heroPos.x, 1.9, V.heroPos.z);
    trail.rotation.z = (TAL.WHIRL ? V.hero.rotation.y + swing * TAU : DIR_ANG[G.pdir]) - Math.PI / 2;
    trail.material.opacity = 0.75 * (1 - (swing - 0.25) / 0.65);
    trail.scale.setScalar(TAL.WHIRL ? 1.1 : 1);
  } else trail.material.opacity = 0;

  // monsters
  for (let n = 0; n < D.MAXM; n++) {
    const m = monModel(n);
    if (!m) continue;
    const tx = ax(G.m_x[n]), tz = az(G.m_y[n]);
    if (Math.hypot(tx - m.root.position.x, tz - m.root.position.z) > 8) m.root.position.set(tx, 0, tz);
    m.root.position.x = smooth(m.root.position.x, tx, dt, 20); m.root.position.z = smooth(m.root.position.z, tz, dt, 20);
    const mv = G.m_x[n] !== m.lastX || G.m_y[n] !== m.lastY;
    m.lastX = G.m_x[n]; m.lastY = G.m_y[n];
    m.movingT = mv ? 0.15 : Math.max(0, (m.movingT || 0) - dt);
    faceTo(m.root, Math.atan2(V.heroPos.x - m.root.position.x, V.heroPos.z - m.root.position.z), dt, 6);
    const fuse = G.m_type[n] === D.M_FIRESPRITE && G.m_dir[n] > 0;
    m.root.userData.anim(t, { moving: m.movingT > 0, seed: m.seed, timer: G.m_timer[n], attack: G.m_type[n] === D.M_WIZARD ? (G.m_timer[n] % 100) > 35 && (G.m_timer[n] % 100) < 55 : false, fuse });
    const fl = G.m_flash[n];
    m.root.userData.flash(fl > 0 && (fl & 2) ? 1 : (G.m_slow[n] ? 0.3 : 0), fl > 0 ? '#ffffff' : '#3a8aff');
    // ghosts fade (can't hurt or be hurt)
    if (G.m_type[n] === D.M_GHOST) m.root.userData.fade(faded(n) ? 0.18 : 1);
    m.ice.visible = G.m_frz[n] > 0;
    m.fire.visible = G.m_burn[n] > 0;
    if (m.fire.visible) m.fire.children.forEach((f, i) => { const a = i / 4 * TAU + t * 4; f.position.set(Math.cos(a) * 0.7, 1 + ((t * 2 + i * 0.25) % 1) * 1.5, Math.sin(a) * 0.7); });
    // elite: a colored aura of sparkles going round it, and a bigger body
    if (G.m_elite[n] && !m.auraBuilt) {
      m.auraBuilt = 1;
      const col = D.ELITE_COLOR[G.m_elite[n]];
      for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.spark, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(0.7); m.aura.add(s); }
      const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ map: TEX.soft, color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.07; m.aura.add(glow);
      m.root.userData.inner.scale.multiplyScalar(1.2);
      const tag = textSprite(D.ELITE_NAME[G.m_elite[n]], col, 52); tag.position.y = 4.4; tag.scale.set(3.2, 0.8, 1); m.aura.add(tag);
    }
    if (m.auraBuilt) m.aura.children.forEach((s, i) => { if (i < 6) { const a = i / 6 * TAU + t * 2.5; s.position.set(Math.cos(a) * 1.6, 1.2 + Math.sin(t * 3 + i) * 0.5, Math.sin(a) * 1.6); } });
    if (m.spawnT > 0) { m.spawnT -= dt; m.root.scale.setScalar(Math.max(0.05, 1 - m.spawnT / 0.6)); } else m.root.scale.setScalar(1);
  }
  for (let i = dying.length - 1; i >= 0; i--) {
    const m = dying[i]; m.dying -= dt;
    const k = Math.max(0, m.dying / 0.3);
    m.root.scale.set(1 + (1 - k) * 0.5, Math.max(0.01, k), 1 + (1 - k) * 0.5);
    if (m.dying <= 0) { scene.remove(m.root); dying.splice(i, 1); }
  }
  // the taming ring
  if (G.tame_n) {
    const m = V.mons[G.tame_n - 1];
    if (m) {
      tameRing.visible = true;
      tameRing.position.set(m.root.position.x, 3.2, m.root.position.z);
      tameRing.quaternion.copy(camera.quaternion);
      const zone = tame_zone() / 128 * TAU; // the gold arc at the top
      const z = tameRing.userData.zone;
      z.geometry.dispose(); z.geometry = new THREE.TorusGeometry(2.2, 0.22, 8, 32, zone * 2);
      z.rotation.z = Math.PI / 2 - zone;
      const a = Math.PI / 2 - G.tame_pos / 128 * TAU;
      tameRing.userData.dot.position.set(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.1);
    }
  } else tameRing.visible = false;

  // items
  for (let i = 0; i < D.MAXI; i++) {
    const it = itemModel(i);
    if (!it) continue;
    it.g.userData.anim(t, it.seed);
    if (it.pop > 0) { it.pop -= dt; const k = 1 - it.pop / 0.5; it.g.userData.model.position.y = 1 + Math.sin(k * Math.PI) * 2.5; }
  }
  // shots
  for (let i = 0; i < D.MAXP; i++) {
    const s = shots[i];
    if (!G.pr_t[i]) { s.g.visible = false; s.src = -1; continue; }
    const x = wx(G.pr_x[i] + 4), z = wz(G.pr_y[i] + 6);
    if (!s.g.visible) { s.g.position.set(x, 1.6, z); }
    s.g.visible = true;
    s.g.position.x = smooth(s.g.position.x, x, dt, 40); s.g.position.z = smooth(s.g.position.z, z, dt, 40);
    const src = G.pr_src[i];
    if (s.src !== src) {
      s.src = src;
      const col = src === 5 ? (G.boss_art === 2 ? '#ff7a2a' : G.boss_art === 3 || G.boss_art === 5 ? '#9a5cff' : G.boss_art === 4 ? '#7a3cd0' : '#ff4a3a') : SHOT_COL[src];
      s.glow.material.color.set(col); s.core.material.color.set(new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.6));
      s.arrow.visible = src === 2; s.core.visible = src !== 2; s.glow.visible = src !== 2;
    }
    if (src === 2) s.arrow.rotation.z = -Math.atan2(G.pr_dx[i], G.pr_dy[i]) + Math.PI;
    s.glow.scale.setScalar(2.2 + Math.sin(t * 20 + i) * 0.3);
    s.trailT += dt;
    if (src !== 2 && s.trailT > 0.05) { s.trailT = 0; burst(s.g.position.x, 1.6, s.g.position.z, s.glow.material.color.getStyle(), 1, 0.5, 0.5, true, 0.25, 0); }
  }
  // bolts / arrows
  const hunter = G.player_class === 2, bc = boltColor();
  for (let b = 0; b < D.MAXB; b++) {
    const s = bolts[b];
    if (!G.bo_t[b]) { s.g.visible = false; continue; }
    const x = wx(G.bo_x[b] + 4), z = wz(G.bo_y[b] + 6);
    if (!s.g.visible) s.g.position.set(x, 1.9, z);
    s.g.visible = true;
    s.g.position.x = smooth(s.g.position.x, x, dt, 40); s.g.position.z = smooth(s.g.position.z, z, dt, 40);
    s.arrow.visible = hunter; s.core.visible = !hunter; s.glow.visible = !hunter; s.light.visible = !hunter && camView.quality >= 2;
    if (hunter) s.arrow.rotation.z = -DIR_ANG[G.bo_dir[b]] + Math.PI;
    else {
      const big = G.bo_big[b];
      const col = big ? '#ff8a2a' : bc;
      s.glow.material.color.set(col); s.light.color.set(col);
      const sz = big ? 1.8 : 1 + Math.min(TAL.MIGHT, 5) * 0.12;
      s.core.scale.setScalar(sz); s.glow.scale.setScalar(2.2 * sz);
      if (Math.random() < 0.6) burst(s.g.position.x, 1.9, s.g.position.z, col, 1, 0.6, 0.55 * sz, true, 0.3, 0);
    }
  }
  // the boss
  updateBoss(dt, t);
  // the pet
  if (G.pet_type && !G.pet_down && G.state === 'play') {
    if (!V.pet || V.petType !== G.pet_type) {
      if (V.pet) scene.remove(V.pet.root);
      const root = buildMonster(G.pet_type, 1);
      root.scale.setScalar(0.75);
      const collar = mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 16), std({ color: '#ffc93c', metalness: 1, roughness: 0.3 })); collar.rotation.x = Math.PI / 2; collar.position.y = G.pet_type === D.M_BAT ? 1.6 : 1.1; root.add(collar);
      root.position.set(ax(G.pet_x), 0, az(G.pet_y));
      scene.add(root);
      V.pet = { root, seed: 3, lx: G.pet_x, ly: G.pet_y }; V.petType = G.pet_type;
    }
    const p = V.pet, x = ax(G.pet_x), z = az(G.pet_y);
    if (Math.hypot(x - p.root.position.x, z - p.root.position.z) > 8) p.root.position.set(x, 0, z);
    p.root.position.x = smooth(p.root.position.x, x, dt, 20); p.root.position.z = smooth(p.root.position.z, z, dt, 20);
    const mv = p.lx !== G.pet_x || p.ly !== G.pet_y; p.lx = G.pet_x; p.ly = G.pet_y;
    p.mt = mv ? 0.15 : Math.max(0, (p.mt || 0) - dt);
    if (mv) faceTo(p.root, Math.atan2(x - p.root.position.x + (G.pet_face ? -0.01 : 0.01), z - p.root.position.z), dt, 8);
    p.root.userData.anim(t, { moving: p.mt > 0, seed: 3, timer: 0 });
    p.root.visible = !(G.pet_inv > 0 && (Math.floor(t * 18) & 1));
  } else if (V.pet) { scene.remove(V.pet.root); V.pet = null; V.petType = 0; }
  // the merchant
  if (G.vend_state) {
    if (!V.merchant) { V.merchant = buildMerchant(); scene.add(V.merchant); V.merchant.position.set(ax(G.vx), 0, az(G.vy)); }
    const x = ax(G.vx), z = az(G.vy);
    V.merchant.position.x = smooth(V.merchant.position.x, x, dt, 20); V.merchant.position.z = smooth(V.merchant.position.z, z, dt, 20);
    V.merchant.visible = G.vend_state >= 2;
    faceTo(V.merchant, Math.atan2(V.heroPos.x - V.merchant.position.x, V.heroPos.z - V.merchant.position.z), dt, 5);
    V.merchant.userData.anim(t, { moving: G.vend_state === 2 });
  } else if (V.merchant) { scene.remove(V.merchant); V.merchant = null; }
  // the rescue
  if (G.state === 'rescue' || G.state === 'win') {
    if (!V.wife) { V.wife = buildWife(); scene.add(V.wife); V.wife.position.set(ax(G.wx), 0, az(G.wy)); }
    const x = ax(G.wx), z = az(G.wy);
    V.wife.position.x = smooth(V.wife.position.x, x, dt, 20); V.wife.position.z = smooth(V.wife.position.z, z, dt, 20);
    faceTo(V.wife, Math.atan2(V.heroPos.x - V.wife.position.x, V.heroPos.z - V.wife.position.z), dt, 5);
    V.wife.userData.anim(t, { moving: !!G.wmoving, happy: !G.wmoving && G.rescue_t > 10 });
    if (!G.wmoving && G.rescue_t > 10 && Math.random() < 0.15) burst((V.wife.position.x + V.heroPos.x) / 2, 5, V.wife.position.z, '#ff7a9a', 1, 1, 0.8, true, 1.2, -1);
  }
  // the room: torches flicker, doors open, spikes rise, lava flows, objects
  for (const tc of R.torches) {
    const f = Math.sin(t * 13 + tc.ph) * 0.5 + Math.sin(t * 7.3 + tc.ph * 2) * 0.35 + Math.sin(t * 23 + tc.ph) * 0.15;
    tc.light.intensity = 50 + f * 9; tc.fl.scale.set(1.5 + f * 0.12, 2.1 + f * 0.25, 1); tc.halo.material.opacity = 0.18 + f * 0.03;
  }
  for (const d of Object.values(R.doors)) {
    const c = d.cell, tt = G.map[c];
    const open = tt === D.T_DOORWAY || tt === D.T_STAIRS;
    d.open = smooth(d.open, open ? 1 : 0, dt, 4);
    for (const { leaf, s } of d.leaves) leaf.rotation.y = s * d.open * 1.7;
    d.glow.material.opacity = d.open * (0.4 + Math.sin(t * 3) * 0.1);
    d.stairs.visible = tt === D.T_STAIRS;
    if (d.lamp) d.lamp.rotation.y = Math.sin(t * 2) * 0.2;
  }
  for (const sp of R.spikes) sp.position.y = smooth(sp.position.y, G.hz_frame ? 0 : -1.0, dt, 18);
  for (const m of R.lava) { m.map.offset.x = t * 0.04; m.map.offset.y = t * 0.02; }
  for (const f of R.anim) f(t);
  for (const o of R.objs) {
    if (!o) continue;
    const ot = G.ob_t[o.k];
    if (o.t === D.OBJ_CHEST || o.t === D.OBJ_CHEST_OPEN || ot === D.OBJ_CHEST_OPEN) {
      if (ot === D.OBJ_CHEST_OPEN && o.parts.lidG) { o.parts.lidG.rotation.x = smooth(o.parts.lidG.rotation.x, -1.9, dt, 6); o.parts.shine.material.opacity = 0.1; }
      if (ot === D.OBJ_GONE) o.g.visible = false;
      else if (o.parts.shine) o.parts.shine.material.opacity = ot === D.OBJ_CHEST ? 0.3 + Math.sin(t * 3) * 0.1 : 0.05;
    } else if (o.parts.orb) {
      const used = ot === D.OBJ_SHRINE_USED;
      o.parts.orb.material.emissiveIntensity = used ? 0.1 : 1.6 + Math.sin(t * 3) * 0.4; o.parts.l.intensity = used ? 0 : 18;
      o.parts.orb.position.y = 3.2 + Math.sin(t * 2) * 0.15;
    } else if (o.parts.water) {
      const dry = ot === D.OBJ_FOUNTAIN_DRY;
      o.parts.water.visible = !dry; o.parts.l.intensity = dry ? 0 : 10;
    } else if (o.parts.crackM) {
      if (ot === D.OBJ_GONE) o.g.visible = false;
      o.parts.crackM.opacity = 0.5 + Math.sin(t * 4) * 0.35;
    } else if (o.parts.eye) {
      o.parts.eye.visible = G.mon_left > 0 && Math.sin(t * 6 + o.k) > 0;
    }
  }
  // bones
  for (let k = 0; k < D.MAXBN; k++) {
    const g = bonePiles[k];
    g.visible = G.bn_t[k] > 0;
    if (g.visible) { g.position.set(ax(G.bn_x[k]), 0, az(G.bn_y[k])); g.rotation.z = G.bn_t[k] < 40 ? Math.sin(t * 40) * 0.08 : 0; }
  }
  // the storm's mark
  if (G.hz === D.HZ_STORM && G.st_phase === 1) {
    stormMark.position.set(ax(G.st_x - 8), 0.08, az(G.st_y - 12));
    stormMark.material.opacity = 0.35 + Math.sin(t * (G.st_t > 24 ? 10 : 30)) * 0.3;
    stormMark.scale.setScalar(1 + G.st_t / 70);
  } else stormMark.material.opacity = 0;
  // particles, rings, lightning
  stepParts(dt); stepRings(dt); stepLightning(dt);
  if (shake.t > 0) shake.t -= dt;
  placeCamera(V.heroPos.x, V.heroPos.z, false);
}

function updateBoss(dt, t) {
  const on = G.boss_on && G.state === 'play';
  const king = on && G.floor_num === D.LAST_FLOOR;
  // the Tower King's sorcerer form (and his run, potion and change)
  const wizForm = king && G.bform !== D.BF_BRUTE;
  if (wizForm) {
    if (!V.king) { V.king = buildKingWizard(); makeFlashable(V.king); scene.add(V.king); V.king.position.set(wx(G.bx + 16), 0, wz(G.by + 24)); }
    V.king.visible = true;
    const x = wx(G.bx + 16), z = wz(G.by + 24);
    V.king.position.x = smooth(V.king.position.x, x, dt, 20); V.king.position.z = smooth(V.king.position.z, z, dt, 20);
    faceTo(V.king, G.bform === D.BF_DRINK || G.bform === D.BF_TF ? 0 : Math.atan2(V.heroPos.x - x, V.heroPos.z - z), dt, 6);
    V.king.userData.anim(t, { cast: G.bstate === D.BS_WIND || G.bstate === D.BS_CAST, drink: G.bform === D.BF_DRINK, run: G.bform === D.BF_RUN });
    V.king.userData.flash(G.bflash & 2 ? 1 : 0);
    // the change: he swells and glows, then the brute takes his place
    if (G.bform === D.BF_TF) {
      const k = Math.min(1, G.btimer / 60);
      V.king.scale.setScalar(1.45 * (1 + k * 1.2));
      V.king.userData.flash(0.3 + k * 0.7, '#c9a2ff');
      if (Math.random() < 0.5) burst(x, 2 + Math.random() * 4, z, '#c9a2ff', 2, 4, 1, true, 0.6, -2);
    } else V.king.scale.setScalar(1.45);
  } else if (V.king) { V.king.visible = false; if (!king) { scene.remove(V.king); V.king = null; } }
  if (!on || wizForm) { if (V.boss) { V.boss.visible = false; if (!on) { scene.remove(V.boss); V.boss = null; V.bossArt = -1; } } ward.material.opacity = 0; return; }
  if (!V.boss || V.bossArt !== G.boss_art) {
    if (V.boss) scene.remove(V.boss);
    V.boss = buildBoss(G.boss_art); V.bossArt = G.boss_art; scene.add(V.boss);
    V.boss.position.set(wx(G.bx + 16), 0, wz(G.by + 24));
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; V.boss.add(sh); V.boss.userData.sh = sh;
    if (king) V.boss.userData.spawnT = 0.6;
  }
  const b = V.boss; b.visible = true;
  const x = wx(G.bx + 16), z = wz(G.by + 24);
  b.position.x = smooth(b.position.x, x, dt, 22); b.position.z = smooth(b.position.z, z, dt, 22);
  const leap = G.bstate === D.BS_LEAP;
  const leapY = leap ? Math.sin(Math.min(1, G.btimer / 40) * Math.PI) * 9 : 0;
  b.position.y = leapY;
  if (b.userData.sh) { b.userData.sh.position.y = 0.05 - leapY; b.userData.sh.scale.setScalar(1 - leapY / 18); }
  const dx = V.heroPos.x - x, dz = V.heroPos.z - z;
  if (G.bstate !== D.BS_CHARGE) faceTo(b, Math.atan2(dx, dz), dt, 5); else faceTo(b, Math.atan2(G.bdx, G.bdy), dt, 10);
  const moving = G.bstate === D.BS_WALK || G.bstate === D.BS_CHARGE;
  b.userData.anim(t, { moving, wind: G.bstate === D.BS_WIND, stun: G.bstate === D.BS_STUN, slam: G.bstate === D.BS_CAST, leap, leapY: 0 });
  b.userData.flash(G.bflash & 2 ? 1 : (G.bstate === D.BS_WIND ? 0.35 + Math.sin(t * 30) * 0.2 : 0), G.bflash ? '#ffffff' : '#ff4a2a');
  if (G.bstate === D.BS_STUN && Math.random() < 0.2) burst(x + (Math.random() - 0.5) * 2, 7, z, '#ffe080', 1, 1, 0.6, true, 0.6, 0);
  if (G.bstate === D.BS_CHARGE && Math.random() < 0.6) burst(x, 0.5, z, '#b8a890', 1, 3, 1, false, 0.4, 1);
  // the warden's ward
  ward.position.set(x, 3, z);
  ward.material.opacity = smooth(ward.material.opacity, G.bward ? 0.18 + Math.sin(t * 6) * 0.05 : 0, dt, 8);
  if (b.userData.spawnT > 0) { b.userData.spawnT -= dt; b.scale.setScalar(1 - b.userData.spawnT / 0.6 * 0.5); } else b.scale.setScalar(1);
}
