// ============================================================================
//  DUNGEON HEART  -  models: every character, monster, boss and item, built
//  from primitives in code (Pest Panic's way: no image or model files).
//  Each returns a THREE.Group with userData.anim(t, s) for its motion.
// ============================================================================
import { THREE, std, mesh, sph, TEX, TAU, V3 } from './engine.js';
import { buildWeapon } from './weapons.js';
import { buildArmor, buildHelmet, heroArmor, heroHelm } from './armor.js';
import * as D from './data.js';

const M = {}; // shared materials
const mat = (k, o) => M[k] || (M[k] = std(o));
const phys = (k, o) => M[k] || (M[k] = new THREE.MeshPhysicalMaterial(o));
const basic = (k, o) => M[k] || (M[k] = new THREE.MeshBasicMaterial(o));
const cap = (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 4, s);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
function seg(a, b, r0, r1, m, sides = 7) {
  const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()));
  g.translate(A.x, A.y, A.z);
  return mesh(g, m);
}
function eyes(parent, x, y, z, r, color = '#111', white = true, glow = null) {
  for (const s of [-1, 1]) {
    if (white) { const e = mesh(sph(r, 12, 10), mat('eyeW', { color: '#ffffff', roughness: 0.2 }), false); e.position.set(x * s, y, z); e.scale.z = 0.6; parent.add(e); }
    const p = glow ? new THREE.Mesh(sph(r * (white ? 0.55 : 1), 10, 8), basic('glow' + glow, { color: glow })) : mesh(sph(r * 0.55, 10, 8), mat('pupil', { color, roughness: 0.15 }), false);
    p.position.set(x * s, y, z + r * (white ? 0.45 : 0)); parent.add(p);
  }
}
function finish(root, scale = 1) {
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  root.scale.setScalar(scale);
  return root;
}
// a flash / tint layer: every material of a model is cloned so a hit can flash it white
export function makeFlashable(root) {
  const mats = [];
  root.traverse(o => {
    if (!o.isMesh || !o.material || o.material.isMeshBasicMaterial || o.userData.noFlash) return;
    o.material = o.material.clone();
    o.material.userData.e0 = o.material.emissive ? o.material.emissive.clone() : null;
    o.material.userData.ei0 = o.material.emissiveIntensity ?? 0;
    mats.push(o.material);
  });
  root.userData.mats = mats;
  root.userData.flash = (k, col = '#ffffff') => {
    for (const m of mats) {
      if (!m.emissive) continue;
      if (k > 0) { m.emissive.set(col); m.emissiveIntensity = 0.9 * k; }
      else { m.emissive.copy(m.userData.e0); m.emissiveIntensity = m.userData.ei0; }
    }
  };
  root.userData.fade = a => { for (const m of mats) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a > 0.6; } };
  return root;
}

