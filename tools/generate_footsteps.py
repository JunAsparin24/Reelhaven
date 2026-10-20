"""Generate Tide & Town's footstep sound effects (original, procedurally
synthesised — no third-party recordings). Writes small mono 16-bit WAV files
to assets/audio/footsteps/. Re-run any time:

    py tools/generate_footsteps.py      (Windows)
    python3 tools/generate_footsteps.py

Every surface gets several takes so steps never sound identical. Replace any
file with a real recording of the same name to upgrade the sound.
"""
import math
import os
import random
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio', 'footsteps')


# ------------------------------------------------------------------ DSP helpers
def noise(n, rng):
    return [rng.uniform(-1, 1) for _ in range(n)]


def lowpass(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / RATE)
    y, prev = [], 0.0
    for v in x:
        prev = (1 - a) * v + a * prev
        y.append(prev)
    return y


def highpass(x, cutoff):
    lp = lowpass(x, cutoff)
    return [a - b for a, b in zip(x, lp)]


def bandpass(x, f0, q):
    """RBJ biquad band-pass (constant 0 dB peak)."""
    w0 = 2 * math.pi * f0 / RATE
    alpha = math.sin(w0) / (2 * q)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1 + alpha, -2 * math.cos(w0), 1 - alpha
    y, x1, x2, y1, y2 = [], 0.0, 0.0, 0.0, 0.0
    for v in x:
        o = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, v, y1, o
        y.append(o)
    return y


def env(n, attack, decay, curve=3.0):
    """Fast attack, exponential-ish decay envelope over n samples (seconds in)."""
    a = max(1, int(attack * RATE))
    out = []
    for i in range(n):
        if i < a:
            out.append(i / a)
        else:
            t = (i - a) / max(1, decay * RATE)
            out.append(max(0.0, math.exp(-curve * t)))
    return out


def sine(n, freq, rng=None, drift=0.0):
    out, ph = [], 0.0
    for i in range(n):
        f = freq * (1 - drift * i / n)
        ph += 2 * math.pi * f / RATE
        out.append(math.sin(ph))
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] if i < len(t) else 0.0 for t in tracks) for i in range(n)]


def scale(x, g):
    return [v * g for v in x]


def mul(a, b):
    return [x * y for x, y in zip(a, b)]


def place(n, burst, at):
    out = [0.0] * n
    for i, v in enumerate(burst):
        if 0 <= at + i < n:
            out[at + i] += v
    return out


def normalise(x, peak=0.5):
    m = max(abs(v) for v in x) or 1.0
    return [v / m * peak for v in x]


def fade_tail(x, ms=8):
    k = int(ms / 1000 * RATE)
    for i in range(k):
        x[-1 - i] *= i / k
    return x


# ------------------------------------------------------------------ surfaces
def grass(rng):
    n = int(0.16 * RATE)
    swish = mul(lowpass(highpass(noise(n, rng), 300), 1800 + rng.uniform(-300, 300)), env(n, 0.012, 0.08, 4))
    thump = mul(lowpass(noise(n, rng), 220), env(n, 0.004, 0.05, 5))
    return normalise(mix(scale(swish, 0.7), scale(thump, 0.9)), 0.42)


def sand(rng):
    n = int(0.17 * RATE)
    out = [0.0] * n
    # many tiny grains crunching over ~110 ms
    for _ in range(rng.randint(26, 36)):
        at = int(abs(rng.gauss(0.035, 0.03)) * RATE)
        g = int(0.004 * RATE)
        grain = mul(bandpass(noise(g, rng), rng.uniform(2200, 4200), 1.4), env(g, 0.0005, 0.002, 4))
        out = mix(out, place(n, scale(grain, rng.uniform(0.3, 1.0)), at))
    body = mul(lowpass(noise(n, rng), 600), env(n, 0.006, 0.06, 4))
    return normalise(mix(out, scale(body, 0.5)), 0.4)


def wood(rng, indoor=False):
    n = int((0.16 if indoor else 0.22) * RATE)
    f = rng.uniform(150, 190) * (1.45 if indoor else 1.0)
    knock = mul(sine(n, f, drift=0.12), env(n, 0.002, 0.05 if indoor else 0.09, 4))
    body = mul(sine(n, f * 2.7, drift=0.05), env(n, 0.001, 0.03, 5))
    click = mul(bandpass(noise(n, rng), 2600, 2.0), env(n, 0.0005, 0.008, 5))
    hollow = mul(bandpass(noise(n, rng), f * 3.1, 6.0), env(n, 0.003, 0.07 if not indoor else 0.04, 3))
    return normalise(mix(scale(knock, 0.9), scale(body, 0.35), scale(click, 0.5), scale(hollow, 0.6)), 0.45)


def stone(rng):
    n = int(0.13 * RATE)
    click = mul(highpass(noise(n, rng), 1800), env(n, 0.0004, 0.012, 5))
    ring = mul(bandpass(noise(n, rng), rng.uniform(1300, 1700), 7.0), env(n, 0.001, 0.04, 4))
    scuff = mul(bandpass(noise(n, rng), 900, 1.0), env(n, 0.004, 0.03, 4))
    return normalise(mix(scale(click, 0.8), scale(ring, 0.7), scale(scuff, 0.5)), 0.42)


def shallow_water(rng):
    n = int(0.28 * RATE)
    splash = mul(bandpass(noise(n, rng), rng.uniform(900, 1300), 0.7), env(n, 0.008, 0.11, 3))
    out = scale(splash, 0.8)
    # little bubble blips that rise in pitch
    for _ in range(rng.randint(3, 6)):
        at = int(rng.uniform(0.02, 0.15) * RATE)
        m = int(0.03 * RATE)
        f = rng.uniform(500, 1100)
        blip = []
        ph = 0.0
        for i in range(m):
            ph += 2 * math.pi * f * (1 + 1.6 * i / m) / RATE
            blip.append(math.sin(ph))
        blip = mul(blip, env(m, 0.002, 0.015, 3))
        out = mix(out, place(n, scale(blip, rng.uniform(0.15, 0.35)), at))
    return normalise(fade_tail(out), 0.42)


def mud(rng):
    n = int(0.22 * RATE)
    squelch = []
    base = noise(n, rng)
    # sweeping low-pass gives the wet "schlup"
    a_prev = 0.0
    for i, v in enumerate(base):
        cutoff = 250 + 900 * (i / n)
        a = math.exp(-2 * math.pi * cutoff / RATE)
        a_prev = (1 - a) * v + a * a_prev
        squelch.append(a_prev)
    squelch = mul(squelch, env(n, 0.015, 0.1, 3))
    low = mul(sine(n, 90, drift=0.3), env(n, 0.006, 0.07, 4))
    return normalise(mix(scale(squelch, 1.0), scale(low, 0.5)), 0.4)


# grass, sand, wood and mud now use recorded steps (tools/slice_footsteps.py),
# so they're left out here to avoid overwriting them.
SURFACES = {
    'stone': (stone, 3),
    'shallow_water': (shallow_water, 3),
    'indoor_wood': (lambda r: wood(r, indoor=True), 2),
}


def write_wav(path, samples):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in samples))


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, (fn, count) in SURFACES.items():
        for k in range(1, count + 1):
            rng = random.Random(f'{name}-{k}')
            path = os.path.join(OUT, f'{name}_{k}.wav')
            write_wav(path, fade_tail(fn(rng)))
            print('wrote', os.path.relpath(path))


if __name__ == '__main__':
    main()
