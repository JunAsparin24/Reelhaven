// Audio: soft synthesized sound effects, a gentle generative ukulele-ish
// loop, terrain footsteps (sample files) and environmental ambience — all
// through one Web Audio graph:
//
//   music ─┐
//   sfx ───┼─ master ─ speakers        (each a GainNode driven by settings)
//   steps ─┤  (steps & ambience also scale with the sfx volume)
//   ambience┘
//
// Real recordings can replace any synth effect: put files in assets/audio and
// list them in AUDIO_FILES — loaded buffers take priority.
export const AUDIO_FILES = {
  // cast: 'assets/audio/cast.ogg',
};

let ctx = null, master, musicGain, sfxGain, stepGain, ambGain;
const buffers = new Map();
let settings = { master: 1, music: 0.5, sfx: 0.7, footsteps: 0.8, ambience: 0.6, haptics: true };

/** Footstep samples per surface. Grass, sand, wood and mud are cut from
 *  recordings (tools/slice_footsteps.py); the rest are synthesized
 *  (tools/generate_footsteps.py). */
export const FOOTSTEP_FILES = {
  grass: 6, sand: 6, wood: 6, mud: 4, stone: 3, shallow_water: 3, indoor_wood: 2,
};
const stepBuffers = new Map();   // surface -> AudioBuffer[]
const lastStep = { at: 0, idx: {} };
/** Diagnostics (used by tests): the last few footsteps that actually played. */
export const audioStats = { steps: [] };
let musicOn = false, musicTimer = null, nextNoteTime = 0, step = 0, mood = 'day';

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.connect(master);
  stepGain = ctx.createGain(); stepGain.connect(master);
  ambGain = ctx.createGain(); ambGain.connect(master);
  applyVolumes();
  loadFootsteps();
  for (const [id, url] of Object.entries(AUDIO_FILES)) {
    fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => buffers.set(id, buf)).catch(() => {});
  }
}

export function setVolumes(s) { settings = { ...settings, ...s }; applyVolumes(); }
function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime, m = settings.master ?? 1;
  master.gain.setTargetAtTime(0.9 * m, t, 0.05);
  musicGain.gain.setTargetAtTime(settings.music * 0.35, t, 0.1);
  sfxGain.gain.setTargetAtTime(settings.sfx * 0.6, t, 0.05);
  stepGain.gain.setTargetAtTime((settings.footsteps ?? 0.8) * settings.sfx * 0.55, t, 0.05);
  ambGain.gain.setTargetAtTime((settings.ambience ?? 0.6) * settings.sfx * 0.5, t, 0.2);
}

// ------------------------------------------------------------- footsteps
/** Decode every footstep sample once and cache it (never per step). */
function loadFootsteps() {
  for (const [surface, count] of Object.entries(FOOTSTEP_FILES)) {
    const list = [];
    stepBuffers.set(surface, list);
    for (let i = 1; i <= count; i++) {
      fetch(`assets/audio/footsteps/${surface}_${i}.wav`)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(b => ctx.decodeAudioData(b))
        .then(buf => list.push(buf))
        .catch(() => { /* missing sample: that surface just plays fewer variations */ });
    }
  }
}

/**
 * Play one footstep for a surface. Picks a different take than last time,
 * with slight volume / pitch variation, and refuses impossibly fast repeats.
 */
export function playFootstep(surface, intensity = 1) {
  if (!ctx || ctx.state !== 'running' || settings.sfx <= 0 || (settings.footsteps ?? 1) <= 0) return false;
  const now = ctx.currentTime;
  if (now - lastStep.at < 0.12) return false;
  const list = stepBuffers.get(surface) || stepBuffers.get('grass');
  if (!list || !list.length) return false;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastStep.idx[surface]) i = (i + 1) % list.length;
  lastStep.idx[surface] = i;
  lastStep.at = now;
  const src = ctx.createBufferSource();
  src.buffer = list[i];
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const g = ctx.createGain();
  g.gain.value = (0.8 + Math.random() * 0.2) * intensity;
  src.connect(g); g.connect(stepGain);
  src.start(now);
  audioStats.steps.push(surface);
  if (audioStats.steps.length > 50) audioStats.steps.shift();
  return true;
}