// ---------------------------------------------------------------- heroes
function heroBase(o) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.17 * s, 0.72, 0);
    const l = mesh(cap(0.14, 0.42, 10), o.legMat); l.position.y = -0.33; leg.add(l);
    const boot = mesh(box(0.24, 0.18, 0.38), o.bootMat); boot.position.set(0, -0.68, 0.06); leg.add(boot);
    body.add(leg); legs.push(leg);
  }
  const torso = mesh(cap(0.32, 0.38, 14), o.torsoMat); torso.position.y = 1.08; body.add(torso);
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.42 * s, 1.3, 0);
    const a = mesh(cap(0.1, 0.36, 10), o.armMat); a.position.y = -0.27; arm.add(a);
    const hand = mesh(sph(0.11, 10, 8), o.handMat); hand.position.y = -0.55; arm.add(hand);
    body.add(arm); arms.push(arm);
  }
  const head = new THREE.Group(); head.position.y = 1.74; body.add(head);
  head.add(mesh(sph(0.26, 18, 14), mat('skin', { color: '#eab48a', roughness: 0.6 })));
  root.userData = { body, legs, arms, head };
  return root;
}
export function buildWarrior() {
  const steel = mat('steel', { color: '#a3acb7', metalness: 0.8, roughness: 0.46, envMapIntensity: 0.6 });
  const steelD = mat('steelD', { color: '#5e6672', metalness: 0.8, roughness: 0.42, envMapIntensity: 0.6 });
  const red = mat('wred', { color: '#b5232b', roughness: 0.55 });
  const leather = mat('leather', { color: '#5a3a22', roughness: 0.7 });
  const gold = mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25, envMapIntensity: 1.3 });
  const black = mat('black', { color: '#1b1a1d', roughness: 0.4 });
  const root = heroBase({ legMat: steelD, bootMat: leather, torsoMat: steel, armMat: steelD, handMat: leather });
  const { body, arms, head } = root.userData;
  const tabard = mesh(box(0.42, 0.62, 0.06), red); tabard.position.set(0, 0.98, 0.31); body.add(tabard);
  const crest = mesh(new THREE.CircleGeometry(0.09, 4), gold, false); crest.position.set(0, 1.1, 0.345); body.add(crest);
  const belt = mesh(cyl(0.345, 0.345, 0.09, 18), leather); belt.position.y = 0.84; body.add(belt);
  const capeGeo = new THREE.PlaneGeometry(0.7, 1.0, 6, 8); capeGeo.translate(0, -0.5, 0);
  { const pa = capeGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setX(i, x * (1 - y * 0.35)); pa.setZ(i, -x * x * 0.9 + y * 0.05); } capeGeo.computeVertexNormals(); }
  const cape = mesh(capeGeo, mat('cape', { color: '#a11d26', roughness: 0.7, side: THREE.DoubleSide })); cape.position.set(0, 1.42, -0.33); body.add(cape);
  for (const s of [-1, 1]) { const pad = mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, TAU, 0, Math.PI / 2), steel); pad.position.set(0.42 * s, 1.35, 0); body.add(pad); }
  const sword = new THREE.Group(); sword.position.set(0, -0.56, 0.05); arms[1].add(sword);
  const grip = mesh(cyl(0.045, 0.045, 0.28, 8), leather); grip.rotation.x = Math.PI / 2; sword.add(grip);
  const pommel = mesh(sph(0.07, 10, 8), gold); pommel.position.z = -0.17; sword.add(pommel);
  const guard = mesh(box(0.42, 0.07, 0.08), gold); guard.position.z = 0.16; sword.add(guard);
  const bladeMat = std({ color: '#d4dce6', metalness: 1, roughness: 0.18, envMapIntensity: 0.9, emissive: '#000000' });
  const blade = mesh(box(0.11, 0.035, 1.15), bladeMat); blade.position.z = 0.76; sword.add(blade);
  const tip = mesh(new THREE.ConeGeometry(0.078, 0.2, 4), bladeMat); tip.rotation.x = Math.PI / 2; tip.rotation.y = Math.PI / 4; tip.scale.set(1, 1, 0.32); tip.position.z = 1.43; sword.add(tip);
  blade.userData.noFlash = true; tip.userData.noFlash = true;
  const shield = new THREE.Group(); shield.position.set(-0.12, -0.32, 0.12); shield.rotation.y = -Math.PI / 2.2; arms[0].add(shield);
  const face = mesh(cyl(0.42, 0.42, 0.08, 22), red); face.rotation.x = Math.PI / 2; shield.add(face);
  const rim = mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 26), steel); shield.add(rim);
  const boss = mesh(sph(0.11, 12, 8), gold); boss.position.z = 0.06; boss.scale.z = 0.6; shield.add(boss);
  for (const s of [-1, 1]) { const e = mesh(sph(0.04, 8, 6), black, false); e.position.set(0.09 * s, 0.02, 0.24); head.add(e); }
  const helm = mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, TAU, 0, Math.PI / 1.85), steel); helm.position.y = 0.02; head.add(helm);
  const nose = mesh(box(0.06, 0.24, 0.06), steel); nose.position.set(0, -0.02, 0.29); head.add(nose);
  for (const s of [-1, 1]) { const ch = mesh(box(0.06, 0.26, 0.22), steel); ch.position.set(0.27 * s, -0.08, 0.06); head.add(ch); }
  const plume = new THREE.Group(); plume.position.y = 0.3; head.add(plume);
  for (let i = 0; i < 5; i++) { const p = mesh(cap(0.06, 0.22, 8), red); p.position.set(0, 0.08 + Math.sin(i / 4 * Math.PI) * 0.06, 0.12 - i * 0.09); p.rotation.x = -0.9 - i * 0.18; plume.add(p); }
  Object.assign(root.userData, { cape, sword, bladeMat, shield, weapon: 'sword' });
  return finish(root, 2.15);
}
export function buildMage() {
  const robe = mat('robe', { color: '#3a3ab0', roughness: 0.7 }), robeD = mat('robeD', { color: '#24247a', roughness: 0.75 });
  const trim = mat('trimg', { color: '#f0c040', metalness: 0.8, roughness: 0.3 });
  const wood = mat('staffw', { color: '#6a4426', roughness: 0.7 });
  const root = heroBase({ legMat: robeD, bootMat: mat('mboot', { color: '#3a2a1a', roughness: 0.7 }), torsoMat: robe, armMat: robe, handMat: mat('skin', { color: '#eab48a', roughness: 0.6 }) });
  const { body, arms, head, legs } = root.userData;
  // the robe's skirt over the legs
  const skirt = mesh(cyl(0.34, 0.55, 0.85, 18), robe); skirt.position.y = 0.48; body.add(skirt);
  const hem = mesh(new THREE.TorusGeometry(0.55, 0.035, 6, 24), trim); hem.rotation.x = Math.PI / 2; hem.position.y = 0.07; body.add(hem);
  const sash = mesh(cyl(0.35, 0.35, 0.08, 18), trim); sash.position.y = 0.88; body.add(sash);
  legs.forEach(l => { l.visible = true; l.scale.set(0.9, 0.9, 0.9); });
  for (const s of [-1, 1]) { const sl = mesh(cyl(0.12, 0.2, 0.3, 10), robe); sl.position.set(0.42 * s, 0.88, 0); body.add(sl); }
  // beard and hat
  const beard = mesh(new THREE.ConeGeometry(0.2, 0.45, 10), mat('beard', { color: '#e8e4dc', roughness: 0.9 })); beard.position.set(0, -0.22, 0.17); beard.rotation.x = Math.PI + 0.25; head.add(beard);
  for (const s of [-1, 1]) { const e = mesh(sph(0.04, 8, 6), mat('black', { color: '#1b1a1d', roughness: 0.4 }), false); e.position.set(0.09 * s, 0.04, 0.24); head.add(e); }
  const brim = mesh(cyl(0.5, 0.5, 0.05, 24), robeD); brim.position.y = 0.17; head.add(brim);
  const hatG = new THREE.Group(); hatG.position.y = 0.2; head.add(hatG);
  const hat = mesh(new THREE.ConeGeometry(0.32, 0.9, 18), robe); hat.position.set(0, 0.45, -0.05); hat.rotation.x = -0.25; hatG.add(hat);
  const band = mesh(cyl(0.31, 0.32, 0.08, 18), trim); band.position.y = 0.05; hatG.add(band);
  for (let i = 0; i < 4; i++) { const st = mesh(new THREE.OctahedronGeometry(0.05), basic('star', { color: '#ffe9a0' })); st.position.set(Math.cos(i * 1.7) * 0.22, 0.3 + i * 0.12, Math.sin(i * 1.7) * 0.18 + 0.05); hatG.add(st); }
  // staff with an orb
  const staff = new THREE.Group(); staff.position.set(0, -0.56, 0.05); arms[1].add(staff);
  const pole = mesh(cyl(0.05, 0.06, 2.0, 8), wood); pole.position.y = 0.35; staff.add(pole);
  const claw = mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 12), trim); claw.position.y = 1.35; staff.add(claw);
  const orbMat = new THREE.MeshStandardMaterial({ color: '#9ad8ff', emissive: '#4ab0ff', emissiveIntensity: 1.4, roughness: 0.1 });
  const orb = mesh(sph(0.16, 16, 12), orbMat, false); orb.position.y = 1.4; staff.add(orb); orb.userData.noFlash = true;
  Object.assign(root.userData, { staff, orb, orbMat, hat: hatG, weapon: 'staff' });
  return finish(root, 2.15);
}
export function buildHunter() {
  const green = mat('hgreen', { color: '#3f6a2a', roughness: 0.7 }), greenD = mat('hgreenD', { color: '#2a4a1c', roughness: 0.75 });
  const leather = mat('leather', { color: '#5a3a22', roughness: 0.7 }), brown = mat('hbrown', { color: '#7a5030', roughness: 0.7 });
  const root = heroBase({ legMat: mat('hpants', { color: '#4a3a28', roughness: 0.8 }), bootMat: leather, torsoMat: green, armMat: greenD, handMat: leather });
  const { body, arms, head } = root.userData;
  const vest = mesh(box(0.5, 0.55, 0.08), brown); vest.position.set(0, 1.0, 0.29); body.add(vest);
  const belt = mesh(cyl(0.345, 0.345, 0.09, 18), leather); belt.position.y = 0.84; body.add(belt);
  // the cloak and hood
  const capeGeo = new THREE.PlaneGeometry(0.75, 1.15, 6, 8); capeGeo.translate(0, -0.55, 0);
  { const pa = capeGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setX(i, x * (1 - y * 0.3)); pa.setZ(i, -x * x * 0.9); if (y < -1.0) pa.setY(i, y + (Math.abs(x) > 0.2 ? 0.1 : 0)); } capeGeo.computeVertexNormals(); }
  const cape = mesh(capeGeo, mat('hcloak', { color: '#2c4a20', roughness: 0.8, side: THREE.DoubleSide })); cape.position.set(0, 1.45, -0.33); body.add(cape);
  const hood = mesh(new THREE.SphereGeometry(0.32, 18, 14, 0, TAU, 0, Math.PI * 0.62), green); hood.position.set(0, 0.04, -0.03); hood.rotation.x = -0.3; head.add(hood);
  const tipH = mesh(new THREE.ConeGeometry(0.16, 0.36, 10), green); tipH.position.set(0, 0.12, -0.32); tipH.rotation.x = -2.0; head.add(tipH);
  for (const s of [-1, 1]) { const e = mesh(sph(0.04, 8, 6), mat('black', { color: '#1b1a1d', roughness: 0.4 }), false); e.position.set(0.09 * s, 0.02, 0.24); head.add(e); }
  const scarf = mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), mat('hscarf', { color: '#a87a3a', roughness: 0.8 })); scarf.rotation.x = Math.PI / 2; scarf.position.y = -0.2; head.add(scarf);
  // quiver on the back
  const quiver = new THREE.Group(); quiver.position.set(0.15, 1.2, -0.38); quiver.rotation.z = -0.4; body.add(quiver);
  quiver.add(mesh(cyl(0.12, 0.1, 0.7, 10), leather));
  for (let i = 0; i < 4; i++) { const ar = mesh(cyl(0.015, 0.015, 0.5, 4), mat('shaft', { color: '#c8a070' })); ar.position.set(-0.05 + i * 0.035, 0.5, 0); quiver.add(ar); const f = mesh(box(0.06, 0.12, 0.01), mat('fletch', { color: '#e8e0d0' })); f.position.set(-0.05 + i * 0.035, 0.7, 0); quiver.add(f); }
  // the bow in the left hand
  const bow = new THREE.Group(); bow.position.set(0, -0.55, 0.05); arms[0].add(bow);
  const curve = new THREE.CatmullRomCurve3([new V3(0, -0.75, -0.1), new V3(0, -0.35, 0.12), new V3(0, 0, 0.18), new V3(0, 0.35, 0.12), new V3(0, 0.75, -0.1)]);
  bow.add(mesh(new THREE.TubeGeometry(curve, 20, 0.04, 6), mat('bowwood', { color: '#7a4a22', roughness: 0.6 })));
  const strGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, -0.75, -0.1), new V3(0, 0, -0.1), new V3(0, 0.75, -0.1)]);
  const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: '#ece4d0' })); bow.add(string);
  bow.rotation.set(Math.PI / 2, 0, 0);
  Object.assign(root.userData, { cape, bow, string, weapon: 'bow' });
  return finish(root, 2.15);
}
export const buildHero = cls => makeFlashable([buildWarrior, buildMage, buildHunter][cls]());
// armor and helmet on the hero: rare and better show (null takes them off)
export function equipHeroGear(root, cls, which, rar, tier) {
  const u = root.userData, key = which === 'armor' ? 'wearA' : 'wearH';
  if (u[key]) { u[key].parent.remove(u[key]); u[key] = null; }
  const w = rar < 0 ? null : which === 'armor' ? heroArmor(cls, rar, tier) : heroHelm(cls, rar, tier);
  if (!w) return;
  w.traverse(o => { if (o.isMesh) o.castShadow = true; });
  (which === 'armor' ? u.body : u.head).add(w);
  u[key] = w;
}
// put the equipped weapon in the hero's hand (rarity 0-4, tier 0-7)
export function equipHeroWeapon(root, cls, rar, tier) {
  const u = root.userData, hold = [u.sword, u.staff, u.bow][cls];
  if (!hold) return;
  for (const c of [...hold.children]) hold.remove(c);
  const w = buildWeapon(cls, rar, tier);
  if (cls === 0) w.rotation.x = Math.PI / 2;
  w.traverse(o => { if (o.isMesh) o.castShadow = true; });
  hold.add(w);
  u.wtick = w.userData.tick; u.glowK = w.userData.glowK;
  if (cls === 0) { u.bladeMat = w.userData.bladeMat; u.bladeBase = u.bladeMat.emissive ? u.bladeMat.emissive.clone() : null; u.bladeBaseI = u.bladeMat.emissiveIntensity; }
  if (cls === 1) { u.orbMat = w.userData.orbMat; u.orb = w.userData.orb; }
  if (cls === 2) { u.string = w.userData.string; u.stringZ = w.userData.stringZ; }
}

function restoreBlade(u) {
  if (u.bladeBase) { u.bladeMat.emissive.copy(u.bladeBase); u.bladeMat.emissiveIntensity = u.bladeBaseI; }
  else u.bladeMat.emissive.set('#000000');
}
// the hero's motion: walking, swinging, casting, drawing, rolling, blinking
export function animHero(root, t, s) {
  const u = root.userData;
  const w = Math.sin(s.walk) * s.move;
  u.legs[0].rotation.x = w * 0.7; u.legs[1].rotation.x = -w * 0.7;
  u.body.position.y = Math.abs(Math.cos(s.walk)) * 0.06 * s.move + Math.sin(t * 2) * 0.012;
  u.body.rotation.set(0, 0, 0);
  if (u.cape) u.cape.rotation.x = 0.1 + s.move * 0.22 + Math.sin(t * 5 + s.walk) * 0.04;
  u.head.rotation.y = Math.sin(t * 0.7) * 0.08;
  u.arms[0].rotation.set(-w * 0.5 - 0.2, 0, 0);
  u.arms[1].rotation.set(w * 0.5 - 0.3, 0, 0.1);
  if (s.roll > 0) { // tuck and spin
    const k = 1 - s.roll;
    u.body.rotation.x = k * TAU; u.body.position.y = 0.5 + Math.sin(k * Math.PI) * 0.3;
    u.arms[0].rotation.x = -1.6; u.arms[1].rotation.x = -1.6;
    u.legs[0].rotation.x = -1.4; u.legs[1].rotation.x = -1.4;
  }
  if (u.weapon === 'sword') {
    if (s.swing >= 0) {
      const k = s.swing; // 0 .. 1 over the swing
      if (s.whirl) {
        u.body.rotation.y = -k * TAU;
        u.arms[1].rotation.set(-1.5, 0, -0.2);
      } else {
        u.arms[1].rotation.x = k < 0.25 ? -2.6 * (k / 0.25) : -2.6 + (k - 0.25) / 0.75 * 2.9;
        u.arms[1].rotation.z = k < 0.25 ? 0.9 * (k / 0.25) : 0.9 - (k - 0.25) / 0.75 * 1.9;
        u.body.rotation.y = k < 0.25 ? 0.35 * (k / 0.25) : 0.35 - (k - 0.25) / 0.75 * 0.8;
      }
      if (k > 0.2 && k < 0.85) { u.bladeMat.emissive.set('#7a6a40'); u.bladeMat.emissiveIntensity = Math.max(1, u.bladeBaseI || 1); }
      else restoreBlade(u);
    } else restoreBlade(u);
  } else if (u.weapon === 'staff') {
    const gk = u.glowK || 1;
    if (s.cast >= 0) { const k = s.cast; u.arms[1].rotation.x = -0.4 - Math.sin(Math.min(1, k * 1.5) * Math.PI) * 1.4; u.orbMat.emissiveIntensity = (1.4 + Math.sin(k * Math.PI) * 4) * gk; }
    else u.orbMat.emissiveIntensity = (1.4 + Math.sin(t * 3) * 0.3) * gk;
    if (s.orbColor) u.orbMat.emissive.set(s.orbColor);
  } else if (u.weapon === 'bow') {
    if (s.cast >= 0) {
      const k = s.cast;
      u.arms[0].rotation.set(-1.55, 0.25, 0);
      u.arms[1].rotation.set(-1.45, -0.2, 0);
      const pull = k < 0.6 ? k / 0.6 : Math.max(0, 1 - (k - 0.6) / 0.15);
      u.arms[1].position.z = -pull * 0.25;
      u.string.geometry.attributes.position.setZ(1, (u.stringZ ?? -0.1) - pull * 0.35); u.string.geometry.attributes.position.needsUpdate = true;
    } else { u.arms[1].position.z = 0; u.string.geometry.attributes.position.setZ(1, u.stringZ ?? -0.1); u.string.geometry.attributes.position.needsUpdate = true; }
  }
  if (u.wtick) u.wtick(t);
  if (u.wearA) u.wearA.userData.tick(t);
  if (u.wearH) u.wearH.userData.tick(t);
}

