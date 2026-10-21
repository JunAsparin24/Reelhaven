// World clock and weather. One real second = one game minute, so a full day
// takes 24 minutes; resting in the cottage skips ahead, so nobody has to wait.
import { getState, commit } from './state.js';
import { emit } from './events.js';
import { ISLANDS } from '../data/island-data.js';
import { seasonOf, SEASON_WEATHER } from '../data/farm-data.js';

export const GAME_MIN_PER_SEC = 1;

export const PHASES = ['morning', 'afternoon', 'evening', 'night'];

export function phaseOf(min) {
  const h = min / 60;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20.5) return 'evening';
  return 'night';
}

export function currentPhase() {
  const s = getState();
  if (ISLANDS[s.player.island]?.alwaysNight) return 'night';
  return phaseOf(s.world.minutes);
}

export function isNight() { return currentPhase() === 'night'; }

export function currentWeather() {
  const s = getState();
  const isl = ISLANDS[s.player.island];
  if (isl?.alwaysNight && s.world.weather === 'storm') return 'rain';
  // Snow only falls on the cooler islands; the coral atoll gets rain instead.
  if (s.world.weather === 'snow' && isl?.id === 'coral') return 'rain';
  return s.world.weather;
}

export function clockText() {
  const m = Math.floor(getState().world.minutes);
  const h = Math.floor(m / 60), mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The season right now: { season, name, day, year }. */
export function currentSeason() { return seasonOf(getState().world.day); }

/** Random weather for a day, using that day's season. */
export function pickWeather(day, prev = 'sunny') {
  const table = SEASON_WEATHER[seasonOf(day).season];
  let r = Math.random(), pick = 'sunny';
  for (const [w, p] of table) { if (r < p) { pick = w; break; } r -= p; }
  // Storms never follow storms; the first days are always fair for new players.
  if (day <= 2) pick = 'sunny';
  if (pick === 'storm' && prev === 'storm') pick = 'rain';
  return pick;
}

/**
 * Weather is decided once per day, like Stardew: today's weather is
 * yesterday's forecast (what the TV promised), and a new forecast is rolled.
 */
function startDay() {
  const w = getState().world;
  const today = w.forecast || pickWeather(w.day, w.weather);
  w.forecast = pickWeather(w.day + 1, today);
  w.luck = Math.round((Math.random() * 0.2 - 0.1) * 100) / 100;   // the TV's daily fortune
  w.weatherUntil = Infinity;
  if (today !== w.weather) { w.weather = today; emit('weather', { weather: today }); }
}

let lastPhase = null;
let saveAccum = 0;

/** Advance the clock; dt in seconds. */
export function tick(dt) {
  const s = getState();
  const w = s.world;
  w.minutes += dt * GAME_MIN_PER_SEC;
  if (w.minutes >= 1440) { w.minutes -= 1440; w.day += 1; startDay(); emit('newDay', { day: w.day }); }
  if (!w.forecast) startDay();
  const ph = currentPhase();
  if (ph !== lastPhase) { if (lastPhase) emit('phase', { phase: ph }); lastPhase = ph; }
  // Persist the clock occasionally without spamming saves.
  saveAccum += dt;
  if (saveAccum > 30) { saveAccum = 0; commit('clock', false); }
}

/** Skip time forward to the start of the given phase. */
export function restUntil(phase) {
  const s = getState();
  const target = { morning: 6 * 60, afternoon: 12 * 60, evening: 17.5 * 60, night: 21 * 60 }[phase];
  if (target == null) return;
  if (s.world.minutes >= target) { s.world.day += 1; startDay(); }
  s.world.minutes = target;
  lastPhase = null;
  emit('rested', { phase });
  commit('rest');
}

/**
 * Sleep through the night: wake at 6 AM on the next day (sleeping after
 * midnight still counts as that night, like Stardew). Returns the new day.
 */
export const WAKE_MINUTES = 6 * 60;
export function sleepToMorning() {
  const s = getState();
  const w = s.world;
  if (w.minutes >= WAKE_MINUTES) { w.day += 1; startDay(); }
  w.minutes = WAKE_MINUTES;
  lastPhase = null;
  s.stats.daysSlept = (s.stats.daysSlept || 0) + 1;
  s.player.hp = s.player.maxHp || 100;
  s.player.energy = s.player.maxEnergy || 100;
  emit('newDay', { day: w.day, slept: true });
  commit('sleep');
  return w.day;
}

/** Adopt the host's clock in a multiplayer game. */
export function setClock({ day, minutes, weather }) {
  const w = getState().world;
  if (Number.isFinite(day)) w.day = day;
  if (Number.isFinite(minutes)) w.minutes = minutes;
  if (weather && weather !== w.weather) { w.weather = weather; w.weatherUntil = Infinity; emit('weather', { weather }); }
}

// ---- lighting keyframes: [hour, r, g, b, alpha]
const KEYS = [
  [0, 18, 28, 70, 0.56], [4.5, 18, 28, 70, 0.54], [6, 246, 160, 108, 0.16], [7.5, 255, 240, 220, 0],
  [16.5, 255, 240, 220, 0], [18, 240, 128, 90, 0.2], [19.5, 60, 50, 120, 0.4], [21, 18, 28, 70, 0.54], [24, 18, 28, 70, 0.56],
];

/** Colour overlay for the current time; also returns darkness (0..1) for lights. */
export function lighting() {
  const s = getState();
  const isl = ISLANDS[s.player.island];
  if (isl?.alwaysNight) return { r: 20, g: 26, b: 80, a: 0.5, dark: 1 };
  const h = s.world.minutes / 60;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] <= h) i++;
  const [h0, r0, g0, b0, a0] = KEYS[i], [h1, r1, g1, b1, a1] = KEYS[i + 1];
  const t = (h - h0) / (h1 - h0 || 1);
  const lerp = (a, b) => a + (b - a) * t;
  const a = lerp(a0, a1);
  const night = Math.max(0, Math.min(1, (a - 0.15) / 0.38)) * (r0 < 100 || r1 < 100 ? 1 : 0.4);
  return { r: lerp(r0, r1) | 0, g: lerp(g0, g1) | 0, b: lerp(b0, b1) | 0, a, dark: night };
}