// ------------------------------------------------------------- ambience
// A single looping noise source feeds two filtered beds (surf + rain); birds
// and crickets are sparse synthesized chirps. The game sets target levels a
// few times a second via setAmbience(); nothing is created per frame.
let amb = null;
function ensureAmbience() {
  if (amb || !ctx) return;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 4; }  // brown-ish noise
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const waveF = ctx.createBiquadFilter(); waveF.type = 'lowpass'; waveF.frequency.value = 520;
  const waveG = ctx.createGain(); waveG.gain.value = 0;
  const rainF = ctx.createBiquadFilter(); rainF.type = 'highpass'; rainF.frequency.value = 1800;
  const rainG = ctx.createGain(); rainG.gain.value = 0;
  src.connect(waveF); waveF.connect(waveG); waveG.connect(ambGain);
  src.connect(rainF); rainF.connect(rainG); rainG.connect(ambGain);
  src.start();
  amb = { waveG, rainG, waveF, level: { waves: 0, rain: 0, birds: 0, crickets: 0 }, nextChirp: 0 };
}

/** levels: { waves 0..1, rain 0..1, birds 0..1, crickets 0..1 } */
export function setAmbience(levels) {
  if (!ctx || ctx.state !== 'running') return;
  ensureAmbience();
  const t = ctx.currentTime;
  amb.level = { ...amb.level, ...levels };
  // Waves swell and recede gently.
  const swell = 0.6 + 0.4 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
  amb.waveG.gain.setTargetAtTime(amb.level.waves * 0.55 * swell, t, 0.6);
  amb.waveF.frequency.setTargetAtTime(380 + 260 * swell, t, 0.6);
  amb.rainG.gain.setTargetAtTime(amb.level.rain * 0.12, t, 0.8);
  if (t >= amb.nextChirp) {
    if (amb.level.birds > 0 && Math.random() < amb.level.birds) birdCall(t);
    else if (amb.level.crickets > 0 && Math.random() < amb.level.crickets) cricket(t);
    amb.nextChirp = t + 2.5 + Math.random() * 5;
  }
}

function birdCall(t) {
  const base = 2200 + Math.random() * 1400;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) tone(base * (1 + i * 0.06), t + i * 0.11, 0.07, { type: 'sine', vol: 0.05, slide: 500, dest: ambGain });
}

function cricket(t) {
  for (let i = 0; i < 6; i++) tone(4600, t + i * 0.045, 0.025, { type: 'square', vol: 0.012, dest: ambGain });
}

export function pauseAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend();
  if (mediaKeepAlive) mediaKeepAlive.pause();
  if (track) { saveTrackPos(); track.pause(); }
}
export function resumeAudio() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  if (musicOn && track && track.paused) track.play().catch(() => {});
}

// ------------------------------------------------------------- mobile unlock
// Phones only let audio start inside a "real" user gesture (touchend / click /
// keydown — not pointerdown or touchstart on iOS), and they suspend it again
// when you switch apps. So every tap re-unlocks it if needed. iPhones also mute
// Web Audio with the ring/silent switch unless the page is treated as media
// playback, so we ask for that.
let mediaKeepAlive = null;

function silentWavUrl() {
  // 0.25 s of 8 kHz mono silence as a tiny WAV file.
  const n = 2000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function unlock() {
  initAudio();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  // Older iOS also needs a sound started inside the gesture.
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* fine */ }
  // iPhone silent switch: Safari 17+ lets us say "this is media playback".
  if (navigator.audioSession) {
    try { navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
  } else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    // Older iOS: a silent looping <audio> element moves the page into the
    // media category, which the silent switch doesn't mute.
    if (!mediaKeepAlive) {
      mediaKeepAlive = new Audio(silentWavUrl());
      mediaKeepAlive.loop = true;
      mediaKeepAlive.setAttribute('playsinline', '');
    }
    if (mediaKeepAlive.paused) mediaKeepAlive.play().catch(() => {});
  }
  // Phones only start <audio> inside a tap, so retry the music here.
  if (musicOn && track && track.paused) track.play().catch(() => {});
}

