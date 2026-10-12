// ============================================================================
//  DUNGEON HEART  -  ui: the HUD, the numbers and banners, and every screen
//  (title, class, story, gear and bag, talents, merchant, trade, pause,
//  options, death, victory). Touch, mouse, keys and controllers all work.
// ============================================================================
import * as S from './sim.js';
import * as D from './data.js';
import { camera, V3 } from './engine.js';
import { sfx, startAudio, setMusic, setSfx, audioState } from './audio.js';
import { menuKeys, input } from './input.js';
import { itemPic, heroPic, merchantPic, petPic } from './icons.js';
import { PET_NAMES } from './pets.js';
import { talGlyph } from './glyphs.js';
const G = S.G;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const tc = s => s.toLowerCase().replace(/(^|\s|-)\S/g, m => m.toUpperCase());

export const UI = { modal: null, hooks: {}, toastT: 0, bannerT: 0, msgId: -1, lastHud: {}, sel: null, talSel: 0, marks: new Set(), sellArm: -1 };

// ---------------------------------------------------------------- screens
const SCREENS = ['sTitle', 'sClass', 'sStory', 'sInv', 'sTal', 'sName', 'sShop', 'sTrade', 'sPause', 'sOpt', 'sDead', 'sWin'];
export function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  UI.modal = id;
  if (id) { $('banner').classList.remove('on'); UI.bannerT = 0; }
  const play = !id || id === null;
  $('hud').hidden = !(G.state === 'play' || G.state === 'rescue') || (id && id !== 'sInv' && id !== 'sTal' && id !== 'sShop' && id !== 'sTrade' && id !== 'sPause' && id !== 'sDead');
  $('touch').hidden = !!id || !(G.state === 'play');
  $('minimap').hidden = !!id || G.state !== 'play';
  if (id) {
    setTimeout(() => { const f = firstFocus(); if (f && input.lastDevice !== 'touch') f.focus({ preventScroll: true }); }, 30);
  }
  UI.hooks.onModal && UI.hooks.onModal(id);
}
function firstFocus() {
  const s = UI.modal && $(UI.modal);
  if (!s) return null;
  return s.querySelector('.sel,.btn:not([disabled]):not([hidden]),button.card') || s.querySelector('button:not([disabled])');
}
// arrow keys and the d-pad move the focus to the nearest button that way
function navigate(dir) {
  const s = $(UI.modal);
  if (!s) return;
  const els = [...s.querySelectorAll('button:not([disabled]),input')].filter(e => e.offsetParent !== null && !e.closest('[hidden]'));
  const cur = document.activeElement && s.contains(document.activeElement) ? document.activeElement : null;
  if (!cur) { (els[0] || {}).focus && els[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bd = 1e9;
  for (const e of els) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
    let main, side;
    if (dir === 'up') { main = -y; side = Math.abs(x); } else if (dir === 'down') { main = y; side = Math.abs(x); }
    else if (dir === 'left') { main = -x; side = Math.abs(y); } else { main = x; side = Math.abs(y); }
    if (main <= 4) continue;
    const d = main + side * 2.2;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) { best.focus({ preventScroll: false }); if (best.dataset.focusSel) best.click(); }
  else if (cur.tagName === 'INPUT' && (dir === 'left' || dir === 'right')) { cur.value = +cur.value + (dir === 'right' ? 1 : -1); cur.dispatchEvent(new Event('input')); }
}
export function menuStep() {
  const ks = menuKeys();
  for (const k of ks) {
    if (!UI.modal) {
      if (G.state !== 'play') continue;
      if (k === 'bag') openInv();
      else if (k === 'back' && input.lastDevice === 'kb' || k === 'pause') openPause();
      continue;
    }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') { navigate(k); continue; }
    if (k === 'ok') { const a = document.activeElement; if (a && $(UI.modal).contains(a)) { a.click(); } continue; }
    if (k === 'back' || (k === 'bag' && (UI.modal === 'sInv' || UI.modal === 'sTal'))) { back(); continue; }
    if (k === 'lb' && UI.modal === 'sTal') { $('bTalGear').click(); continue; }
    if (k === 'rb' && UI.modal === 'sInv') { openTal(); continue; }
    if (k === 'pot' && UI.modal === 'sInv' && UI.sel && UI.sel.bag !== undefined) { sellSel(); continue; }
  }
}
function back() {
  switch (UI.modal) {
    case 'sClass': title(); break;
    case 'sInv': case 'sTal': case 'sPause': closeModal(); break;
    case 'sShop': leaveShop(); break;
    case 'sTrade': openShopScreen(); break;
    case 'sOpt': show(UI.optBack || 'sTitle'); break;
    default: break;
  }
}
export function closeModal() { S.save_game(); show(null); }

// ---------------------------------------------------------------- title, class, story
export function title() {
  G.state = 'title';
  $('bCont').hidden = !S.has_save();
  show('sTitle');
  UI.hooks.title && UI.hooks.title();
}
const CLASS_TIP = ['Warrior: swings hit everything in front of you, and you can roll out of danger.',
  'Mage: fire, frost or arcane bolts from afar, and a blink through danger. Fragile!',
  'Hunter: the hardest-hitting arrows. Shoot a weak slime, bat or spider, then tame it as a pet.'];
function classTip(c) { $('classTip').textContent = CLASS_TIP[c]; }
$('bNew').onclick = () => {
  startAudio(); sfx('pickup');
  for (const im of document.querySelectorAll('[data-hero]')) if (!im.src) im.src = heroPic(+im.dataset.hero);
  show('sClass'); classTip(0); UI.hooks.classPreview && UI.hooks.classPreview(0);
};
$('bCont').onclick = () => { startAudio(); sfx('door'); fadeThen(() => { if (S.load_game()) { show(null); } else title(); }); };
$('bOpt').onclick = () => { startAudio(); UI.optBack = 'sTitle'; openOptions(); };
for (const c of document.querySelectorAll('.card')) {
  c.onclick = () => { sfx('levelup'); UI.cls = +c.dataset.cls; show('sStory'); UI.hooks.story && UI.hooks.story(UI.cls); };
  c.onfocus = c.onmouseenter = () => { classTip(+c.dataset.cls); UI.hooks.classPreview && UI.hooks.classPreview(+c.dataset.cls); };
}
$('bClassBack').onclick = () => title();
$('bStory').onclick = () => { sfx('door'); fadeThen(() => { S.new_hero(UI.cls); S.start_room(); show(null); }); };

// ---------------------------------------------------------------- options
const qBtns = [...$('oQual').querySelectorAll('button')];
function openOptions() {
  $('oMusic').value = Math.round(audioState.music * 10); $('oSfx').value = Math.round(audioState.sfx * 10);
  $('oMusicV').textContent = $('oMusic').value; $('oSfxV').textContent = $('oSfx').value;
  qBtns.forEach(b => b.classList.toggle('on', +b.dataset.q === UI.quality));
  show('sOpt');
}
$('oMusic').oninput = () => { $('oMusicV').textContent = $('oMusic').value; setMusic($('oMusic').value / 10); UI.hooks.saveOpts && UI.hooks.saveOpts(); };
$('oSfx').oninput = () => { $('oSfxV').textContent = $('oSfx').value; setSfx($('oSfx').value / 10); sfx('pickup'); UI.hooks.saveOpts && UI.hooks.saveOpts(); };
qBtns.forEach(b => b.onclick = () => { UI.quality = +b.dataset.q; qBtns.forEach(x => x.classList.toggle('on', x === b)); UI.hooks.quality && UI.hooks.quality(UI.quality); UI.hooks.saveOpts && UI.hooks.saveOpts(); });
$('bOptBack').onclick = () => back();

// ---------------------------------------------------------------- pause
function openPause() { sfx('pickup'); show('sPause'); }
$('hPause').onclick = () => openPause();
$('bResume').onclick = () => closeModal();
$('bPauseBag').onclick = () => openInv();
$('bPauseOpt').onclick = () => { UI.optBack = 'sPause'; openOptions(); };
$('bQuit').onclick = () => { S.save_game(); title(); };

// ---------------------------------------------------------------- death, victory
export function dead() { $('deadWhere').textContent = 'on floor ' + G.floor_num; setTimeout(() => show('sDead'), 900); }
$('bRetry').onclick = () => { sfx('door'); fadeThen(() => { S.respawn(); show(null); }); };
export function win() {
  $('winStats').textContent = `Level ${G.lvl} · ${G.kills} monsters · ${G.gold} gold`;
  setTimeout(() => show('sWin'), 600);
}
$('bWin').onclick = () => { title(); };

// ---------------------------------------------------------------- the character screen (as on the SNES)
// gear around the hero: helmet, gloves / armor, boots / weapon, trinket, shield
const DOLL = [[D.K_HELMET, 1, 1], [D.K_GLOVES, 3, 1], [D.K_ARMOR, 1, 2], [D.K_BOOTS, 3, 2], [D.K_WEAPON, 1, 3], [D.K_TRINKET, 2, 3], [D.K_SHIELD, 3, 3]];
function slotLabel(kind) {
  if (kind === D.K_SHIELD) return ['SHIELD', 'ORB', 'QUIVER'][G.player_class];
  return D.KIND_NAME[kind];
}
const pic = (kind, rar, tier = 0) => itemPic(kind, rar, G.player_class, tier);
// an item's stats as colored chips: +7 STR +5 STA (arr: b_st / eq_st / sh_st / i_st, k: slot)
export function statHTML(arr, k) {
  let h = '';
  for (let j = 0; j < 3; ++j) { const t = arr[k * 6 + j * 2], v = arr[k * 6 + j * 2 + 1]; if (t) h += `<b style="color:${D.STAT_COLOR[t]}">+${v} ${D.STAT_NAME[t]}</b>`; }
  return h ? `<div class="sts">${h}</div>` : '';
}
export function statText(arr, k) {
  const o = [];
  for (let j = 0; j < 3; ++j) { const t = arr[k * 6 + j * 2]; if (t) o.push(`+${arr[k * 6 + j * 2 + 1]} ${D.STAT_NAME[t]}`); }
  return o.join(' ');
}
const coinTxt = n => `<span class="coin"></span>${n}`;
function slotHTML(kind, rar, lv, ghost, tier = 0) {
  return `<img alt="" src="${pic(kind, ghost ? 0 : rar, ghost ? 0 : tier)}">${!ghost && kind !== D.K_TRINKET && lv ? `<span class="lv">${lv}</span>` : ''}`;
}
function styleSlot(b, rar, full) { b.style.setProperty('--rc', full ? D.RAR_COLOR[rar] : '#8a6428'); b.classList.toggle('full', !!full); }
export function openInv() {
  sfx('pickup');
  UI.sel = UI.sel || { bag: 0 };
  UI.sellArm = -1;
  show('sInv');
  drawInv();
  focusSel();
}
$('hBag').onclick = () => openInv();
$('bInvClose').onclick = () => closeModal();
$('bTalents').onclick = () => openTal();
const isUpgrade = k => S.bag_better(k); // (level and stats together, weighed for your class)
function drawInv() {
  $('invName').textContent = `${D.CLASS_NAME[G.player_class]} LV ${G.lvl}`;
  $('invXp').style.width = `calc(${Math.min(100, G.xp / G.xpnext * 100)}% - 4px)`;
  $('invHp').textContent = `HP ${G.hp}/${G.maxhp}`;
  $('invHpBar').style.width = `calc(${G.hp / G.maxhp * 100}% - 4px)`;
  $('invGold').innerHTML = coinTxt(G.gold);
  $('invPots').innerHTML = `<img alt="" src="${pic(D.K_POTION, 0)}" style="width:22px;height:22px;vertical-align:-5px">${G.potions}`;
  const spd = S.spd_fine();
  $('invSpd').textContent = `SPD ${spd >= 0 ? '+' : ''}${spd}`;
  $('invAtk').innerHTML = `ATK ${S.atk_fine()} &nbsp; DEF ${S.total_def()}`;
  const main = D.MAIN_STAT[G.player_class];
  const tip = ['', 'warrior damage', 'hunter damage · crit on gear', 'mage damage', 'max health', 'less damage taken'];
  $('invStats').innerHTML = [1, 2, 3, 4, 5].map(t => `<span class="${t === main ? 'main' : ''}" style="--c:${D.STAT_COLOR[t]}" title="${D.STAT_LONG[t]}: ${tip[t]}">${D.STAT_NAME[t]}<b>${S.stat_total(t)}</b></span>`).join('');
  // the doll
  const dl = $('doll');
  dl.innerHTML = '';
  const al = document.createElement('div'); al.className = 'alcove'; al.innerHTML = `<img alt="" src="${heroPic(G.player_class)}">`;
  dl.appendChild(al);
  for (const [kind, cx, cy] of DOLL) {
    const i = kind - 1, has = G.eq_has[i];
    const b = document.createElement('button');
    b.className = 'slot' + (has ? '' : ' ghost') + (UI.sel && UI.sel.gear === i ? ' sel' : '');
    b.style.gridColumn = cx; b.style.gridRow = cy;
    b.innerHTML = slotHTML(kind, G.eq_rar[i], G.eq_lvl[i], !has, G.eq_tier[i]);
    styleSlot(b, G.eq_rar[i], has);
    b.onclick = () => { if (UI.sel && UI.sel.gear === i && input.lastDevice !== 'touch') { unequipSel(); return; } UI.sel = { gear: i }; UI.sellArm = -1; drawInv(); focusSel(); };
    b.setAttribute('aria-label', slotLabel(kind));
    dl.appendChild(b);
  }
  // the bag
  const bg = $('bagGrid');
  bg.innerHTML = '';
  let n = 0;
  for (let k = 0; k < D.BAG; k++) {
    const kind = G.b_kind[k];
    if (kind) n++;
    const b = document.createElement('button');
    b.className = 'slot' + (UI.sel && UI.sel.bag === k ? ' sel' : '') + (isUpgrade(k) ? ' up' : '');
    if (kind) b.innerHTML = slotHTML(kind, G.b_rar[k], G.b_lvl[k], false, G.b_tier[k]);
    styleSlot(b, G.b_rar[k], kind);
    b.onclick = () => { if (UI.sel && UI.sel.bag === k && input.lastDevice !== 'touch') { equipSel(); return; } UI.sel = { bag: k }; UI.sellArm = -1; drawInv(); focusSel(); };
    b.setAttribute('aria-label', kind ? S.item_name(kind, G.b_rar[k], G.b_tier[k]) : 'Empty');
    bg.appendChild(b);
  }
  $('bagTitle').textContent = `BAG ${n}/${D.BAG}`;
  const pts = S.tal_avail();
  $('talPts').textContent = pts ? pts : '';
  drawInfo();
}
function focusSel() { setTimeout(() => { const s = $(UI.modal || 'sInv').querySelector('.sel'); if (s && input.lastDevice !== 'touch') s.focus({ preventScroll: true }); }, 0); }
// the box under the screen: what the picked item is, and what you can do with it
function itemLines(kind, rar, lv, spec, val, worn, sa, sk) {
  const stats = statHTML(sa, sk);
  if (kind === D.K_TRINKET) {
    const tt = S.trinket_talents(spec, val);
    return stats + tt.map(([t, c]) => `<p><b>+${c} ${D.TAL_NAME[G.player_class * D.NTAL + t]}</b> (talent ranks)</p>`).join('');
  }
  const v = S.gear_fine(kind, lv), w = S.worn_fine(kind), d = v - w;
  return stats + `<p>${S.stat_name(kind)} <b>${v}</b>${worn ? ' &nbsp;WORN' : ` &nbsp;<b style="color:${d >= 0 ? '#7dff86' : '#ff6a55'}">(${d >= 0 ? '+' : ''}${d} vs worn)</b>`}</p>`
    + `<p>${spec ? `<b style="color:${D.RAR_COLOR[4]}">${D.SPEC_NAME[spec]}</b>: ${D.SPEC_DESC[spec]}` : 'No special power'}</p>`;
}
function itemTitle(kind, rar, tier, lv) {
  return `<h3 style="color:${D.RAR_COLOR[rar]}">${esc(D.RAR_NAME[rar])} ${esc(S.item_name(kind, rar, tier))}${kind !== D.K_TRINKET ? ' LV' + lv : ''}</h3>`;
}
function drawInfo() {
  const box = $('invInfo'), sel = UI.sel || {};
  let kind, rar, tier, lv, spec, val, worn = false, sa, sk;
  if (sel.gear !== undefined) {
    const i = sel.gear;
    if (!G.eq_has[i]) { box.innerHTML = `<h3>${slotLabel(i + 1)}</h3><p>Nothing worn here. Pick something from your bag to wear it.</p>`; return; }
    kind = i + 1; rar = G.eq_rar[i]; tier = G.eq_tier[i]; lv = G.eq_lvl[i]; spec = G.eq_spec[i]; val = G.eq_val[i]; worn = true; sa = G.eq_st; sk = i;
  } else if (sel.bag !== undefined) {
    const k = sel.bag;
    if (!G.b_kind[k]) { box.innerHTML = `<h3>Empty</h3><p>Loot you pick up lands in your bag.</p>`; return; }
    kind = G.b_kind[k]; rar = G.b_rar[k]; tier = G.b_tier[k]; lv = G.b_lvl[k]; spec = G.b_spec[k]; val = G.b_val[k]; sa = G.b_st; sk = k;
  } else { box.innerHTML = ''; return; }
  let acts = '';
  if (worn) acts = sel.gear ? `<button class="mbtn" id="aUnequip">Unequip</button>` : '';
  else acts = `<button class="mbtn go" id="aEquip">Equip</button><button class="mbtn${UI.sellArm === sel.bag ? ' warn' : ''}" id="aSell">${UI.sellArm === sel.bag ? 'Tap again to sell for ' : 'Sell for '}<span class="coin"></span>${S.sell_price(kind, rar, val)}</button>`;
  const verdict = worn ? '' : S.bag_better(sel.bag) ? '<p><b style="color:#7dff86">&#x25B2; Better for you than what you wear</b></p>' : '<p style="color:#8a92b0">Not better than what you wear</p>';
  box.innerHTML = itemTitle(kind, rar, tier, lv) + itemLines(kind, rar, lv, spec, val, worn, sa, sk) + verdict + `<div class="acts">${acts}</div>`;
  if ($('aEquip')) $('aEquip').onclick = equipSel;
  if ($('aSell')) $('aSell').onclick = sellSel;
  if ($('aUnequip')) $('aUnequip').onclick = unequipSel;
}
function equipSel() { if (UI.sel && UI.sel.bag !== undefined && G.b_kind[UI.sel.bag]) { S.bag_equip(UI.sel.bag); sfx('pickup'); drawInv(); focusSel(); } }
function unequipSel() { if (UI.sel && UI.sel.gear !== undefined) { S.gear_unequip(UI.sel.gear); drawInv(); focusSel(); } }
function sellSel() {
  const k = UI.sel && UI.sel.bag;
  if (k === undefined || !G.b_kind[k]) return;
  if (UI.sellArm !== k) { UI.sellArm = k; sfx('nope'); drawInfo(); return; }
  S.bag_sell(k); sfx('coin'); UI.sellArm = -1; drawInv(); focusSel();
}

// ---------------------------------------------------------------- talents (three trees of medallions)
function openTal() { sfx('pickup'); show('sTal'); drawTal(); focusSel(); }
$('bTalClose').onclick = () => closeModal();
$('bTalGear').onclick = () => { show('sInv'); drawInv(); focusSel(); };
function drawTal() {
  const cls = G.player_class, wrap = $('trees'), pts = S.tal_avail();
  $('talTitle').textContent = `${D.CLASS_NAME[cls]} TALENTS`;
  $('talPoints').textContent = `POINTS ${pts}`;
  wrap.innerHTML = '';
  for (let tr = 0; tr < 3; tr++) {
    const div = document.createElement('div'); div.className = 'tree'; div.style.setProperty('--c', D.TREE_COLOR[cls * 3 + tr]);
    div.innerHTML = `<h3>${D.TREE_NAME[cls * 3 + tr]}</h3>`;
    const tl = document.createElement('div'); tl.className = 'tl';
    for (let r = 0; r < 5; r++) {
      const idx = tr * 5 + r, max = D.TAL_MAX[idx], have = Math.min(max, G.tal[idx] + S.trinket_bonus(idx));
      const b = document.createElement('button');
      b.className = 'tal' + (S.tal_unlocked(idx) ? '' : ' lock') + (have ? '' : ' zero') + (UI.talSel === idx ? ' sel' : '') + (have >= max ? ' max' : '');
      b.innerHTML = `<span class="med">${talGlyph(cls * D.NTAL + idx)}</span><span class="rk">${have}/${max}${S.trinket_bonus(idx) ? '+' : ''}</span><span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('')}</span>`;
      b.setAttribute('aria-label', D.TAL_NAME[cls * D.NTAL + idx]);
      b.onclick = () => { if (UI.talSel === idx && input.lastDevice !== 'touch') { learn(); return; } UI.talSel = idx; UI.resetArm = 0; drawTal(); focusSel(); };
      tl.appendChild(b);
    }
    div.appendChild(tl); wrap.appendChild(div);
  }
  const idx = UI.talSel, r = G.tal[idx], tb = S.trinket_bonus(idx), max = D.TAL_MAX[idx];
  let state;
  if (!S.tal_unlocked(idx)) state = `Locked: ${(idx % 5) * 3} points in ${D.TREE_NAME[cls * 3 + Math.floor(idx / 5)]} first.`;
  else if (r >= max) state = 'Maxed out.';
  else if (pts) state = `${pts} point${pts > 1 ? 's' : ''} to spend.`;
  else state = 'No points left. Every second level gives one.';
  const cost = S.tal_cost() * 20, can = S.tal_unlocked(idx) && r < max && pts;
  $('talInfo').innerHTML = `<h3 style="color:${D.TREE_COLOR[cls * 3 + Math.floor(idx / 5)]}">${D.TAL_NAME[cls * D.NTAL + idx]}${tb ? ` <span style="color:#ffe0a0;font-size:15px">+${tb} trinket</span>` : ''} <span style="float:right;color:#fff;font-size:16px">RANK ${Math.min(max, r + tb)}/${max}</span></h3>
    <p><b>${D.TAL_DESC[cls * D.NTAL + idx]}</b></p><p>${state}</p>
    <div class="acts"><button class="mbtn go" id="aLearn" ${can ? '' : 'disabled'}>Learn</button>
    <button class="mbtn${UI.resetArm ? ' warn' : ''}" id="aReset" ${S.tal_cost() ? '' : 'disabled'}>${UI.resetArm ? 'Tap again: reset for ' : 'Reset '}<span class="coin"></span>${cost}</button></div>`;
  $('aLearn').onclick = learn;
  $('aReset').onclick = () => { if (!UI.resetArm) { UI.resetArm = 1; sfx('nope'); drawTal(); return; } UI.resetArm = 0; S.tal_reset(); drawTal(); };
}
function learn() { if (S.tal_learn(UI.talSel)) { sfx('levelup'); UI.resetArm = 0; drawTal(); focusSel(); } else sfx('nope'); }

// ---------------------------------------------------------------- the merchant
export function openShop() { sfx('buy'); openShopScreen(); }
function openShopScreen() {
  $('shopSay').textContent = '';
  $('shopPicL').src = $('shopPicR').src = merchantPic();
  show('sShop');
  drawShop();
}
function drawShop(focusK) {
  $('shopGold').innerHTML = coinTxt(G.gold);
  const list = $('shopList');
  list.innerHTML = '';
  for (let k = 0; k < 4; k++) {
    let ic, name, det, col = '#fff', rc = '#8a6428';
    if (k === 0) { ic = pic(D.K_POTION, 0); name = 'Health potion'; det = 'Restores all your health'; }
    else if (k === 3) { ic = pic(D.K_GOLD, 0); name = 'Mystery chest'; det = G.floor_num < 5 ? 'Uncommon or rare gear (epic if lucky)' : G.floor_num < 10 ? 'Rare or epic gear (legendary if lucky)' : 'Rare, epic or legendary gear'; }
    else {
      const kind = G.sh_kind[k], rar = G.sh_rar[k], lv = G.sh_lvl[k];
      ic = pic(kind, rar, G.sh_tier[k]); col = rc = D.RAR_COLOR[rar];
      name = `${D.RAR_NAME[rar]} ${S.item_name(kind, rar, G.sh_tier[k])}${G.sh_spec[k] ? ' · ' + D.SPEC_NAME[G.sh_spec[k]] : ''}`;
      const v = S.gear_fine(kind, lv), d = v - S.worn_fine(kind);
      det = `LV ${lv} · ${S.stat_name(kind)} ${v} (${d >= 0 ? '+' : ''}${d} vs worn)${statText(G.sh_st, k) ? ' · ' + statText(G.sh_st, k) : ''}`;
    }
    const b = document.createElement('button');
    b.className = 'ware' + (G.sh_sold[k] ? ' sold' : '');
    b.innerHTML = `<span class="ic" style="--rc:${rc}"><img alt="" src="${ic}"></span><span><b style="color:${col}">${esc(tc(name))}</b><span>${G.sh_sold[k] ? 'Sold out' : det}</span></span><span class="pr"><span class="coin"></span>${G.sh_price[k]}</span>`;
    b.onclick = () => { const say = S.shop_buy(k); $('shopSay').textContent = say; drawShop(k); };
    list.appendChild(b);
  }
  const tr = document.createElement('button'); tr.className = 'ware cmd'; tr.innerHTML = '<b>Trade up (3 for 1)</b>';
  tr.onclick = () => { UI.marks = new Set(); UI.tradeSel = 0; show('sTrade'); drawTrade(); focusSel(); };
  const lv = document.createElement('button'); lv.className = 'ware cmd'; lv.innerHTML = '<b>Leave</b>';
  lv.onclick = () => leaveShop();
  list.append(tr, lv);
  if (focusK !== undefined && input.lastDevice !== 'touch') list.children[focusK].focus();
}
function leaveShop() { S.shop_close(); show(null); }

// ---------------------------------------------------------------- trade up: pick from the bag, get one better
$('bTradeBack').onclick = () => openShopScreen();
function drawTrade() {
  $('tradeGold').innerHTML = coinTxt(G.gold);
  const marks = [...UI.marks];
  const rar = marks.length ? G.b_rar[marks[0]] : -1;
  const need = S.trade_need(marks.length, rar);
  // the picked ones, and the slots still to fill
  const pk = $('tradePick');
  pk.innerHTML = '';
  for (let i = 0; i < need; i++) {
    const d = document.createElement('div'); d.className = 'slot'; d.style.cursor = 'default';
    const k = marks[i];
    if (k !== undefined) { d.innerHTML = slotHTML(G.b_kind[k], G.b_rar[k], G.b_lvl[k], false, G.b_tier[k]); styleSlot(d, G.b_rar[k], 1); }
    pk.appendChild(d);
  }
  const res = $('tradeRes');
  const to = rar < 0 ? -1 : Math.min(D.RAR_LEG, rar + (rar === D.RAR_LEG ? 0 : 1));
  styleSlot(res, Math.max(0, to), to >= 0);
  $('tradeEq').innerHTML = rar < 0 ? '' : `${need} ${D.RAR_NAME[rar]}<br>= 1 ${rar === D.RAR_LEG ? 'BETTER ' : ''}${D.RAR_NAME[to]}`;
  $('tradeEq').style.color = rar < 0 ? '' : D.RAR_COLOR[to];
  // the bag
  const grid = $('tradeGrid');
  grid.innerHTML = '';
  let n = 0;
  for (let k = 0; k < D.BAG; k++) {
    const kind = G.b_kind[k];
    if (kind) n++;
    const b = document.createElement('button');
    b.className = 'slot' + (UI.marks.has(k) ? ' mark' : '') + (UI.tradeSel === k ? ' sel' : '');
    if (kind) b.innerHTML = slotHTML(kind, G.b_rar[k], G.b_lvl[k], false, G.b_tier[k]);
    styleSlot(b, G.b_rar[k], kind);
    b.onclick = () => {
      UI.tradeSel = k;
      if (!kind) { sfx('nope'); drawTrade(); focusSel(); return; }
      if (UI.marks.has(k)) UI.marks.delete(k);
      else {
        if (kind === D.K_TRINKET) { $('tradeSay').textContent = "Trinkets can't be traded."; sfx('nope'); drawTrade(); focusSel(); return; }
        if (UI.marks.size && G.b_rar[k] !== rar) { $('tradeSay').textContent = 'They must all be the same rarity.'; sfx('nope'); drawTrade(); focusSel(); return; }
        if (UI.marks.size >= S.trade_need(UI.marks.size + 1, G.b_rar[k])) { sfx('nope'); return; }
        UI.marks.add(k);
      }
      sfx('pickup'); $('tradeSay').innerHTML = describe(k); drawTrade(); focusSel();
    };
    grid.appendChild(b);
  }
  $('tradeBagT').textContent = `BAG ${n}/${D.BAG}`;
  const ok = marks.length && marks.length === need;
  const fee = rar >= D.RAR_EPIC ? Math.floor(G.gold / 5) : Math.floor(G.gold / 10);
  $('bTradeGo').disabled = !ok;
  $('bTradeGo').innerHTML = !marks.length ? 'Trade' : ok ? `Trade (fee <span class="coin"></span>${fee})` : `Pick ${need - marks.length} more`;
}
function describe(k) {
  const kind = G.b_kind[k];
  return `<b style="color:${D.RAR_COLOR[G.b_rar[k]]}">${esc(D.RAR_NAME[G.b_rar[k]])} ${esc(S.item_name(kind, G.b_rar[k], G.b_tier[k]))}${kind !== D.K_TRINKET ? ' LV' + G.b_lvl[k] : ''}</b>${UI.marks.has(k) ? ' · picked' : ''}`;
}
$('bTradeGo').onclick = () => {
  const r = S.trade([...UI.marks]);
  UI.marks = new Set();
  if (r) {
    const k = r.slot;
    sfx(G.b_rar[k] >= D.RAR_LEG ? 'legend' : 'rare');
    $('tradeSay').innerHTML = `You got ${describe(k)}! Paid ${r.fee}g.`;
    UI.tradeSel = k;
  }
  drawTrade();
};

// ---------------------------------------------------------------- HUD, numbers, banners
const nums = [];
export function num(x, y, z, text, cls = '') {
  const el = document.createElement('div'); el.className = 'num ' + cls; el.textContent = text; $('nums').appendChild(el);
  nums.push({ el, x: x + (Math.random() - 0.5) * 0.8, y, z, t: 0 });
}
const tv = new V3();
function stepNums(dt) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i]; n.t += dt;
    if (n.t > 0.9) { n.el.remove(); nums.splice(i, 1); continue; }
    tv.set(n.x, n.y + n.t * 2.4, n.z).project(camera);
    n.el.style.left = ((tv.x + 1) / 2 * innerWidth) + 'px'; n.el.style.top = ((1 - tv.y) / 2 * innerHeight) + 'px';
    n.el.style.opacity = n.t < 0.6 ? 1 : 1 - (n.t - 0.6) / 0.3;
    const s = n.t < 0.12 ? 0.6 + n.t / 0.12 * 0.6 : 1.2 - Math.min(0.2, (n.t - 0.12));
    n.el.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
}
export function banner(title, sub, t = 2) { $('bTitle').textContent = title; $('bSub').textContent = sub; $('banner').classList.add('on'); UI.bannerT = t; }
export function hurt() { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 160); }
let flashA = 0;
export function flash(col, a = 0.7) { $('flash').style.background = col; flashA = Math.max(flashA, a); }
export function lootCard(e) {
  const k = e.slot;
  if (k === undefined) return;
  const kind = G.b_kind[k], rar = G.b_rar[k];
  if (!kind) return;
  $('lootIc').innerHTML = `<img alt="" src="${itemPic(kind, rar, G.player_class, G.b_tier[k])}" style="width:46px;height:46px">`;
  $('lootT').textContent = tc(`${D.RAR_NAME[rar]} ${S.item_name(kind, rar, G.b_tier[k])}`);
  $('lootT').style.color = D.RAR_COLOR[rar];
  const st = statText(G.b_st, k);
  if (kind === D.K_TRINKET) $('lootS').textContent = (st ? st + ' · ' : '') + S.trinket_talents(G.b_spec[k], G.b_val[k]).map(([t, c]) => `+${c} ${tc(D.TAL_NAME[G.player_class * D.NTAL + t])}`).join(', ');
  else $('lootS').textContent = `LV${G.b_lvl[k]} · ${S.stat_name(kind)} ${S.gear_fine(kind, G.b_lvl[k])}${st ? ' · ' + st : ''}${e.better ? ' · UPGRADE!' : ''}`;
  $('loot').style.boxShadow = `inset 0 0 0 2px ${D.RAR_COLOR[rar]}, 0 10px 24px rgba(0,0,0,.45)`;
  $('loot').classList.add('on');
  UI.toastT = 3.2;
  if (e.better) $('hBag').classList.add('alert');
}
export function roomStart() {
  if (G.room_num === 1) banner('FLOOR ' + G.floor_num, D.THEME_NAME[G.theme] + ' · ' + D.MOD_NAME[G.fmod], 2.2);
  else if (G.room_num === D.BOSS_ROOM) { /* bossIntro */ }
  else if (G.sp) banner(['', 'TREASURE ROOM', 'SHRINE', 'FOUNTAIN', 'THE ARENA', 'TRAPPED ROOM'][G.sp], 'ROOM ' + G.room_num + ' OF 5', 1.6);
  fadeIn();
  drawMinimap();
}
export function bossIntro() {
  if (G.floor_num === D.LAST_FLOOR) banner('THE TOWER KING', 'SHE IS MINE! TURN BACK!', 3);
  else banner(S.boss_name(), ['EASY', 'MEDIUM', 'HARD'][G.boss_tier] + ' · ' + D.BOSS_ART_NAME[G.boss_art], 2.2);
}
function fadeIn() { $('fade').style.opacity = 0; }
export function fadeThen(f) { $('fade').style.opacity = 1; setTimeout(() => { f(); setTimeout(fadeIn, 60); }, 300); }
function setText(id, v) { if (UI.lastHud[id] !== v) { UI.lastHud[id] = v; $(id).textContent = v; } }
function setW(id, v) { const w = Math.max(0, Math.min(100, v)).toFixed(1) + '%'; if (UI.lastHud[id] !== w) { UI.lastHud[id] = w; $(id).style.width = w; } }
export function drawMinimap() {
  const c = $('minimap'), x = c.getContext('2d'), w = c.width, h = c.height;
  x.clearRect(0, 0, w, h);
  const n = 6, bw = 34, gap = (w - 24 - n * bw) / (n - 1), y = h / 2;
  for (let i = 0; i < n; i++) {
    const bx = 12 + i * (bw + gap);
    if (i < n - 1) { x.fillStyle = 'rgba(255,240,220,.25)'; x.fillRect(bx + bw, y - 2, gap, 4); }
    const cur = i + 1 === G.room_num, done = i + 1 < G.room_num, boss = i === n - 1, sp = i + 1 === G.sp_room;
    x.fillStyle = cur ? '#ffc93c' : done ? 'rgba(255,240,220,.55)' : 'rgba(255,240,220,.14)';
    x.beginPath(); x.roundRect(bx, y - 15, bw, 30, 7); x.fill();
    x.font = '900 18px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (boss) { x.fillStyle = cur ? '#2a1600' : '#ff6a55'; x.fillText('☠', bx + bw / 2, y + 1); }
    else if (sp && !done) { x.fillStyle = cur ? '#2a1600' : '#ffc93c'; x.fillText('★', bx + bw / 2, y + 1); }
  }
}
export function frame(dt) {
  stepNums(dt);
  if (UI.bannerT > 0) { UI.bannerT -= dt; if (UI.bannerT <= 0) $('banner').classList.remove('on'); }
  if (UI.toastT > 0) { UI.toastT -= dt; if (UI.toastT <= 0) $('loot').classList.remove('on'); }
  if (flashA > 0) { flashA = Math.max(0, flashA - dt * 2.5); $('flash').style.opacity = flashA; }
  if (G.state !== 'play' && G.state !== 'rescue') return;
  // the HUD
  setText('hLvl', 'LV ' + G.lvl);
  setW('xpfill', G.xp / G.xpnext * 100);
  setText('hHp', G.hp + '/' + G.maxhp);
  setW('hpfill', G.hp / G.maxhp * 100);
  setText('hAtk', S.atk_fine()); setText('hDef', S.total_def());
  setText('hGold', G.gold); setText('hPots', G.potions);
  const wh = G.room_num === D.BOSS_ROOM ? 'BOSS' : 'ROOM ' + G.room_num;
  if (UI.lastHud.where !== G.floor_num + wh) {
    UI.lastHud.where = G.floor_num + wh;
    $('hWhere').innerHTML = `FLOOR ${G.floor_num}<small>${D.THEME_NAME[G.theme]} · ${wh}</small>`;
    drawMinimap();
  }
  // the class meter: blink cooldown (mage), roll (warrior / hunter with a pet)
  const cls = G.player_class;
  let mn, mv;
  if (cls === 1) { mn = 'BLINK'; mv = G.blink_cd ? 1 - G.blink_cd / (150 - S.TAL.QBLINK * 22) : 1; }
  else if (cls === 2 && !G.pet_type) { mn = 'TAME'; mv = 1; }
  else { mn = 'ROLL'; mv = G.roll_cd ? 1 - G.roll_cd / (G.eq_spec[3] === D.SP_QUICK ? 20 : 40) : 1; }
  setText('hMeterN', mn); setW('abfill', mv * 100);
  setText('tSpec', cls === 1 ? 'BLINK' : (cls === 2 && !G.pet_type ? 'TAME' : 'ROLL'));
  const pet = G.pet_type;
  $('hPet').hidden = !pet;
  if (pet) { setText('hPetN', G.pet_down ? 'PET DOWN' : (G.pet_name || D.PET_NAME[pet]).toUpperCase()); setW('petfill', G.pet_down ? 0 : G.pet_hp / S.pet_max() * 100); }
  // the boss bar
  const bb = $('bossbar');
  const showBar = G.boss_on && !G.bintro;
  bb.hidden = !showBar;
  if (showBar) {
    setW('bossfill', G.bhp / G.bmaxhp * 100);
    setText('bossname', S.boss_name() + (G.bform === D.BF_WIZ ? ' · SORCERER' : ''));
    bb.classList.toggle('ward', G.bward > 0);
  }
  // the message line
  if (UI.msgId !== G.msg_id) { UI.msgId = G.msg_id; $('msg').textContent = G.msg; $('msg').style.color = G.msg_color; }
  $('msg').style.opacity = G.msg ? 1 : 0;
  if (S.tal_avail() && !$('hBag').classList.contains('alert')) $('hBag').classList.add('alert');
}
$('hPot').onclick = () => { S.drink_potion(); };
$('hBag').addEventListener('click', () => $('hBag').classList.remove('alert'));
// the touch controller's SELECT (the bag) and START (pause), as on the SNES pad
for (const [id, go] of [['tSel', () => openInv()], ['tStart', () => openPause()]]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); input.lastDevice = 'touch'; b.classList.add('on'); if (!UI.modal && G.state === 'play') go(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => b.classList.remove('on'));
}

// ---------------------------------------------------------------- naming a new pet
export function namePet() {
  if (!G.pet_type || G.state !== 'play') return;
  const opts = PET_NAMES[G.pet_type] || ['Buddy'];
  $('petPic').src = petPic(G.pet_type);
  $('petKind').textContent = 'Your new ' + D.PET_NAME[G.pet_type].toLowerCase() + '!';
  $('petName').value = G.pet_name || '';
  $('petSugg').innerHTML = '';
  for (const n of opts) { const b = document.createElement('button'); b.className = 'mbtn'; b.type = 'button'; b.textContent = n; b.onclick = () => { $('petName').value = n; sfx('pickup'); }; $('petSugg').appendChild(b); }
  show('sName');
  if (input.lastDevice !== 'touch') setTimeout(() => $('petName').focus(), 60);
}
$('petForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('petName').value.replace(/[^A-Za-z0-9 '\-]/g, '').trim().slice(0, 10);
  G.pet_name = v || (PET_NAMES[G.pet_type] || ['Buddy'])[0];
  sfx('levelup');
  S.save_game();
  show(null);
});