// ---------------------------------------------------------------- monsters
// body colors per floor for the slimes (the SNES game tinted them by floor)
export const SLIME_COLORS = ['#3fae3c', '#3c8cdc', '#e0a030', '#d06a2a', '#b6d040', '#d03a3a', '#e0c040', '#9a4ad0', '#40c0b0', '#c06020', '#c050a0', '#60d080'];
function buildSlime(color = '#3fae3c', crown = false) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.22, emissive: new THREE.Color(color).multiplyScalar(0.25), emissiveIntensity: 1, envMapIntensity: 0.35 });
  const blob = mesh(sph(1, 32, 24), m); blob.scale.set(1.18, 0.78, 1.12); blob.position.y = 0.76; body.add(blob);
  const shine = new THREE.Mesh(sph(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#f0ffe8', transparent: true, opacity: 0.7 })); shine.position.set(-0.45, 1.32, 0.25); shine.scale.set(1, 0.45, 0.7); body.add(shine);
  const drip = mesh(sph(0.42, 14, 10), m); drip.position.set(0.55, 0.3, 0.35); drip.scale.set(1, 0.6, 1); body.add(drip);
  eyes(body, 0.34, 1.22, 0.68, 0.26);
  if (crown) {
    const gold = mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25, envMapIntensity: 1.3 });
    const c = new THREE.Group(); c.position.y = 1.55; body.add(c);
    c.add(mesh(cyl(0.45, 0.5, 0.25, 12), gold));
    for (let i = 0; i < 6; i++) { const sp = mesh(new THREE.ConeGeometry(0.1, 0.35, 5), gold); sp.position.set(Math.cos(i / 6 * TAU) * 0.45, 0.25, Math.sin(i / 6 * TAU) * 0.45); c.add(sp); }
    for (let i = 0; i < 3; i++) { const j = mesh(sph(0.07, 8, 6), mat('ruby', { color: '#ff2a4a', emissive: '#a00020', emissiveIntensity: 0.6, roughness: 0.2 })); j.position.set(Math.cos(i / 3 * TAU + 0.5) * 0.48, 0.05, Math.sin(i / 3 * TAU + 0.5) * 0.48); c.add(j); }
  }
  g.userData = { body, base: 1, anim: (t, s) => {
    const ph = (s.timer & 63) / 64; // its hop rhythm (game.c: 40 of 64 frames moving)
    let y = 0, sq = 1;
    if (s.moving) { const k = (t * 2.2 + s.seed) % 1; y = Math.abs(Math.sin(k * Math.PI)) * 0.55; sq = 1 + Math.sin(k * Math.PI) * 0.18; }
    else { sq = 1 + Math.sin(t * 3 + s.seed) * 0.06; }
    body.position.y = y;
    body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  } };
  return g;
}
function buildBat(vampire = false) {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.7; g.add(body);
  const fur = mat(vampire ? 'vbat' : 'bat', { color: vampire ? '#4a1424' : '#3a2c44', roughness: 0.7 });
  const wingM = mat(vampire ? 'vbatw' : 'batw', { color: vampire ? '#7a1830' : '#5a3a6a', roughness: 0.6, side: THREE.DoubleSide });
  const b = mesh(sph(0.45, 14, 10), fur); b.scale.set(1, 0.9, 1.1); body.add(b);
  const head = mesh(sph(0.32, 14, 10), fur); head.position.set(0, 0.2, 0.42); body.add(head);
  for (const s of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.1, 0.32, 5), fur); ear.position.set(0.16 * s, 0.5, 0.4); body.add(ear); }
  const eg = new THREE.Group(); eg.position.set(0, 0.25, 0.68); body.add(eg);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(sph(0.07, 8, 6), basic(vampire ? 'eyeRed' : 'eyeYel', { color: vampire ? '#ff2a3a' : '#ffd84a' })); e.position.set(0.12 * s, 0, 0); eg.add(e); }
  for (const s of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(0.03, 0.1, 4), mat('fang', { color: '#fff' })); f.position.set(0.06 * s, 0.05, 0.7); f.rotation.x = Math.PI; body.add(f); }
  const wings = [];
  for (const s of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(0.35 * s, 0.1, 0); body.add(wg);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(1.2, 0.35); shape.lineTo(1.5, -0.1); shape.quadraticCurveTo(1.15, -0.05, 1.05, -0.35); shape.quadraticCurveTo(0.75, -0.2, 0.6, -0.45); shape.quadraticCurveTo(0.35, -0.25, 0, -0.3);
    const wgeo = new THREE.ShapeGeometry(shape); wgeo.rotateX(-Math.PI / 2);
    const w = mesh(wgeo, wingM); w.scale.set(s * (vampire ? 1.25 : 1), 1, 1); wg.add(w);
    wings.push(wg);
  }
  g.userData = { body, anim: (t, s) => {
    const f = Math.sin(t * (vampire ? 22 : 18) + s.seed) * 0.9;
    wings[0].rotation.z = f; wings[1].rotation.z = -f;
    body.position.y = 1.7 + Math.sin(t * 5 + s.seed) * 0.2;
  } };
  return g;
}
function buildSkeleton(archer = false) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const bone = mat('boneS', { color: '#e2d8c4', roughness: 0.6 });
  const dark = mat('dark', { color: '#1a1412', roughness: 1 });
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.18 * s, 0.85, 0); body.add(leg);
    leg.add(seg([0, 0, 0], [0, -0.42, 0.02], 0.06, 0.05, bone)); leg.add(seg([0, -0.42, 0.02], [0, -0.82, 0], 0.05, 0.045, bone));
    const foot = mesh(box(0.14, 0.08, 0.26), bone); foot.position.set(0, -0.84, 0.06); leg.add(foot);
    legs.push(leg);
  }
  const pelvis = mesh(box(0.42, 0.14, 0.2), bone); pelvis.position.y = 0.88; body.add(pelvis);
  body.add(seg([0, 0.9, 0], [0, 1.55, 0], 0.05, 0.05, bone));
  for (let i = 0; i < 4; i++) { const rib = mesh(new THREE.TorusGeometry(0.22 - i * 0.02, 0.025, 6, 16, Math.PI * 1.4), bone); rib.position.set(0, 1.12 + i * 0.12, 0.02); rib.rotation.set(Math.PI / 2, 0, -Math.PI * 0.2 + Math.PI / 2); rib.rotation.x = Math.PI / 2; body.add(rib); }
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.3 * s, 1.5, 0); body.add(arm);
    arm.add(seg([0, 0, 0], [0, -0.38, 0], 0.045, 0.04, bone)); arm.add(seg([0, -0.38, 0], [0, -0.72, 0.08], 0.04, 0.035, bone));
    arms.push(arm);
  }
  const head = new THREE.Group(); head.position.y = 1.82; body.add(head);
  const skull = mesh(sph(0.27, 14, 12), bone); skull.scale.set(1, 1.05, 1.05); head.add(skull);
  const jaw = mesh(box(0.3, 0.1, 0.22), bone); jaw.position.set(0, -0.22, 0.1); head.add(jaw);
  for (const s of [-1, 1]) { const e = mesh(sph(0.08, 8, 6), dark, false); e.position.set(0.1 * s, 0.02, 0.22); head.add(e); const gl = new THREE.Mesh(sph(0.03, 6, 4), basic('eyeRed', { color: '#ff2a3a' })); gl.position.set(0.1 * s, 0.02, 0.27); head.add(gl); }
  if (archer) {
    const hood = mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, TAU, 0, Math.PI * 0.6), mat('archhood', { color: '#3a4a2a', roughness: 0.8 })); hood.position.y = 0.04; hood.rotation.x = -0.3; head.add(hood);
    const bow = new THREE.Group(); bow.position.set(0, -0.72, 0.1); arms[0].add(bow);
    const curve = new THREE.CatmullRomCurve3([new V3(0, -0.6, -0.05), new V3(0, 0, 0.16), new V3(0, 0.6, -0.05)]);
    bow.add(mesh(new THREE.TubeGeometry(curve, 12, 0.035, 5), mat('bowwood', { color: '#7a4a22', roughness: 0.6 })));
    bow.rotation.x = Math.PI / 2;
  } else {
    const sw = new THREE.Group(); sw.position.set(0, -0.72, 0.1); arms[1].add(sw);
    const bl = mesh(box(0.08, 0.03, 0.9), mat('rusty', { color: '#8a8478', metalness: 0.7, roughness: 0.5 })); bl.position.z = 0.45; sw.add(bl);
    const gd = mesh(box(0.28, 0.05, 0.05), mat('rustyD', { color: '#5a4a3a', metalness: 0.5, roughness: 0.6 })); sw.add(gd);
    const sh = mesh(cyl(0.3, 0.3, 0.06, 12), mat('woodS', { color: '#6a4426', roughness: 0.8 })); sh.rotation.z = Math.PI / 2; sh.position.set(-0.08, -0.5, 0.15); arms[0].add(sh);
  }
  g.userData = { body, anim: (t, s) => {
    const w = s.moving ? Math.sin(t * 9 + s.seed) : 0;
    legs[0].rotation.x = w * 0.6; legs[1].rotation.x = -w * 0.6;
    arms[0].rotation.x = -w * 0.4 - (archer ? 1.2 : 0); arms[1].rotation.x = w * 0.4 - (s.attack ? 1.4 : 0.3);
    head.rotation.z = Math.sin(t * 4 + s.seed) * 0.05;
    jaw.position.y = -0.22 - Math.max(0, Math.sin(t * 6 + s.seed)) * 0.04;
  } };
  return g;
}
function buildSpider() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const dark = mat('spider', { color: '#24152f', roughness: 0.35, metalness: 0.1, envMapIntensity: 0.9 });
  const mark = mat('spmark', { color: '#d43c2a', roughness: 0.3 });
  const abd = mesh(sph(0.62, 16, 12), dark); abd.position.set(0, 0.75, -0.55); abd.scale.set(1, 0.82, 1.15); body.add(abd);
  const m1 = mesh(sph(0.22, 10, 8), mark); m1.position.set(0, 1.2, -0.5); m1.scale.set(0.6, 0.2, 1.1); body.add(m1);
  const thorax = mesh(sph(0.38, 14, 10), mat('spider2', { color: '#3a2350', roughness: 0.4 })); thorax.position.set(0, 0.6, 0.25); body.add(thorax);
  for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(sph(i < 2 ? 0.07 : 0.045, 8, 6), basic('eyeRed', { color: '#ff2a3a' })); e.position.set((i & 1 ? 1 : -1) * (i < 2 ? 0.1 : 0.2), i < 2 ? 0.8 : 0.75, 0.55); body.add(e); }
  const legM = mat('spleg', { color: '#2a1838', roughness: 0.5 });
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group(); leg.position.set(0.25 * s, 0.6, 0.4 - i * 0.22); leg.rotation.y = s * (0.9 - i * 0.55); body.add(leg);
    leg.add(seg([0, 0, 0], [0.6 * s, 0.5, 0], 0.06, 0.05, legM)); leg.add(seg([0.6 * s, 0.5, 0], [1.25 * s, -0.6, 0], 0.05, 0.02, legM));
    legs.push(leg);
  }
  g.userData = { body, anim: (t, s) => {
    const sp = s.moving ? 20 : 3;
    legs.forEach((l, i) => { l.rotation.x = Math.sin(t * sp + i * 1.3 + s.seed) * (s.moving ? 0.3 : 0.05); });
    body.position.y = s.moving ? Math.abs(Math.sin(t * sp)) * 0.06 : 0;
  } };
  return g;
}
function buildGhost(wraith = false) {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.5; g.add(body);
  const m = wraith
    ? new THREE.MeshStandardMaterial({ color: '#2a2040', roughness: 0.8, emissive: '#3a1a6a', emissiveIntensity: 0.4, transparent: true, opacity: 0.92 })
    : new THREE.MeshStandardMaterial({ color: '#e8f2ff', roughness: 0.5, emissive: '#7ab0ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.85 });
  const pts = [];
  for (let i = 0; i <= 12; i++) { const k = i / 12; pts.push(new THREE.Vector2(Math.sin(k * Math.PI * 0.55 + 0.02) * (0.75 + k * 0.1) * (k > 0.85 ? 1 + (k - 0.85) * 1.5 : 1), 2.2 - k * 2.2)); }
  const sheet = mesh(new THREE.LatheGeometry(pts, 20), m); body.add(sheet);
  // ragged hem
  const hem = [];
  for (let i = 0; i < 8; i++) { const h = mesh(new THREE.ConeGeometry(0.22, 0.6, 6), m); const a = i / 8 * TAU; h.position.set(Math.cos(a) * 0.72, -0.15, Math.sin(a) * 0.72); h.rotation.x = Math.PI; body.add(h); hem.push(h); }
  if (wraith) {
    const hood = mesh(new THREE.ConeGeometry(0.55, 1.0, 14), m); hood.position.y = 2.35; body.add(hood);
    const face = new THREE.Mesh(sph(0.42, 12, 10), basic('void', { color: '#05030a' })); face.position.set(0, 1.85, 0.35); face.scale.set(1, 1.1, 0.5); body.add(face);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(sph(0.08, 8, 6), basic('eyeViolet', { color: '#c08aff' })); e.position.set(0.14 * s, 1.92, 0.58); body.add(e); }
    for (const s of [-1, 1]) { const arm = mesh(new THREE.ConeGeometry(0.16, 0.9, 6), m); arm.position.set(0.75 * s, 1.2, 0.2); arm.rotation.z = s * 0.9; body.add(arm); const claw = mesh(new THREE.ConeGeometry(0.06, 0.3, 4), mat('wclaw', { color: '#d8d0e8' })); claw.position.set(1.12 * s, 0.9, 0.3); body.add(claw); }
  } else {
    for (const s of [-1, 1]) { const e = mesh(sph(0.14, 10, 8), mat('ghostEye', { color: '#141828', roughness: 0.2 }), false); e.position.set(0.24 * s, 1.55, 0.62); e.scale.set(1, 1.4, 0.6); body.add(e); }
    const mouth = mesh(sph(0.12, 10, 8), mat('ghostEye', { color: '#141828', roughness: 0.2 }), false); mouth.position.set(0, 1.18, 0.7); mouth.scale.set(1, 1.3, 0.5); body.add(mouth);
  }
  g.userData = { body, ghostMat: m, anim: (t, s) => {
    body.position.y = 0.5 + Math.sin(t * 2.5 + s.seed) * 0.25;
    hem.forEach((h, i) => { h.rotation.z = Math.sin(t * 4 + i) * 0.25; });
    body.rotation.z = Math.sin(t * 1.5 + s.seed) * 0.06;
  } };
  return g;
}
function buildWizard() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const robe = mat('wizrobe', { color: '#5a2a8a', roughness: 0.7 }), trim = mat('trimg', { color: '#f0c040', metalness: 0.8, roughness: 0.3 });
  const skirt = mesh(new THREE.ConeGeometry(0.75, 1.9, 16, 1, true), robe); skirt.position.y = 0.95; body.add(skirt);
  const bottom = mesh(new THREE.CircleGeometry(0.75, 16), robe); bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.01; body.add(bottom);
  const torso = mesh(cap(0.32, 0.35, 12), robe); torso.position.y = 1.65; body.add(torso);
  const head = mesh(sph(0.26, 14, 12), mat('greenskin', { color: '#7ab060', roughness: 0.6 })); head.position.y = 2.15; body.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(sph(0.05, 8, 6), basic('eyeYel', { color: '#ffd84a' })); e.position.set(0.1 * s, 2.18, 0.23); body.add(e); }
  const nose = mesh(new THREE.ConeGeometry(0.06, 0.25, 6), mat('greenskin', { color: '#7ab060', roughness: 0.6 })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.1, 0.3); body.add(nose);
  const brim = mesh(cyl(0.55, 0.55, 0.05, 20), robe); brim.position.y = 2.35; body.add(brim);
  const hat = mesh(new THREE.ConeGeometry(0.34, 1.1, 16), robe); hat.position.set(0, 2.9, -0.1); hat.rotation.x = -0.35; body.add(hat);
  const band = mesh(cyl(0.33, 0.34, 0.08, 16), trim); band.position.y = 2.42; body.add(band);
  const arm = new THREE.Group(); arm.position.set(0.45, 1.75, 0); body.add(arm);
  arm.add(mesh(cap(0.1, 0.4, 8), robe));
  const staff = mesh(cyl(0.05, 0.06, 2.2, 8), mat('staffw', { color: '#6a4426', roughness: 0.7 })); staff.position.set(0, -0.2, 0.15); arm.add(staff);
  const orb = new THREE.Mesh(sph(0.18, 12, 10), new THREE.MeshBasicMaterial({ color: '#ff8a2a' })); orb.position.set(0, 0.95, 0.15); arm.add(orb);
  g.userData = { body, anim: (t, s) => {
    body.position.y = Math.sin(t * 2 + s.seed) * 0.04;
    arm.rotation.x = s.attack ? -1.2 : Math.sin(t * 1.5) * 0.1;
    orb.scale.setScalar(1 + (s.attack ? 0.6 : 0) + Math.sin(t * 6) * 0.1);
  } };
  return g;
}
function buildImp() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.9; g.add(body);
  const skin = mat('imp', { color: '#c8322a', roughness: 0.45 });
  const b = mesh(sph(0.5, 14, 12), skin); b.scale.set(1, 1.1, 0.9); body.add(b);
  const head = mesh(sph(0.42, 14, 12), skin); head.position.set(0, 0.7, 0.1); body.add(head);
  for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.09, 0.4, 6), mat('horn', { color: '#2a1a14', roughness: 0.5 })); h.position.set(0.22 * s, 1.08, 0.05); h.rotation.z = -s * 0.4; body.add(h); }
  eyes(body, 0.15, 0.78, 0.45, 0.12, '#111', false, '#ffd84a');
  const grin = mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 12, Math.PI), mat('dark', { color: '#1a1412', roughness: 1 })); grin.position.set(0, 0.58, 0.46); grin.rotation.z = Math.PI; body.add(grin);
  const wings = [];
  for (const s of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(0.3 * s, 0.25, -0.35); body.add(wg);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.9, 0.6); shape.lineTo(0.7, 0.1); shape.lineTo(0.95, -0.15); shape.lineTo(0.4, -0.2); shape.lineTo(0, -0.1);
    const w = mesh(new THREE.ShapeGeometry(shape), mat('impwing', { color: '#7a1a1a', roughness: 0.6, side: THREE.DoubleSide })); w.scale.x = s; w.rotation.y = s * 0.5; wg.add(w); wings.push(wg);
  }
  const tail = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, -0.3, -0.4), new V3(0, -0.5, -0.8), new V3(0, -0.2, -1.1)]), 12, 0.04, 5), skin); body.add(tail);
  g.userData = { body, anim: (t, s) => {
    const f = Math.sin(t * 16 + s.seed) * 0.6;
    wings[0].rotation.z = f; wings[1].rotation.z = -f;
    body.position.y = 0.9 + Math.sin(t * 6 + s.seed) * 0.15;
  } };
  return g;
}
function buildGolem() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const stone = mat('golem', { color: '#7a746a', roughness: 0.95 }), rune = basic('rune', { color: '#5ad8ff' });
  const block = (w, h, d, x, y, z, p = body) => { const m = mesh(box(w, h, d), stone); m.position.set(x, y, z); m.rotation.set((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1); p.add(m); return m; };
  block(1.3, 1.1, 0.9, 0, 1.55, 0); block(0.9, 0.5, 0.7, 0, 0.85, 0);
  const head = block(0.6, 0.5, 0.55, 0, 2.35, 0.1);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(box(0.14, 0.06, 0.02), rune); e.position.set(0.14 * s, 2.38, 0.39); body.add(e); }
  const core = new THREE.Mesh(sph(0.14, 10, 8), rune); core.position.set(0, 1.6, 0.46); body.add(core);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.35 * s, 0.65, 0); body.add(leg); block(0.45, 0.7, 0.5, 0, -0.32, 0, leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(0.85 * s, 1.95, 0); body.add(arm); block(0.45, 0.6, 0.45, 0, -0.3, 0, arm); block(0.6, 0.6, 0.6, 0, -0.95, 0.05, arm); arms.push(arm);
  }
  g.userData = { body, anim: (t, s) => {
    const w = s.moving ? Math.sin(t * 4 + s.seed) : 0;
    legs[0].rotation.x = w * 0.4; legs[1].rotation.x = -w * 0.4;
    arms[0].rotation.x = -w * 0.3; arms[1].rotation.x = w * 0.3;
    body.rotation.z = w * 0.04;
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.2);
  } };
  return g;
}
function buildFireSprite(big = false) {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = big ? 1.4 : 1.1; g.add(body);
  const core = new THREE.Mesh(sph(big ? 0.6 : 0.45, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffd060', emissive: '#ff6a10', emissiveIntensity: 2.2, roughness: 0.3 }));
  body.add(core);
  const flames = [];
  for (let i = 0; i < (big ? 9 : 6); i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: i & 1 ? '#ff7a2a' : '#ffb84a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    f.scale.set(big ? 1.6 : 1.1, big ? 2.2 : 1.6, 1); body.add(f); flames.push(f);
  }
  eyes(body, 0.15, 0.08, big ? 0.55 : 0.4, 0.09, '#3a0a00', false, '#2a0800');
  const light = new THREE.PointLight('#ff7a2a', big ? 12 : 6, big ? 9 : 6, 2); body.add(light);
  if (big) { // inferno: horns of flame and arms
    for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.14, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#3a1006', emissive: '#ff4a10', emissiveIntensity: 1 })); h.position.set(0.3 * s, 0.6, 0); h.rotation.z = -s * 0.5; body.add(h); }
  }
  g.userData = { body, light, anim: (t, s) => {
    flames.forEach((f, i) => { const a = i / flames.length * TAU + t * 3; f.position.set(Math.cos(a) * 0.18, 0.15 + ((t * 2 + i * 0.3) % 1) * 0.6, Math.sin(a) * 0.18); f.material.opacity = 1 - ((t * 2 + i * 0.3) % 1); });
    body.position.y = (big ? 1.4 : 1.1) + Math.sin(t * 4 + s.seed) * 0.15;
    const p = s.fuse ? 1 + Math.sin(t * 40) * 0.25 : 1; core.scale.setScalar(p);
    light.intensity = (big ? 12 : 6) * (s.fuse ? 2 : 1);
  } };
  return g;
}
function buildWisp() {
  const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 1.6; g.add(body);
  const core = new THREE.Mesh(sph(0.42, 16, 12), new THREE.MeshStandardMaterial({ color: '#c8f4ff', emissive: '#4ad0ff', emissiveIntensity: 2, roughness: 0.2, transparent: true, opacity: 0.9 }));
  body.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#5ad8ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })); halo.scale.set(3, 3, 1); body.add(halo);
  const trail = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: '#7ae0ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 - i * 0.08 })); s.scale.setScalar(0.8 - i * 0.12); body.add(s); trail.push(s); }
  eyes(body, 0.13, 0.05, 0.36, 0.08, '#0a2a3a', false, '#ffffff');
  const light = new THREE.PointLight('#5ad8ff', 8, 8, 2); body.add(light);
  g.userData = { body, anim: (t, s) => {
    body.position.y = 1.6 + Math.sin(t * 3 + s.seed) * 0.3;
    trail.forEach((p, i) => p.position.set(Math.sin(t * 4 - i * 0.5) * 0.15 * i, -0.1 * i, -0.25 * i));
    halo.material.opacity = 0.5 + Math.sin(t * 5) * 0.2;
  } };
  return g;
}
function buildHellCrab() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const shell = mat('crab', { color: '#b8321e', roughness: 0.35, metalness: 0.1, envMapIntensity: 0.9 }), shellD = mat('crabD', { color: '#7a1a10', roughness: 0.4 });
  const b = mesh(sph(0.95, 18, 12), shell); b.scale.set(1.25, 0.5, 0.9); b.position.y = 0.8; body.add(b);
  for (let i = 0; i < 5; i++) { const sp = mesh(new THREE.ConeGeometry(0.1, 0.35, 5), shellD); sp.position.set(-0.8 + i * 0.4, 1.2, -0.1); body.add(sp); }
  for (const s of [-1, 1]) { const st = seg([0.25 * s, 1.0, 0.55], [0.32 * s, 1.45, 0.65], 0.04, 0.03, shellD); body.add(st); const e = new THREE.Mesh(sph(0.09, 8, 6), basic('eyeYel', { color: '#ffd84a' })); e.position.set(0.32 * s, 1.5, 0.65); body.add(e); }
  const claws = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(1.0 * s, 0.85, 0.5); body.add(arm);
    arm.add(seg([0, 0, 0], [0.4 * s, 0.1, 0.5], 0.1, 0.09, shellD));
    const pincer = new THREE.Group(); pincer.position.set(0.4 * s, 0.1, 0.6); arm.add(pincer);
    const top = mesh(sph(0.35, 12, 8), shell); top.scale.set(0.8, 0.45, 1.2); top.position.y = 0.1; pincer.add(top);
    const bot = mesh(sph(0.3, 12, 8), shell); bot.scale.set(0.7, 0.35, 1.0); bot.position.set(0, -0.12, 0.1); pincer.add(bot);
    claws.push({ arm, bot });
  }
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const l = new THREE.Group(); l.position.set(0.9 * s, 0.7, -0.3 + i * 0.3); body.add(l); l.add(seg([0, 0, 0], [0.6 * s, -0.7, 0], 0.07, 0.03, shellD)); legs.push(l); }
  g.userData = { body, anim: (t, s) => {
    const sp = s.moving ? 22 : 2;
    legs.forEach((l, i) => { l.rotation.z = Math.sin(t * sp + i * 2) * 0.25; });
    claws.forEach((c, i) => { c.bot.rotation.x = Math.max(0, Math.sin(t * 6 + i * 2)) * 0.5; c.arm.rotation.y = Math.sin(t * 2 + i) * 0.15; });
  } };
  return g;
}
function buildDemon(big = false) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = mat(big ? 'demonB' : 'demon', { color: big ? '#8a2a1a' : '#9a2018', roughness: 0.5 }), dark = mat('horn', { color: '#2a1a14', roughness: 0.5 });
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.3 * s, 0.95, 0); body.add(leg);
    leg.add(seg([0, 0, 0], [0, -0.5, 0.15], 0.17, 0.13, skin)); leg.add(seg([0, -0.5, 0.15], [0, -0.9, -0.1], 0.12, 0.09, skin));
    const hoof = mesh(cyl(0.12, 0.16, 0.14, 8), dark); hoof.position.set(0, -0.95, -0.05); leg.add(hoof); legs.push(leg);
  }
  const torso = mesh(sph(0.62, 16, 12), skin); torso.scale.set(1.15, 1.15, 0.85); torso.position.y = 1.65; body.add(torso);
  const belly = mesh(sph(0.45, 14, 10), mat('demonBelly', { color: '#d8743a', roughness: 0.6 })); belly.position.set(0, 1.5, 0.28); belly.scale.set(1, 1, 0.5); body.add(belly);
  const head = new THREE.Group(); head.position.y = 2.45; body.add(head);
  head.add(mesh(sph(0.4, 14, 12), skin));
  for (const s of [-1, 1]) { const h = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0.25 * s, 0.25, 0), new V3(0.5 * s, 0.55, -0.1), new V3(0.45 * s, 0.85, -0.35)]), 10, 0.08, 6), dark); head.add(h); }
  eyes(head, 0.15, 0.08, 0.34, 0.1, '#111', false, '#ffd84a');
  const jaw = mesh(box(0.4, 0.12, 0.2), skin); jaw.position.set(0, -0.22, 0.25); head.add(jaw);
  for (const s of [-1, 1]) { const f = mesh(new THREE.ConeGeometry(0.04, 0.14, 4), mat('fang', { color: '#fff' })); f.position.set(0.12 * s, -0.12, 0.36); head.add(f); }
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.75 * s, 2.0, 0); body.add(arm);
    arm.add(seg([0, 0, 0], [0.15 * s, -0.55, 0.1], 0.15, 0.12, skin)); arm.add(seg([0.15 * s, -0.55, 0.1], [0.1 * s, -1.05, 0.3], 0.12, 0.1, skin));
    for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry(0.04, 0.2, 4), dark); c.position.set(0.1 * s + (i - 1) * 0.06, -1.18, 0.35); c.rotation.x = Math.PI; arm.add(c); }
    arms.push(arm);
  }
  const wings = [];
  for (const s of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(0.4 * s, 2.0, -0.45); body.add(wg);
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(1.4, 1.0); shape.lineTo(1.7, 0.2); shape.quadraticCurveTo(1.3, 0.1, 1.2, -0.4); shape.quadraticCurveTo(0.8, -0.2, 0.6, -0.6); shape.lineTo(0, -0.3);
    const w = mesh(new THREE.ShapeGeometry(shape), mat('dwing', { color: '#4a1010', roughness: 0.6, side: THREE.DoubleSide })); w.scale.x = s; w.rotation.y = s * 0.6; wg.add(w); wings.push(wg);
  }
  const tail = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, 1.1, -0.4), new V3(0, 0.7, -0.9), new V3(0.3, 0.6, -1.3), new V3(0.2, 0.9, -1.5)]), 16, 0.06, 6), skin); body.add(tail);
  g.userData = { body, anim: (t, s) => {
    const w = s.moving ? Math.sin(t * 8 + s.seed) : 0;
    legs[0].rotation.x = w * 0.5; legs[1].rotation.x = -w * 0.5;
    arms[0].rotation.x = -w * 0.4 - (s.attack ? 1.2 : 0); arms[1].rotation.x = w * 0.4 - (s.attack ? 1.2 : 0);
    wings[0].rotation.y = 0.6 + Math.sin(t * 3) * 0.15; wings[1].rotation.y = -0.6 - Math.sin(t * 3) * 0.15;
    if (s.glow) { s.glowMats ||= 1; }
  } };
  return g;
}
export function buildMonster(type, floor = 1) {
  let g;
  switch (type) {
    case D.M_SLIME: g = buildSlime(SLIME_COLORS[(floor * 7) % SLIME_COLORS.length]); break;
    case D.M_BAT: g = buildBat(false); break;
    case D.M_SKEL: g = buildSkeleton(false); break;
    case D.M_SPIDER: g = buildSpider(); break;
    case D.M_GHOST: g = buildGhost(false); break;
    case D.M_WIZARD: g = buildWizard(); break;
    case D.M_IMP: g = buildImp(); break;
    case D.M_GOLEM: g = buildGolem(); g.scale.setScalar(1.25); break;
    case D.M_ARCHER: g = buildSkeleton(true); break;
    case D.M_FIRESPRITE: g = buildFireSprite(false); break;
    case D.M_VBAT: g = buildBat(true); g.scale.setScalar(1.15); break;
    case D.M_WISP: g = buildWisp(); break;
    case D.M_HELLCRAB: g = buildHellCrab(); break;
    case D.M_SLIMEKING: g = buildSlime('#7a3cd0', true); g.scale.setScalar(1.3); break;
    case D.M_DEMON: g = buildDemon(false); break;
    case D.M_WRAITH: g = buildGhost(true); break;
    case D.M_INFERNO: g = buildFireSprite(true); break;
    default: g = buildSlime();
  }
  const base = new THREE.Group(); base.add(g);
  const sc = { [D.M_SLIME]: 1.05, [D.M_BAT]: 1.0, [D.M_SKEL]: 1.5, [D.M_SPIDER]: 1.1, [D.M_GHOST]: 1.15, [D.M_WIZARD]: 1.35, [D.M_IMP]: 1.2, [D.M_GOLEM]: 1.25,
    [D.M_ARCHER]: 1.5, [D.M_FIRESPRITE]: 1.1, [D.M_VBAT]: 1.0, [D.M_WISP]: 1.1, [D.M_HELLCRAB]: 1.15, [D.M_SLIMEKING]: 1.0, [D.M_DEMON]: 1.35, [D.M_WRAITH]: 1.3, [D.M_INFERNO]: 1.1 }[type] || 1;
  g.scale.multiplyScalar(sc);
  finish(base);
  makeFlashable(base);
  base.userData.inner = g;
  base.userData.anim = (t, s) => g.userData.anim && g.userData.anim(t, s);
  base.userData.ghostMat = g.userData.ghostMat;
  return base;
}