/** Install once at startup: any tap, click or key unlocks / resumes audio. */
export function installAudioUnlock() {
  const opts = { capture: true, passive: true };
  for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) document.addEventListener(ev, unlock, opts);
}

/**
 * Try to start sound with no tap at all. Browsers only allow this in a few
 * cases (e.g. desktop sites you visit often); returns true if it worked.
 */
export async function tryAutoStart() {
  initAudio();
  if (!ctx) return false;
  try { await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 300))]); } catch { /* blocked */ }
  return ctx.state === 'running';
}

/** For diagnostics: 'none' | 'suspended' | 'running' | 'closed'. */
export function audioState() { return ctx ? ctx.state : 'none'; }

// ------------------------------------------------------------- synth helpers
function tone(freq, start, dur, { type = 'triangle', vol = 0.3, attack = 0.005, slide = 0, dest = sfxGain } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + dur);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(dest);
  o.start(start); o.stop(start + dur + 0.05);
}

let noiseBuf = null;
function noise(start, dur, { vol = 0.2, freq = 1200, q = 1, sweep = 0, type = 'bandpass' } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, start); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(start); src.stop(start + dur + 0.05);
}

const N = n => 440 * Math.pow(2, (n - 69) / 12);

const SFX = {
  click: t => tone(880, t, 0.06, { type: 'square', vol: 0.05 }),
  open: t => { tone(N(72), t, 0.08, { vol: 0.12 }); tone(N(79), t + 0.05, 0.1, { vol: 0.1 }); },
  close: t => { tone(N(79), t, 0.07, { vol: 0.1 }); tone(N(72), t + 0.05, 0.09, { vol: 0.08 }); },
  cast: t => { noise(t, 0.35, { vol: 0.18, freq: 500, sweep: 2500, q: 0.8 }); tone(600, t, 0.25, { type: 'sine', vol: 0.05, slide: 500 }); },
  splash: t => { noise(t, 0.4, { vol: 0.25, freq: 900, sweep: -600, q: 0.6 }); tone(300, t, 0.12, { type: 'sine', vol: 0.08, slide: -150 }); },
  plop: t => { tone(500, t, 0.1, { type: 'sine', vol: 0.12, slide: -300 }); },
  nibble: t => tone(420, t, 0.06, { type: 'sine', vol: 0.06, slide: -120 }),
  bite: t => { tone(N(84), t, 0.09, { type: 'square', vol: 0.09 }); tone(N(88), t + 0.08, 0.14, { type: 'square', vol: 0.09 }); noise(t, 0.25, { vol: 0.15, freq: 1200, q: 0.7 }); },
  reel: t => tone(1400 + Math.random() * 200, t, 0.03, { type: 'square', vol: 0.025 }),
  catch: t => { [72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.08, 0.25, { vol: 0.16 })); noise(t, 0.3, { vol: 0.12, freq: 1500 }); },
  escape: t => { tone(N(67), t, 0.18, { vol: 0.12 }); tone(N(62), t + 0.14, 0.3, { vol: 0.1 }); },
  coin: t => { tone(N(88), t, 0.08, { type: 'square', vol: 0.06 }); tone(N(93), t + 0.07, 0.22, { type: 'square', vol: 0.06 }); },
  buy: t => { tone(N(76), t, 0.1, { vol: 0.14 }); tone(N(81), t + 0.08, 0.1, { vol: 0.14 }); tone(N(88), t + 0.16, 0.25, { vol: 0.14 }); },
  error: t => { tone(N(55), t, 0.12, { vol: 0.12, type: 'sine' }); tone(N(52), t + 0.1, 0.18, { vol: 0.1, type: 'sine' }); },
  quest: t => { [67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.09, 0.35, { vol: 0.13 })); },
  levelup: t => { [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(N(n), t + i * 0.07, 0.4, { vol: 0.12 })); },
  unlock: t => { [60, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * 0.12, 0.6, { vol: 0.12, type: 'sine' })); },
  gather: t => { noise(t, 0.1, { vol: 0.12, freq: 2200, q: 2 }); tone(N(79), t + 0.03, 0.12, { vol: 0.08 }); },
  build: t => { for (let i = 0; i < 3; i++) noise(t + i * 0.13, 0.08, { vol: 0.2, freq: 400, q: 2 }); tone(N(72), t + 0.42, 0.3, { vol: 0.12 }); tone(N(79), t + 0.5, 0.35, { vol: 0.12 }); },
  perfect: t => { tone(N(84), t, 0.12, { vol: 0.1, type: 'sine' }); tone(N(91), t + 0.06, 0.2, { vol: 0.1, type: 'sine' }); },
  thunder: t => noise(t, 1.6, { vol: 0.25, freq: 200, sweep: -150, q: 0.4, type: 'lowpass' }),
  step: t => noise(t, 0.04, { vol: 0.03, freq: 1800, q: 3 }),
  // mine & combat
  swing: t => noise(t, 0.12, { vol: 0.12, freq: 1800, sweep: -1200, q: 0.8 }),
  // farming
  chop: t => { noise(t, 0.09, { vol: 0.25, freq: 700, q: 1.5 }); tone(180, t, 0.08, { type: 'square', vol: 0.05, slide: -60 }); },
  treefall: t => { noise(t, 0.5, { vol: 0.25, freq: 400, sweep: -250, q: 0.6 }); noise(t + 0.35, 0.25, { vol: 0.2, freq: 1500, q: 0.8 }); },
  hoe: t => { noise(t, 0.12, { vol: 0.2, freq: 500, sweep: -200, q: 1 }); },
  pour: t => noise(t, 0.35, { vol: 0.14, freq: 2200, sweep: -800, q: 0.7 }),
  pick: t => { noise(t, 0.07, { vol: 0.22, freq: 2600, q: 3 }); tone(1300, t, 0.05, { type: 'square', vol: 0.04 }); },
  rockbreak: t => { noise(t, 0.3, { vol: 0.28, freq: 700, sweep: -400, q: 0.7 }); noise(t + 0.05, 0.15, { vol: 0.15, freq: 2400, q: 2 }); },
  hit: t => { noise(t, 0.08, { vol: 0.2, freq: 900, q: 1 }); tone(220, t, 0.1, { type: 'square', vol: 0.06, slide: -120 }); },
  squish: t => { tone(300, t, 0.15, { type: 'sine', vol: 0.12, slide: -220 }); noise(t, 0.12, { vol: 0.1, freq: 500, q: 1 }); },
  hurt: t => { tone(N(62), t, 0.1, { type: 'square', vol: 0.08 }); tone(N(55), t + 0.08, 0.18, { type: 'square', vol: 0.07 }); },
  eat: t => { for (let i = 0; i < 3; i++) noise(t + i * 0.1, 0.06, { vol: 0.12, freq: 1400, q: 2 }); tone(N(79), t + 0.32, 0.15, { vol: 0.08 }); },
  ladder: t => { [67, 64, 60].forEach((n, i) => tone(N(n), t + i * 0.08, 0.15, { vol: 0.1 })); },
  smelt: t => { noise(t, 0.6, { vol: 0.15, freq: 300, sweep: 300, q: 0.5, type: 'lowpass' }); tone(N(84), t + 0.5, 0.2, { vol: 0.08, type: 'sine' }); },
};

