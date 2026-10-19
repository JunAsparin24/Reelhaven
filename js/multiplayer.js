// Offline status text, planned features, and the public island snapshot
// format friends load when they visit (see js/online/ and server.py).
//
// The server never trusts the client with anything that creates value for
// other players; trading (planned) must be validated by server.py.
import { GAME_VERSION } from './state.js';
import { FISH } from '../data/fish-data.js';
import { ISLANDS } from '../data/island-data.js';

/** Status shown when no backend is configured (see js/online/ for the real thing). */
export function onlineStatus() {
  return { configured: false, connected: false, message: 'Online services are not set up for this copy of the game. Everything you do is saved on this device.' };
}

export const PLANNED_FEATURES = [
  { icon: 'island', title: 'Cloud saves', text: 'Keep your island safe and play it on any device.', live: true },
  { icon: 'friends', title: 'Friends & island visits', text: 'Add friends by code and stroll around their islands.', live: true },
  { icon: 'sell', title: 'Trading', text: 'Swap spare fish and decorations, verified by the server.' },
  { icon: 'fish', title: 'Fishing competitions', text: 'Weekend tournaments with shared leaderboards.' },
  { icon: 'trophy', title: 'Community goals', text: 'Work together on island-wide projects.' },
];

/** Public, read-only snapshot of an island — what friends load when visiting.
 *  Contains no email, coins, inventory or other private data. */
export function islandSnapshot(state) {
  const p = state.player;
  return {
    schema: 2,
    gameVersion: GAME_VERSION,
    name: p.name,
    level: p.level,
    look: p.look,
    species: Object.keys(state.collection).length,
    speciesTotal: FISH.length,
    islands: Object.entries(state.islands).filter(([, v]) => v.unlocked).map(([id, v]) => ({
      id, name: ISLANDS[id].name,
      flags: { bridgeRepaired: !!v.flags?.bridgeRepaired },
      placements: v.placements.map(({ type, x, y, rot }) => ({ type, x, y, rot })),
    })),
  };
}
