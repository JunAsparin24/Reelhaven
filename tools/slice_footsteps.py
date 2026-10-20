"""Cut single footsteps out of a walking recording and fit them to the game's
step rate (one foot-down every 0.25 s at normal walking speed). Steps whose
tail runs long are sped up (up to 1.5x), then trimmed and faded so each take
is at most 0.22 s. Needs: pip install numpy imageio-ffmpeg

    py tools/slice_footsteps.py <recording> assets/audio/footsteps <surface> <min_gap_s> <takes>

Used for grass (gap 0.4), sand (0.3), wood (0.25) and mud (0.3, from a dirt
recording) — Epidemic Sound clips. Update FOOTSTEP_FILES in js/audio.js
with the number of takes written.
"""
import subprocess, sys, wave, numpy as np, imageio_ffmpeg
from numpy.lib.stride_tricks import sliding_window_view
FF = imageio_ffmpeg.get_ffmpeg_exe()
RATE = 44100
MAX_LEN = 0.22      # seconds; must fit inside the 0.25 s step gap
FIT_LEN = 0.19      # tail longer than this gets sped up to fit
MAX_SPEED = 1.5
def load(p):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(RATE), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float64) / 32768
def envelope(x, ms=10):
    w = int(RATE * ms / 1000)
    return np.sqrt(np.convolve(x * x, np.ones(w) / w, 'same'))
def steps(x, min_gap):
    env = envelope(x)
    g = int(min_gap * RATE)
    loc = sliding_window_view(np.pad(env, g), 2 * g + 1).max(axis=1)
    cand = np.where((env == loc) & (env > 0))[0]
    floor = np.percentile(env, 30)
    vals = env[cand]
    keep = cand[vals > max(floor * 4, np.percentile(vals, 50) * 0.5)]
    return env, keep, floor
def cut(x, env, pk, nxt):
    p = env[pk]
    s = pk
    while s > pk - int(0.08 * RATE) and env[s] > p * 0.12: s -= 1
    s = max(0, s - int(0.004 * RATE))
    e = pk
    lim = min(len(x), (nxt - int(0.02 * RATE)) if nxt is not None else len(x), pk + int(0.6 * RATE))
    while e < lim and env[e] > p * 0.07: e += 1
    seg = x[s:e].copy()
    dur = len(seg) / RATE
    speed = float(np.clip(dur / FIT_LEN, 1.0, MAX_SPEED))
    if speed > 1.0:
        n = int(len(seg) / speed)
        seg = np.interp(np.arange(n) * speed, np.arange(len(seg)), seg)
    seg = seg[:int(MAX_LEN * RATE)]
    fi, fo = int(0.003 * RATE), min(int(0.05 * RATE), len(seg) // 2)
    seg[:fi] *= np.linspace(0, 1, fi)
    seg[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    seg -= seg.mean()
    return seg, dur, speed
def save(path, seg):
    seg = seg * (0.075 / np.sqrt((seg ** 2).mean()))
    pk = np.abs(seg).max()
    if pk > 0.8: seg *= 0.8 / pk
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
if __name__ == '__main__':
    src, out, surface, gap, count = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), int(sys.argv[5])
    x = load(src)
    env, pks, floor = steps(x, gap)
    med = np.median(env[pks])
    good = []
    for i, pk in enumerate(pks):
        nxt = pks[i + 1] if i + 1 < len(pks) else None
        if env[pk] > med * 3 or env[pk] < med * 0.45: continue
        seg, dur, speed = cut(x, env, pk, nxt)
        if len(seg) < 0.04 * RATE: continue
        a, b = max(0, pk - int(0.15 * RATE)), max(1, pk - int(0.06 * RATE))
        pre = env[a:b].mean() if b > a else floor
        good.append((env[pk] / (pre + 1e-9), pk, seg, dur, speed))
    print(f'{surface}: {len(pks)} peaks, {len(good)} usable')
    good.sort(key=lambda g: -g[0])
    chosen = sorted(good[:count], key=lambda g: g[1])
    for n, (score, pk, seg, dur, speed) in enumerate(chosen, 1):
        save(f'{out}/{surface}_{n}.wav', seg)
        print(f'  {surface}_{n}: at {pk/RATE:6.2f}s  tail {dur:.2f}s  speed x{speed:.2f}  -> {len(seg)/RATE:.3f}s  clarity {score:.1f}')