export function sfx(name) {
  if (!ctx || settings.sfx <= 0) return;
  if (ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.01;
  if (buffers.has(name)) {
    const src = ctx.createBufferSource(); src.buffer = buffers.get(name); src.connect(sfxGain); src.start(t);
    return;
  }
  SFX[name]?.(t);
}

// ------------------------------------------------------------- music
// A slow I–vi–IV–V progression with a plucked arpeggio and occasional melody.
const PROG_DAY = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const PROG_NIGHT = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const PENTA = [72, 74, 76, 79, 81, 84];

export function setMood(m) { mood = m; }

// The main soundtrack is a long recorded track (an hour of chill game music),
// streamed through an <audio> element into the music volume. It picks up
// where it left off last time. If it can't load, the little synthesized
// tune below plays instead.
export const MUSIC_TRACK = 'assets/audio/music/main_theme.mp3';
const TRACK_GAIN = 2.2;            // the recording is quieter than the synth tune
const POS_KEY = 'reelhaven.musicPos';
let track = null, trackFailed = false, posTimer = null, trackGain = null, trackFilter = null;

// Each season colours the soundtrack a little (tempo / warmth), and the Old
// Mine has its own darker synth piece.
const SEASON_SOUND = {
  spring: { rate: 1.0, cutoff: 18000 },
  summer: { rate: 1.03, cutoff: 18000 },
  fall: { rate: 0.97, cutoff: 4200 },
  winter: { rate: 0.94, cutoff: 2400 },
};
let scene = { season: 'spring', mine: false };

/** Tell the music where you are: { season, mine }. */
export function setMusicScene(next) {
  const was = scene;
  scene = { ...scene, ...next };
  if (!ctx) return;
  const look = SEASON_SOUND[scene.season] || SEASON_SOUND.spring;
  if (track) { track.preservesPitch = false; track.playbackRate = look.rate; }
  if (trackFilter) trackFilter.frequency.setTargetAtTime(look.cutoff, ctx.currentTime, 0.8);
  if (!musicOn || was.mine === scene.mine) return;
  if (scene.mine) {
    // fade the main track out and start the mine piece
    if (trackGain) trackGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => { if (scene.mine && track) track.pause(); }, 1500);
    startSynth();
  } else {
    clearInterval(musicTimer); musicTimer = null;
    if (track && !trackFailed) { track.play().catch(() => {}); if (trackGain) trackGain.gain.setTargetAtTime(TRACK_GAIN, ctx.currentTime, 0.6); }
    else startSynth();
  }
}
export function musicScene() { return { ...scene }; }

