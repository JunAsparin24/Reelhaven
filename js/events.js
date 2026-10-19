// Tiny publish/subscribe bus that decouples simulation from UI and audio.
// Common events:
//   change            any authoritative state change (UI refresh, autosave)
//   fishCaught        { fish, entry, isNew, zone }
//   fishSold          { count, coins }
//   gathered          { resource, amount }
//   purchased         { kind, id }
//   built             { id, kind }
//   levelUp           { level }
//   toast             { text, icon, tone }
//   questReady / questClaimed / achievement / islandUnlocked / travel
const listeners = new Map();

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => off(type, fn);
}

export function off(type, fn) {
  listeners.get(type)?.delete(fn);
}

export function emit(type, payload) {
  const set = listeners.get(type);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(payload); } catch (err) { console.error(`Error in "${type}" listener`, err); }
  }
}

export function toast(text, icon = null, tone = 'info') {
  emit('toast', { text, icon, tone });
}
