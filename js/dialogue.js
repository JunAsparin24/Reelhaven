// Reusable dialogue: picks lines for an NPC based on game context and hands
// them to the UI's dialogue box. NPC content lives in data/npc-data.js.
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { NPCS } from '../data/npc-data.js';
import { currentQuest } from './quests.js';
import { speciesDiscovered } from './progression.js';
import { isNight } from './weather.js';
import { hasBuilding } from './building-count.js';

function context() {
  const s = getState();
  return {
    quest: currentQuest()?.id || null,
    questIndex: s.quests.index,
    species: speciesDiscovered(),
    level: s.player.level,
    isNight: isNight(),
    has: hasBuilding,
    flag: name => s.flags[name] || Object.values(s.islands).some(i => i.flags[name]),
  };
}

const lastRandom = {};

/** Returns { npc, lines, action } for a conversation. */
export function conversation(npcId) {
  const npc = NPCS[npcId];
  const ctx = context();
  const entry = npc.dialogue.find(d => d.when(ctx)) || npc.dialogue[npc.dialogue.length - 1];
  let lines = entry.lines;
  if (entry.random) {
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === lastRandom[npcId]) i = (i + 1) % lines.length;
    lastRandom[npcId] = i;
    lines = [lines[i]];
  }
  return { npc, lines, action: entry.action || null };
}

/** Record that the player talked to an NPC (some quests need this). */
export function markTalked(npcId) {
  const s = getState();
  if (!s.stats.talked[npcId]) { s.stats.talked[npcId] = true; commit('talk'); }
  emit('talked', { npc: npcId });
}
