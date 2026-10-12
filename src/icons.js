// ============================================================================
//  DUNGEON HEART  -  icons: the game's own 3D models rendered into small
//  pictures for the menus (gear, potions, the heroes' portraits). Each is
//  rendered once and kept.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildItem, buildHero, equipHeroWeapon, animHero, buildMerchant } from './models.js';

const SIZE = 128;
let R = null, scene, cam;
const cache = {};
function init() {
  const c = document.createElement('canvas');
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setSize(SIZE, SIZE, false);
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(R), 0.04).texture;
  scene.add(new THREE.HemisphereLight('#fff2e0', '#3a2a20', 1.1));
  const key = new THREE.DirectionalLight('#fff0dc', 2.2); key.position.set(-3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc8ff', 1.4); rim.position.set(4, 2, -5); scene.add(rim);
  cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
}
// frame an object: centered, filling `fill` of the picture
function shoot(obj, { size = SIZE, fill = 0.82, pitch = 0.32, w = size, h = size } = {}) {
  if (!R) init();
  R.setSize(w, h, false);
  cam.aspect = w / h;
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.y, s.x / cam.aspect, s.z * 0.6) / 2 / fill;
  const d = r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(c.x, c.y + Math.sin(pitch) * d, c.z + Math.cos(pitch) * d);
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  R.render(scene, cam);
  scene.remove(obj);
  return R.domElement.toDataURL('image/png');
}
// gear and potions: the model the floor shows, turned to face you
export function itemPic(kind, rar, cls, tier = 0) {
  if (kind !== 1 && kind !== 2 && kind !== 6) tier = 0; // (weapons, armor and helmets look different by tier)
  const key = 'i' + kind + '_' + rar + '_' + cls + '_' + tier;
  if (cache[key]) return cache[key];
  try {
    const g = buildItem(kind, rar, cls, tier), m = g.userData.model;
    if (g.userData.wtick) g.userData.wtick(1.3);
    g.remove(m);
    m.position.set(0, 0, 0);
    m.rotation.y += 0.5;
    return (cache[key] = shoot(m, { fill: 0.86, pitch: kind === 2 ? 0.12 : 0.32 }));
  } catch (e) { return (cache[key] = ''); }
}
// a hero standing, for the class choice and the character screen
export function heroPic(cls, w = 200, h = 260) {
  const key = 'h' + cls + '_' + w + 'x' + h;
  if (cache[key]) return cache[key];
  try {
    const hero = buildHero(cls);
    equipHeroWeapon(hero, cls, 0, 0);
    animHero(hero, 0.4, { walk: 0, move: 0, swing: -1, whirl: false, cast: -1, roll: 0, orbColor: cls === 1 ? '#9fd8ff' : null });
    hero.rotation.y = -0.45;
    return (cache[key] = shoot(hero, { w, h, fill: 0.9, pitch: 0.12 }));
  } catch (e) { return (cache[key] = ''); }
}
// the traveling merchant, for his shop
export function merchantPic() {
  if (cache.m) return cache.m;
  try { const m = buildMerchant(); if (m.userData.anim) m.userData.anim(0.3, { moving: 0 }); m.rotation.y = 0.5; return (cache.m = shoot(m, { w: 180, h: 200, fill: 0.92, pitch: 0.15 })); }
  catch (e) { return (cache.m = ''); }
}