function saveTrackPos() {
  try { if (track && track.currentTime > 0) localStorage.setItem(POS_KEY, String(Math.floor(track.currentTime))); } catch { /* storage blocked */ }
}

function startTrack() {
  if (trackFailed || typeof Audio === 'undefined') return false;
  if (!track) {
    track = new Audio();
    track.loop = true;
    track.preload = 'auto';
    track.setAttribute('playsinline', '');
    track.addEventListener('error', () => {
      if (trackFailed) return;
      trackFailed = true;
      track = null;
      if (musicOn) startSynth();
    });
    track.addEventListener('loadedmetadata', () => {
      let pos = 0;
      try { pos = Number(localStorage.getItem(POS_KEY)) || 0; } catch { /* storage blocked */ }
      if (pos > 0 && pos < track.duration - 10) track.currentTime = pos;
    }, { once: true });
    track.src = MUSIC_TRACK;
    try {
      const node = ctx.createMediaElementSource(track);
      trackGain = ctx.createGain();
      trackGain.gain.value = scene.mine ? 0 : TRACK_GAIN;
      trackFilter = ctx.createBiquadFilter();
      trackFilter.type = 'lowpass';
      trackFilter.frequency.value = (SEASON_SOUND[scene.season] || SEASON_SOUND.spring).cutoff;
      node.connect(trackFilter); trackFilter.connect(trackGain); trackGain.connect(musicGain);
    } catch { /* plays straight to the speakers if Web Audio can't take it */ }
    posTimer = setInterval(saveTrackPos, 10000);
    window.addEventListener('pagehide', saveTrackPos);
  }
  track.preservesPitch = false;
  track.playbackRate = (SEASON_SOUND[scene.season] || SEASON_SOUND.spring).rate;
  if (scene.mine) { startSynth(); return true; }
  track.play().catch(() => { /* waits for the next tap (see unlock) */ });
  return true;
}