// ---------------------------------------------------------------- bosses (64x64 on the SNES: about 6 units)
function buildOgre() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = mat('ogre', { color: '#6a8a3a', roughness: 0.6 }), dark = mat('ogreD', { color: '#3a2a1a', roughness: 0.7 }), iron = mat('iron', { color: '#3a3836', metalness: 0.7, roughness: 0.45 });
  const legs = [], arms = [];
  for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(0.55 * s, 1.4, 0); body.add(leg); leg.add(seg([0, 0, 0], [0, -1.35, 0.1], 0.36, 0.3, skin)); const f = mesh(box(0.6, 0.3, 0.8), dark); f.position.set(0, -1.38, 0.2); leg.add(f); legs.push(leg); }
  const belly = mesh(sph(1.25, 18, 14), skin); belly.scale.set(1.1, 1.05, 0.95); belly.position.y = 2.4; body.add(belly);
  const loin = mesh(cyl(1.0, 1.15, 0.6, 16), dark); loin.position.y = 1.55; body.add(loin);
  const belt = mesh(new THREE.TorusGeometry(1.1, 0.1, 6, 24), iron); belt.rotation.x = Math.PI / 2; belt.position.y = 1.85; body.add(belt);
  const head = new THREE.Group(); head.position.set(0, 3.75, 0.35); body.add(head);
  head.add(mesh(sph(0.62, 16, 12), skin));
  for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.16, 0.7, 8), mat('hornW', { color: '#e8dcc0', roughness: 0.5 })); h.position.set(0.42 * s, 0.45, -0.05); h.rotation.z = -s * 0.6; head.add(h); }
  eyes(head, 0.22, 0.12, 0.52, 0.14, '#111', false, '#ff3a2a');
  for (const s of [-1, 1]) { const tusk = mesh(new THREE.ConeGeometry(0.07, 0.3, 6), mat('hornW', { color: '#e8dcc0', roughness: 0.5 })); tusk.position.set(0.2 * s, -0.25, 0.5); head.add(tusk); }
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(1.35 * s, 3.2, 0); body.add(arm);
    arm.add(seg([0, 0, 0], [0.3 * s, -1.0, 0.2], 0.32, 0.27, skin)); arm.add(seg([0.3 * s, -1.0, 0.2], [0.25 * s, -1.9, 0.5], 0.27, 0.24, skin));
    const fist = mesh(sph(0.36, 12, 10), skin); fist.position.set(0.25 * s, -2.05, 0.55); arm.add(fist);
    arms.push(arm);
  }
  // the club
  const club = new THREE.Group(); club.position.set(0.25, -2.0, 0.6); arms[1].add(club);
  club.add(seg([0, 0, 0], [0, 0, 2.2], 0.13, 0.32, mat('clubw', { color: '#5a3a1e', roughness: 0.8 })));
  for (let i = 0; i < 6; i++) { const sp = mesh(new THREE.ConeGeometry(0.08, 0.3, 5), iron); const a = i / 6 * TAU; sp.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 1.8); sp.lookAt(Math.cos(a) * 2, Math.sin(a) * 2, 1.8); sp.rotateX(Math.PI / 2); club.add(sp); }
  g.userData = { body, legs, arms, head };
  return g;
}
function buildSpiderDemon() {
  const g = buildSpider();
  const body = g.userData.body;
  const horns = mat('horn', { color: '#2a1a14', roughness: 0.5 });
  for (const s of [-1, 1]) { const h = mesh(new THREE.ConeGeometry(0.1, 0.6, 6), horns); h.position.set(0.18 * s, 1.0, 0.35); h.rotation.x = -0.6; body.add(h); }
  const glow = new THREE.Mesh(sph(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff5a2a' })); glow.position.set(0, 1.25, -0.5); glow.scale.set(1, 0.3, 1.4); body.add(glow);
  g.scale.setScalar(2.4);
  const w = new THREE.Group(); w.add(g); w.userData = { body: g.userData.body, anim: g.userData.anim };
  return w;
}
function buildFlameLord() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const robe = mat('flRobe', { color: '#3a1006', roughness: 0.6, emissive: '#5a1004', emissiveIntensity: 0.4 });
  const skirt = mesh(new THREE.ConeGeometry(1.3, 3.0, 18, 1, true), robe); skirt.position.y = 1.5; body.add(skirt);
  const torso = mesh(sph(0.95, 16, 12), robe); torso.position.y = 3.2; torso.scale.set(1.1, 1, 0.9); body.add(torso);
  const head = new THREE.Group(); head.position.y = 4.35; body.add(head);
  head.add(mesh(sph(0.55, 16, 12), mat('flSkin', { color: '#2a0a04', roughness: 0.4, emissive: '#ff3a00', emissiveIntensity: 0.5 })));
  eyes(head, 0.2, 0.05, 0.48, 0.12, '#111', false, '#ffe060');
  const crown = new THREE.Group(); crown.position.y = 0.5; head.add(crown);
  const flames = [];
  for (let i = 0; i < 7; i++) { const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: '#ff8a2a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); const a = i / 7 * TAU; f.position.set(Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4); f.scale.set(0.8, 1.4, 1); crown.add(f); flames.push(f); }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(1.1 * s, 3.5, 0); body.add(arm);
    arm.add(seg([0, 0, 0], [0.4 * s, -1.4, 0.4], 0.28, 0.2, robe));
    const orb = new THREE.Mesh(sph(0.35, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffd060', emissive: '#ff6a10', emissiveIntensity: 2.5 }));
    orb.position.set(0.45 * s, -1.6, 0.5); arm.add(orb); arms.push(arm);
  }
  const light = new THREE.PointLight('#ff6a20', 30, 16, 1.8); light.position.y = 4; body.add(light);
  g.userData = { body, arms, head, flames, anim: (t) => { flames.forEach((f, i) => { f.scale.y = 1.2 + Math.sin(t * 10 + i) * 0.3; }); } };
  return g;
}
function buildShadowWraith() {
  const g = buildGhost(true);
  g.scale.setScalar(2.3);
  const w = new THREE.Group(); w.add(g); w.userData = { body: g.userData.body, anim: g.userData.anim };
  return w;
}
function buildSlimeKingBoss() {
  const g = buildSlime('#5a2ac0', true);
  g.scale.setScalar(2.6);
  const w = new THREE.Group(); w.add(g); w.userData = { body: g.userData.body, anim: g.userData.anim };
  return w;
}
function buildTowerKingBrute() {
  const g = buildOgre();
  // purple-black skin, a crown and a cape
  g.traverse(o => { if (o.isMesh && o.material === M.ogre) o.material = mat('kingSkin', { color: '#4a3a6a', roughness: 0.5 }); });
  const gold = mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25, envMapIntensity: 1.3 });
  const head = g.userData.head;
  const crown = new THREE.Group(); crown.position.y = 0.55; head.add(crown);
  crown.add(mesh(cyl(0.5, 0.55, 0.28, 14), gold));
  for (let i = 0; i < 7; i++) { const sp = mesh(new THREE.ConeGeometry(0.1, 0.42, 5), gold); sp.position.set(Math.cos(i / 7 * TAU) * 0.5, 0.3, Math.sin(i / 7 * TAU) * 0.5); crown.add(sp); }
  const capeGeo = new THREE.PlaneGeometry(2.6, 3.2, 6, 8); capeGeo.translate(0, -1.6, 0);
  { const pa = capeGeo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, -x * x * 0.25 + y * 0.08); } capeGeo.computeVertexNormals(); }
  const cape = mesh(capeGeo, mat('kcape', { color: '#6a0a20', roughness: 0.7, side: THREE.DoubleSide })); cape.position.set(0, 3.5, -1.0); g.userData.body.add(cape);
  return g;
}
export function buildKingWizard() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  body.scale.setScalar(1.35);
  const robe = mat('kwRobe', { color: '#2a1a4a', roughness: 0.65 }), trim = mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25, envMapIntensity: 1.3 });
  const skirt = mesh(new THREE.ConeGeometry(0.85, 2.0, 18, 1, true), robe); skirt.position.y = 1.0; body.add(skirt);
  const hem = mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 24), trim); hem.rotation.x = Math.PI / 2; hem.position.y = 0.05; body.add(hem);
  const torso = mesh(cap(0.38, 0.4, 12), robe); torso.position.y = 1.85; body.add(torso);
  const head = new THREE.Group(); head.position.y = 2.45; body.add(head);
  head.add(mesh(sph(0.3, 14, 12), mat('paleSkin', { color: '#c8b8a8', roughness: 0.6 })));
  eyes(head, 0.1, 0.04, 0.27, 0.06, '#111', false, '#c08aff');
  const beard = mesh(new THREE.ConeGeometry(0.24, 0.7, 10), mat('greyBeard', { color: '#8a8a94', roughness: 0.9 })); beard.position.set(0, -0.35, 0.18); beard.rotation.x = Math.PI + 0.2; head.add(beard);
  const crown = new THREE.Group(); crown.position.y = 0.28; head.add(crown);
  crown.add(mesh(cyl(0.3, 0.32, 0.16, 12), trim));
  for (let i = 0; i < 5; i++) { const sp = mesh(new THREE.ConeGeometry(0.06, 0.26, 5), trim); sp.position.set(Math.cos(i / 5 * TAU) * 0.3, 0.18, Math.sin(i / 5 * TAU) * 0.3); crown.add(sp); }
  const capeGeo = new THREE.PlaneGeometry(1.2, 2.0, 4, 6); capeGeo.translate(0, -1.0, 0);
  const cape = mesh(capeGeo, mat('kcape', { color: '#6a0a20', roughness: 0.7, side: THREE.DoubleSide })); cape.position.set(0, 2.2, -0.4); body.add(cape);
  const arm = new THREE.Group(); arm.position.set(0.5, 2.0, 0); body.add(arm);
  arm.add(mesh(cap(0.11, 0.45, 8), robe));
  const staff = mesh(cyl(0.05, 0.06, 2.4, 8), mat('blackwood', { color: '#1a1214', roughness: 0.6 })); staff.position.set(0, -0.2, 0.15); arm.add(staff);
  const orbMat = new THREE.MeshStandardMaterial({ color: '#d8b0ff', emissive: '#8a3aff', emissiveIntensity: 2.2 });
  const orb = mesh(sph(0.2, 14, 10), orbMat, false); orb.position.set(0, 1.05, 0.15); arm.add(orb);
  const light = new THREE.PointLight('#a060ff', 12, 10, 2); light.position.set(0, 1.05, 0.15); arm.add(light);
  // the potion he drinks
  const potion = new THREE.Group(); potion.visible = false; potion.position.set(-0.45, 1.9, 0.35); body.add(potion);
  potion.add(mesh(sph(0.16, 12, 10), new THREE.MeshPhysicalMaterial({ color: '#a0ff60', emissive: '#40c010', emissiveIntensity: 1, roughness: 0.1, clearcoat: 1 })));
  const neck = mesh(cyl(0.05, 0.06, 0.16, 8), mat('glass', { color: '#d8f0e0', roughness: 0.1 })); neck.position.y = 0.18; potion.add(neck);
  g.userData = { body, arm, orbMat, potion, head, anim: (t, s) => {
    body.position.y = Math.sin(t * 2) * 0.05;
    arm.rotation.x = s.cast ? -1.3 : -0.2 + Math.sin(t * 1.4) * 0.08;
    orbMat.emissiveIntensity = 2.2 + (s.cast ? 3 : 0) + Math.sin(t * 5) * 0.4;
    potion.visible = !!s.drink;
    if (s.drink) { potion.position.set(-0.15, 2.3, 0.35); head.rotation.x = -0.4; } else head.rotation.x = 0;
    if (s.run) { body.rotation.z = Math.sin(t * 14) * 0.08; }
  } };
  finish(g, 1.45);
  return g;
}
export function buildBoss(art) {
  let g;
  switch (art) {
    case 0: g = buildOgre(); break;
    case 1: g = buildSpiderDemon(); break;
    case 2: g = buildFlameLord(); break;
    case 3: g = buildShadowWraith(); break;
    case 4: g = buildSlimeKingBoss(); break;
    default: g = buildTowerKingBrute();
  }
  g.scale.multiplyScalar(1.3); // (bosses tower over the hero)
  const base = new THREE.Group(); base.add(g);
  finish(base);
  makeFlashable(base);
  const u = g.userData;
  base.userData.anim = (t, s) => {
    if (u.anim) u.anim(t, { moving: s.moving, seed: 0, timer: 0, attack: s.wind });
    if (u.legs) { const w = s.moving ? Math.sin(t * 5) : 0; u.legs[0].rotation.x = w * 0.4; u.legs[1].rotation.x = -w * 0.4; }
    if (u.arms) {
      const up = s.wind ? -2.2 : (s.slam ? -0.3 : 0);
      u.arms.forEach((a, i) => { a.rotation.x = up + (s.moving ? Math.sin(t * 5 + i * Math.PI) * 0.3 : Math.sin(t * 1.5 + i) * 0.05); });
    }
    if (u.body) u.body.position.y = s.leap ? s.leapY : (s.stun ? -0.2 : 0) + (u.body.position.y || 0) * 0;
  };
  return base;
}

