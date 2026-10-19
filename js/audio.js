// Audio: soft synthesized sound effects and a gentle generative ukulele-ish
// loop, all through Web Audio with separate music / SFX gain. Real recordings
// can replace any effect: put files in assets/audio and list them in
// AUDIO_FILES — loaded buffers take priority over the synth versions.
export const AUDIO_FILES = {
  // cast: 'assets/audio/cast.ogg',
};

let ctx = null, master, musicGain, sfxGain;
const buffers = new Map();
let settings = { music: 0.5, sfx: 0.7, haptics: true };
let musicOn = false, musicTimer = null, nextNoteTime = 0, step = 0, mood = 'day';

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.connect(master);
  applyVolumes();
  for (const [id, url] of Object.entries(AUDIO_FILES)) {
    fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => buffers.set(id, buf)).catch(() => {});
  }
}

export function setVolumes(s) { settings = { ...settings, ...s }; applyVolumes(); }
function applyVolumes() {
  if (!ctx) return;
  musicGain.gain.setTargetAtTime(settings.music * 0.35, ctx.currentTime, 0.1);
  sfxGain.gain.setTargetAtTime(settings.sfx * 0.6, ctx.currentTime, 0.05);
}

export function pauseAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

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

export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  nextNoteTime = ctx.currentTime + 0.1;
  step = 0;
  musicTimer = setInterval(scheduleMusic, 120);
}

export function stopMusic() { musicOn = false; clearInterval(musicTimer); }

function scheduleMusic() {
  if (!ctx || ctx.state !== 'running') return;
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