function startSynth() {
  nextNoteTime = ctx.currentTime + 0.1;
  step = 0;
  clearInterval(musicTimer);
  musicTimer = setInterval(scheduleMusic, 120);
}

export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  if (!startTrack()) startSynth();
}

export function stopMusic() {
  musicOn = false;
  clearInterval(musicTimer);
  if (track) { saveTrackPos(); track.pause(); }
}

// The mine: a slow minor drone with drips and far-off chimes.
const PROG_MINE = [[45, 48, 52], [41, 45, 48], [43, 46, 50], [40, 43, 47]];
function scheduleMine() {
  const beat = 0.6;
  while (nextNoteTime < ctx.currentTime + 0.6) {
    const chord = PROG_MINE[Math.floor(step / 8) % PROG_MINE.length];
    const i = step % 8, t = nextNoteTime;
    if (i === 0) { tone(N(chord[0] - 12), t, beat * 7.5, { type: 'sine', vol: 0.2, dest: musicGain, attack: 0.6 }); tone(N(chord[2] - 12), t, beat * 7.5, { type: 'sine', vol: 0.08, dest: musicGain, attack: 0.9 }); }
    if (i % 2 === 1 && Math.random() < 0.6) tone(N(chord[Math.floor(Math.random() * 3)] + 12), t, beat * 1.4, { type: 'triangle', vol: 0.05, dest: musicGain, attack: 0.02 });
    if (Math.random() < 0.12) tone(N(chord[0] + 36 + [0, 3, 7][Math.floor(Math.random() * 3)]), t + beat / 2, 0.5, { type: 'sine', vol: 0.025, dest: musicGain, attack: 0.005 });
    nextNoteTime += beat;
    step++;
  }
}

function scheduleMusic() {
  if (!ctx || ctx.state !== 'running') return;
  if (scene.mine) { scheduleMine(); return; }
  const night = mood === 'night';
  const beat = night ? 0.42 : 0.34;
  while (nextNoteTime < ctx.currentTime + 0.5) {
    const prog = night ? PROG_NIGHT : PROG_DAY;
    const chord = prog[Math.floor(step / 8) % prog.length];
    const i = step % 8;
    const t = nextNoteTime;
    if (i === 0) tone(N(chord[0] - 12), t, beat * 3.5, { type: 'sine', vol: 0.22, dest: musicGain, attack: 0.02 });
    if (i === 4) tone(N(chord[0] - 12 + 7), t, beat * 2.5, { type: 'sine', vol: 0.12, dest: musicGain, attack: 0.02 });
    const arp = [0, 1, 2, 1, 0, 2, 1, 2][i];
    tone(N(chord[arp] + (i > 4 ? 12 : 0)), t, beat * 1.6, { type: 'triangle', vol: night ? 0.07 : 0.09, dest: musicGain });
    if (!night && (i === 2 || i === 6) && Math.random() < 0.45) {
      tone(N(PENTA[Math.floor(Math.random() * PENTA.length)]), t, beat * 2, { type: 'sine', vol: 0.06, dest: musicGain, attack: 0.01 });
    }
    if (night && i === 3 && Math.random() < 0.5) tone(N(PENTA[Math.floor(Math.random() * 4)] + 12), t, beat * 3, { type: 'sine', vol: 0.035, dest: musicGain, attack: 0.05 });
    nextNoteTime += beat;
    step++;
  }
}

export function vibrate(pattern) {
  if (settings.haptics === false) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