// ---------------------------------------------------------------- the wife, the merchant
export function buildWife() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const dress = mat('dress', { color: '#e8607a', roughness: 0.6 }), trim = mat('dressT', { color: '#ffd0da', roughness: 0.6 });
  const skirt = mesh(new THREE.ConeGeometry(0.75, 1.5, 18, 1, true), dress); skirt.position.y = 0.75; body.add(skirt);
  const hem = mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 24), trim); hem.rotation.x = Math.PI / 2; hem.position.y = 0.04; body.add(hem);
  const torso = mesh(cap(0.27, 0.35, 12), dress); torso.position.y = 1.62; body.add(torso);
  const arms = [];
  for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(0.33 * s, 1.82, 0); body.add(a); const m = mesh(cap(0.08, 0.38, 8), mat('skin', { color: '#eab48a', roughness: 0.6 })); m.position.y = -0.26; a.add(m); arms.push(a); }
  const head = new THREE.Group(); head.position.y = 2.2; body.add(head);
  head.add(mesh(sph(0.26, 16, 12), mat('skin', { color: '#eab48a', roughness: 0.6 })));
  const hair = mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, TAU, 0, Math.PI * 0.62), mat('hair', { color: '#7a3a1a', roughness: 0.7 })); hair.position.set(0, 0.04, -0.03); hair.rotation.x = -0.35; head.add(hair);
  const long = mesh(cap(0.22, 0.5, 10), mat('hair', { color: '#7a3a1a', roughness: 0.7 })); long.position.set(0, -0.3, -0.16); head.add(long);
  for (const s of [-1, 1]) { const e = mesh(sph(0.035, 8, 6), mat('black', { color: '#1b1a1d', roughness: 0.4 }), false); e.position.set(0.09 * s, 0.03, 0.24); head.add(e); }
  const tiara = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI), mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25 })); tiara.position.set(0, 0.2, 0.05); tiara.rotation.x = -0.4; head.add(tiara);
  g.userData = { body, arms, anim: (t, s) => {
    body.position.y = s.moving ? Math.abs(Math.sin(t * 9)) * 0.06 : Math.sin(t * 2) * 0.02;
    arms[0].rotation.x = s.happy ? -2.5 + Math.sin(t * 8) * 0.2 : (s.moving ? Math.sin(t * 9) * 0.4 : 0);
    arms[1].rotation.x = s.happy ? -2.5 - Math.sin(t * 8) * 0.2 : (s.moving ? -Math.sin(t * 9) * 0.4 : 0);
  } };
  return finish(g, 2.05);
}
export function buildMerchant() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const robe = mat('mRobe', { color: '#2a6a5a', roughness: 0.7 }), sash = mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25 });
  const skirt = mesh(new THREE.ConeGeometry(0.7, 1.3, 16, 1, true), robe); skirt.position.y = 0.65; body.add(skirt);
  const torso = mesh(sph(0.5, 14, 12), robe); torso.position.y = 1.45; torso.scale.set(1, 1.05, 0.95); body.add(torso);
  const belt = mesh(cyl(0.48, 0.48, 0.1, 16), sash); belt.position.y = 1.15; body.add(belt);
  const head = new THREE.Group(); head.position.y = 2.1; body.add(head);
  head.add(mesh(sph(0.28, 14, 12), mat('skin', { color: '#eab48a', roughness: 0.6 })));
  eyes(head, 0.09, 0.03, 0.25, 0.035, '#111', false);
  const tash = mesh(new THREE.TorusGeometry(0.1, 0.04, 6, 10, Math.PI), mat('beardB', { color: '#3a2a1a' })); tash.position.set(0, -0.08, 0.26); tash.rotation.z = Math.PI; head.add(tash);
  const turban = mesh(sph(0.32, 14, 10), mat('turban', { color: '#d84a3a', roughness: 0.7 })); turban.position.y = 0.14; turban.scale.set(1, 0.7, 1); head.add(turban);
  const gem = mesh(sph(0.06, 8, 6), mat('ruby', { color: '#ff2a4a', emissive: '#a00020', emissiveIntensity: 0.6 })); gem.position.set(0, 0.16, 0.3); head.add(gem);
  const pack = mesh(box(0.8, 1.0, 0.5), mat('pack', { color: '#7a5030', roughness: 0.8 })); pack.position.set(0, 1.6, -0.55); body.add(pack);
  const roll = mesh(cyl(0.18, 0.18, 0.9, 10), mat('roll', { color: '#a87a4a' })); roll.rotation.z = Math.PI / 2; roll.position.set(0, 2.2, -0.55); body.add(roll);
  const lantern = new THREE.Group(); lantern.position.set(0.55, 1.2, 0.3); body.add(lantern);
  lantern.add(mesh(cyl(0.12, 0.12, 0.25, 8), mat('iron', { color: '#3a3836', metalness: 0.7, roughness: 0.45 })));
  const lf = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.flame, color: '#ffc060', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); lf.scale.set(0.4, 0.5, 1); lantern.add(lf);
  const light = new THREE.PointLight('#ffb050', 8, 7, 2); lantern.add(light);
  g.userData = { body, anim: (t, s) => { body.position.y = s.moving ? Math.abs(Math.sin(t * 8)) * 0.06 : Math.sin(t * 2) * 0.02; lantern.rotation.z = Math.sin(t * 3) * 0.2; } };
  return finish(g, 2.0);
}

