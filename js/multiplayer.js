// Online services boundary. No backend is configured in this release, so this
// module reports an honest offline status — there are no fake friends or
// simulated players. It also defines the public island snapshot format that a
// future backend (e.g. Supabase: auth + Postgres + Realtime) would store, so
// cloud saves and island visits can be added without changing game code.
//
// When a backend is added, anything that creates value (coins, items, trades,
// rewards) must be validated server-side; the client is never trusted.
import { GAME_VERSION } from './state.js';
import { FISH } from '../data/fish-data.js';
import { ISLANDS } from '../data/island-data.js';

export const ONLINE_CONFIG = {
  provider: null,       // e.g. 'supabase'
  url: '',              // project URL
  anonKey: '',          // public anon key (never a service key)
};

export function onlineStatus() {
  if (!ONLINE_CONFIG.provider || !ONLINE_CONFIG.url) {
    return { configured: false, connected: false, message: 'Online services are not set up for this build. Everything you do is saved on this device.' };
  }
  return { configured: true, connected: false, message: 'Online services are configured but not yet implemented in this version.' };
}

export const PLANNED_FEATURES = [
  { icon: 'friends', title: 'Friends & island visits', text: 'Add friends and stroll around their islands to see their builds.' },
  { icon: 'fish', title: 'Fishing competitions', text: 'Weekend tournaments with shared leaderboards.' },
  { icon: 'sell', title: 'Trading', text: 'Swap spare fish and decorations, verified by the server.' },
  { icon: 'island', title: 'Cloud saves', text: 'Keep your island safe and play on any device.' },
  { icon: 'trophy', title: 'Community goals', text: 'Work together on island-wide projects.' },
];

/** Public, read-only snapshot of an island — the format a server would store. */
export function islandSnapshot(state) {
  const p = state.player;
  return {
    schema: 1,
    gameVersion: GAME_VERSION,
    name: p.name,
    level: p.level,
    look: p.look,
    species: Object.keys(state.collection).length,
    speciesTotal: FISH.length,
    islands: Object.entries(state.islands).filter(([, v]) => v.unlocked).map(([id, v]) => ({
      id, name: ISLANDS[id].name,
      placements: v.placements.map(({ type, x, y, rot }) => ({ type, x, y, rot })),
    })),
  };
}
