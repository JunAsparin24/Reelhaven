// Worlds: every world is its own save slot (js/save.js), like separate
// Minecraft worlds.
//
//   * Personal worlds belong to you: 'main' (your first island) and any new
//     worlds you create ('w-…'). Their server id is "<you>:<slot>".
//   * Joined worlds belong to a friend. You get a separate character there
//     (its own inventory, coins, quests…) saved in slot 'c-<world id>' and,
//     when signed in, on the server as that world's character for you.
//
// This module keeps a small local index for the world menu; the saves
// themselves live in their slots. Nothing here ever touches another slot.
import * as Save from './save.js';

const REG_KEY = 'tidetown.worlds';
export const MAX_WORLDS = 6;

const blank = () => ({ personal: [], joined: [], last: null });

export function registry() {
  let r;
  try { r = { ...blank(), ...(JSON.parse(localStorage.getItem(REG_KEY)) || {}) }; } catch { r = blank(); }
  // Your original island always shows up once it exists.
  if (!r.personal.some(w => w.slot === 'main') && Save.hasSlot('main')) {
    const st = Save.peekSlot('main').state;
    r.personal.unshift({ slot: 'main', name: 'My Island', createdAt: st?.createdAt || Date.now(), lastPlayed: st?.savedAt || 0, charName: st?.player?.name, level: st?.player?.level });
  }
  return r;
}

function write(r) { try { localStorage.setItem(REG_KEY, JSON.stringify(r)); } catch { /* storage full */ } }

export function newSlotId() { return 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

/** Slot used for your character in someone else's world. */
export function memberSlot(worldId) { return 'c-' + String(worldId).toLowerCase().replace(/[^a-z0-9]+/g, '_'); }

export function notePersonal(slot, patch = {}) {
  const r = registry();
  let w = r.personal.find(x => x.slot === slot);
  if (!w) { w = { slot, name: 'My Island', createdAt: Date.now() }; r.personal.push(w); }
  Object.assign(w, patch);
  r.last = { kind: 'personal', slot };
  write(r);
  return w;
}

export function noteJoined(world, patch = {}) {
  const r = registry();
  let w = r.joined.find(x => x.world === world);
  if (!w) { w = { world, createdAt: Date.now() }; r.joined.push(w); }
  Object.assign(w, patch);
  write(r);
  return w;
}

export function forgetPersonal(slot) {
  if (slot === 'main') return;
  const r = registry();
  r.personal = r.personal.filter(w => w.slot !== slot);
  if (r.last?.slot === slot) r.last = null;
  write(r);
  Save.deleteSlot(slot);
}

/** Merge world names / levels the server knows about (other devices). */
export function mergeServer(list) {
  if (!list) return;
  const r = registry();
  for (const w of list.personal || []) {
    let mine = r.personal.find(x => x.slot === w.slot);
    if (!mine) { mine = { slot: w.slot, createdAt: w.createdAt || Date.now() }; r.personal.push(mine); }
    Object.assign(mine, { name: w.name || mine.name, cloud: true, level: mine.level || w.level, charName: mine.charName || w.charName });
  }
  for (const w of list.joined || []) {
    let j = r.joined.find(x => x.world === w.world);
    if (!j) { j = { world: w.world, createdAt: Date.now() }; r.joined.push(j); }
    Object.assign(j, { owner: w.owner, ownerName: w.ownerName, worldName: w.worldName || j.worldName, charName: j.charName || w.charName, level: j.level || w.level, open: !!w.open, island: w.island });
  }
  write(r);
}

/** The world the title screen's "Continue" opens. */
export function lastPersonal() {
  const r = registry();
  const slot = r.last?.kind === 'personal' ? r.last.slot : null;
  if (slot && Save.hasSlot(slot)) return slot;
  return Save.hasSlot('main') ? 'main' : (r.personal.find(w => Save.hasSlot(w.slot))?.slot || null);
}

export function personalName(slot) { return registry().personal.find(w => w.slot === slot)?.name || 'My Island'; }