// ---------------------------------------------------------------- items on the floor
export function buildItem(kind, rar, cls, tier = 0) {
  const g = new THREE.Group(), model = new THREE.Group(); g.add(model);
  const rc = D.RAR_COLOR[rar] || '#ffffff';
  const metal = std({ color: rar >= 2 ? new THREE.Color(rc).lerp(new THREE.Color('#ffffff'), 0.25) : '#b8c0c8', metalness: 1, roughness: 0.2, envMapIntensity: 1.4, emissive: rar >= 1 ? rc : '#000000', emissiveIntensity: rar >= 3 ? 0.35 : 0.15 });
  const accent = std({ color: rc, metalness: 0.6, roughness: 0.3, emissive: rc, emissiveIntensity: rar >= 2 ? 0.5 : 0.2 });
  const leather = mat('leather', { color: '#5a3a22', roughness: 0.7 });
  switch (kind) {
    case D.K_WEAPON: {
      const w = buildWeapon(cls, rar, tier), piv = new THREE.Group();
      w.position.y = cls === 1 ? -0.55 : cls === 0 ? -0.75 - (rar >= 4 ? 0.2 : 0) : 0;
      if (cls === 2) w.rotation.y = -Math.PI / 2; // (a bow shows its side)
      piv.add(w); piv.scale.setScalar(cls === 1 ? 0.72 : 0.9); piv.rotation.z = Math.PI / 4; model.add(piv);
      g.userData.wtick = w.userData.tick;
      break;
    }
    case D.K_ARMOR: { const a = buildArmor(cls, rar, tier); a.scale.setScalar(1.05); model.add(a); g.userData.wtick = a.userData.tick; break; }
    case D.K_SHIELD:
      if (cls === 0) {
        // a heater shield: a flat top, sides curving to a point; a rim and a boss
        const sh = new THREE.Shape(); sh.moveTo(-0.5, 0.5); sh.lineTo(0.5, 0.5); sh.quadraticCurveTo(0.5, -0.2, 0, -0.65); sh.quadraticCurveTo(-0.5, -0.2, -0.5, 0.5);
        const f = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3, curveSegments: 16 }), accent); f.position.z = -0.04; model.add(f);
        const bar = mesh(box(0.14, 0.95, 0.06), metal); bar.position.set(0, -0.05, 0.1); model.add(bar);
        const bar2 = mesh(box(0.8, 0.14, 0.06), metal); bar2.position.set(0, 0.2, 0.1); model.add(bar2);
        const boss = mesh(sph(0.14, 14, 10), metal); boss.position.set(0, 0.2, 0.12); boss.scale.z = 0.6; model.add(boss);
      }
      else if (cls === 1) { const o = mesh(sph(0.42, 16, 12), new THREE.MeshPhysicalMaterial({ color: rc, emissive: rc, emissiveIntensity: 0.55, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 })); model.add(o); const s = mesh(cyl(0.25, 0.32, 0.18, 10), metal); s.position.y = -0.45; model.add(s); for (let i = 0; i < 3; i++) { const c = mesh(box(0.06, 0.2, 0.06), metal); c.position.set(Math.cos(i * 2.1) * 0.24, -0.32, Math.sin(i * 2.1) * 0.24); c.rotation.z = Math.cos(i * 2.1) * 0.6; model.add(c); } }
      else {
        // a quiver of arrows on a strap
        model.add(mesh(cyl(0.22, 0.17, 1.0, 14), leather));
        const band = mesh(cyl(0.23, 0.23, 0.1, 14), accent); band.position.y = 0.38; model.add(band);
        const band2 = mesh(cyl(0.2, 0.2, 0.08, 14), accent); band2.position.y = -0.3; model.add(band2);
        for (let i = 0; i < 4; i++) { const x = -0.1 + i * 0.07, z = (i & 1) * 0.06 - 0.03; const sft = mesh(cyl(0.015, 0.015, 0.4, 5), mat('shaft', { color: '#c8a070' })); sft.position.set(x, 0.6, z); model.add(sft); const fl = mesh(box(0.1, 0.18, 0.015), mat('fletch', { color: '#f2ece0', roughness: 0.8 })); fl.position.set(x, 0.75, z); model.add(fl); }
        model.rotation.z = 0.4;
      }
      break;
    case D.K_BOOTS: {
      // two boots from a side profile: shaft, heel, rounded toe; a cuff in the rarity's color
      const sh = new THREE.Shape(); sh.moveTo(-0.18, 0.45); sh.lineTo(0.12, 0.45); sh.lineTo(0.12, 0.0); sh.quadraticCurveTo(0.45, -0.02, 0.48, -0.18); sh.lineTo(0.48, -0.28); sh.lineTo(-0.22, -0.28); sh.lineTo(-0.2, 0.0); sh.lineTo(-0.18, 0.45);
      const g2 = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
      for (const s of [-1, 1]) {
        const bt = new THREE.Group();
        bt.add(mesh(g2, rar ? mat('bootl' + rar, { color: new THREE.Color('#6a4426').lerp(new THREE.Color(rc), 0.35), roughness: 0.6 }) : leather));
        const cuff = mesh(box(0.36, 0.1, 0.3), accent); cuff.position.set(-0.03, 0.45, 0.1); bt.add(cuff);
        const sole = mesh(box(0.74, 0.06, 0.3), mat('sole', { color: '#2a1a10', roughness: 0.9 })); sole.position.set(0.13, -0.3, 0.1); bt.add(sole);
        bt.position.set(s * 0.12, 0, s * 0.22 - 0.1); bt.rotation.y = -0.9;
        model.add(bt);
      }
      break;
    }
    case D.K_GLOVES: {
      // a gauntlet: palm, four fingers, a thumb, a flared cuff
      const hand = new THREE.Group();
      const palm = mesh(box(0.42, 0.42, 0.16), accent); hand.add(palm);
      for (let i = 0; i < 4; i++) { const f = mesh(cap(0.055, 0.22 - Math.abs(i - 1.5) * 0.04, 6), accent); f.position.set(-0.15 + i * 0.1, 0.34 - Math.abs(i - 1.5) * 0.02, 0); hand.add(f); }
      const th = mesh(cap(0.06, 0.18, 6), accent); th.position.set(0.26, 0.04, 0.03); th.rotation.z = -0.8; hand.add(th);
      const cuff = mesh(cyl(0.3, 0.23, 0.3, 14), metal); cuff.position.y = -0.34; cuff.scale.z = 0.55; hand.add(cuff);
      const knuck = mesh(box(0.44, 0.08, 0.06), metal); knuck.position.set(0, 0.16, 0.09); hand.add(knuck);
      hand.rotation.z = 0.25;
      model.add(hand);
      break;
    }
    case D.K_HELMET: { const h = buildHelmet(rar, tier); model.add(h); g.userData.wtick = h.userData.tick; break; }
    case D.K_TRINKET: { const r = mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), mat('gold', { color: '#f0b73c', metalness: 1, roughness: 0.25 })); model.add(r); const gem = mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshPhysicalMaterial({ color: rc, emissive: rc, emissiveIntensity: 1, roughness: 0.05, clearcoat: 1 })); gem.position.y = -0.32; model.add(gem); break; }
    case D.K_POTION: { const b = mesh(sph(0.32, 14, 12), new THREE.MeshPhysicalMaterial({ color: '#ff3a4a', emissive: '#a0101a', emissiveIntensity: 0.8, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92 })); model.add(b); const n = mesh(cyl(0.1, 0.12, 0.25, 8), mat('glass', { color: '#d8f0e0', roughness: 0.1 })); n.position.y = 0.32; model.add(n); const c = mesh(cyl(0.11, 0.11, 0.1, 8), mat('cork', { color: '#a87a4a' })); c.position.y = 0.48; model.add(c); break; }
    case D.K_GOLD: {
      const coin = mat('coin', { color: '#f5c242', metalness: 1, roughness: 0.22, emissive: '#5a3a00', emissiveIntensity: 0.7, envMapIntensity: 1.4 });
      for (let i = 0; i < 7; i++) { const c = mesh(cyl(0.22, 0.22, 0.06, 18), coin); c.position.set((i % 3 - 1) * 0.22 + (i > 2 ? 0.1 : 0), -0.25 + Math.floor(i / 3) * 0.07 + (i === 6 ? 0.14 : 0), (i & 1) * 0.15); c.rotation.set(0.2 * (i & 1), i, 0.1 * (i % 3)); model.add(c); }
      break;
    }
  }
  model.position.y = 1.0;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // the rarity's glow: a ring on the floor, a beam from rare up
  if (kind !== D.K_GOLD && kind !== D.K_POTION) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ map: TEX.soft, color: rc, transparent: true, opacity: rar >= 1 ? 0.55 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; g.add(disc);
    if (rar >= 2) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4 + rar * 0.08, 0.7 + rar * 0.1, 7 + rar * 1.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.16 + rar * 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = (7 + rar * 1.5) / 2; g.add(beam); g.userData.beam = beam;
    }
    if (rar >= 3) { const l = new THREE.PointLight(rc, 8 + rar * 3, 8, 2); l.position.y = 1.4; g.add(l); }
  }
  g.userData.model = model;
  g.userData.anim = (t, seed) => { if (g.userData.wtick) g.userData.wtick(t); model.rotation.y = t * 1.6 + seed; model.position.y = 1.0 + Math.sin(t * 3 + seed) * 0.15; if (g.userData.beam) g.userData.beam.material.opacity = 0.14 + Math.sin(t * 4 + seed) * 0.04 + (rar * 0.03); };
  return g;
}
