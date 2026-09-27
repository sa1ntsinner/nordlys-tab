"""Where a piece of music moves, for a film cut to it.

    python tools/video/music-events.py map <track> <out.json> [--stems <dir>] [--bpm 120]
    python tools/video/music-events.py scan <out.json> <track> [<track> ...]

(run with uv: uv run --python 3.12 --with librosa --with numpy --with scipy python ...)

map: the music map the Remotion edit is timed from.
    tempo, beats, downbeats   an exact grid: the track's own tempo, fitted to
                              its onsets to a fraction of a millisecond
    bars                      every bar: start, energy of the mix, the drums,
                              the bass and the rest, in dB
    sections                  intro, groove, build, drop, break, outro
    events                    what an editor cuts on, each with its time, bar
                              and beat, strength 0..1 and length:
        kick, clap (claps, snares, snaps), hat, crash, stab (a short chord or
        synth hit), whoosh (a noise swell into a beat), sweep (noise passing
        by), riser (a long build of pitch and level), downlifter (noise
        falling away after a hit), drop (the big arrival), stop (a gap of
        near silence), fill (a burst of drum hits at a phrase end)
    With --stems (a folder with drums.wav, bass.wav, other.wav, vocals.wav
    from Demucs, tools/video/stems.py), the drums are found in the drum stem
    and the stabs and swells in the rest; without, a harmonic/percussive split
    of the mix stands in.

scan: the same measures, cheaper, for many candidate tracks; prints a ranking
    by how well the accents can carry a film (see score()).

Nothing is added to the music: the film follows what is in it.
"""
import json
import pathlib
import sys

import librosa
import numpy as np
import scipy.ndimage as ndi

SR = 44100
HOP = 256
FR = SR / HOP  # analysis frames per second, about 172
EPS = 1e-10


def load(path):
    y, _ = librosa.load(str(path), sr=SR, mono=True)
    return y.astype(np.float32)


def stft(y):
    return np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP)).astype(np.float32)


FREQS = librosa.fft_frequencies(sr=SR, n_fft=2048)


def band(S, lo, hi):
    return S[(FREQS >= lo) & (FREQS < hi)]


def db(x):
    return 10 * np.log10(np.maximum(x, EPS))


def flux(Sb):
    """Onset strength of one band: the rise of its log spectrum, frame to frame."""
    L = np.log1p(1000 * Sb)
    return np.maximum(0, np.diff(L, axis=1, prepend=L[:, :1])).mean(axis=0)


def frames(t):
    return np.clip(np.round(np.asarray(t) * FR).astype(int), 0, None)


def smooth(x, seconds):
    return ndi.uniform_filter1d(x, max(1, int(seconds * FR)), mode='nearest')


def peaks(env, wait=0.09, spread=0.35, k=1.0):
    """Local maxima standing out from a moving median by k spreads."""
    w = max(3, int(wait * FR))
    med = ndi.median_filter(env, size=max(3, int(spread * FR)) | 1, mode='nearest')
    mad = ndi.median_filter(np.abs(env - med), size=max(3, int(2 * spread * FR)) | 1, mode='nearest') + 1e-6
    ismax = env == ndi.maximum_filter1d(env, 2 * w + 1, mode='nearest')
    p = np.flatnonzero(ismax & (env > med + k * 4 * mad) & (env > np.percentile(env, 60)))
    keep, last = [], -10 ** 9
    for i in p:
        if i - last >= w:
            keep.append(i)
            last = i
        elif env[i] > env[keep[-1]]:
            keep[-1] = i
            last = i
    return np.array(keep, dtype=int)


# ── The grid ──

def fit_grid(env, low_env, duration, bpm_fixed=None):
    """The tempo and phase of the one steady grid that fits the whole track.

    A produced track keeps its tempo exactly, so one period and one phase fit
    all of it. The kicks (the low band) mark the beat most sharply: the period
    is searched where their phases line up best (the length of their mean
    phase vector), then period and phase are fitted to them by least squares.
    Returns the tempo, the beats, the median distance of strong onsets from
    the grid and the worst drift over the track (both in seconds), so a track
    that is not on one grid shows it."""
    tempo = librosa.feature.tempo(onset_envelope=env, sr=SR, hop_length=HOP, start_bpm=124, max_tempo=200)
    bpm0 = float(np.atleast_1d(tempo)[0])
    # The octave between 95 and 165 bpm: that is the pulse a film cuts to.
    while bpm0 < 95:
        bpm0 *= 2
    while bpm0 > 165:
        bpm0 /= 2
    def refine(kt, kw, bpm):
        period = 60 / bpm
        t0 = float((np.angle(np.sum(kw * np.exp(2j * np.pi * kt / period))) / (2 * np.pi)) % 1 * period)
        for _ in range(0 if bpm_fixed else 6):
            n = np.round((kt - t0) / period)
            res = kt - (t0 + n * period)
            near = np.abs(res) < 0.04
            if near.sum() < 16:
                break
            A = np.vstack([np.ones(near.sum()), n[near]]).T
            (d0, dp), *_ = np.linalg.lstsq(A * kw[near, None], res[near] * kw[near], rcond=None)
            t0 += float(d0)
            period += float(dp)
        n = np.round((kt - t0) / period)
        res = kt - (t0 + n * period)
        if bpm_fixed:
            near = np.abs(res) < 0.04
            t0 += float(np.median(res[near])) if near.any() else 0.0
            res = kt - (t0 + n * period)
        fit = float(np.sum(kw * (np.abs(res) < 0.012)) / (kw.sum() + EPS))
        return fit, period, t0

    best = None
    if bpm_fixed:
        bpm0 = bpm_fixed
    for env_k in (low_env, env):
        kicks = peaks(env_k, wait=0.2, k=1.5)
        if len(kicks) < 24:
            continue
        kt, kw = kicks / FR, env_k[kicks]
        strong = kw > np.percentile(kw, 40)
        kt, kw = kt[strong], kw[strong]
        cand = np.array([bpm_fixed]) if bpm_fixed else np.arange(bpm0 * 0.97, bpm0 * 1.03, 0.002)
        R = np.abs(np.exp(2j * np.pi * np.outer(cand / 60, kt)) @ kw) / (kw.sum() + EPS)
        # The strongest few peaks of the phase alignment, each refined; the
        # one that puts most of the kicks within 12 ms of the grid wins.
        order = [i for i in np.argsort(-R) if R[max(0, i - 1)] <= R[i] >= R[min(len(R) - 1, i + 1)]][:6]
        for i in order:
            fit, period, t0 = refine(kt, kw, float(cand[i]))
            if best is None or fit > best[0]:
                best = (fit, period, t0)
    if best is None:
        period, t0 = 60 / bpm0, 0.0
    else:
        _, period, t0 = best
    beats = np.arange(t0 % period, duration, period)
    res = []
    for b in beats:
        a, c = frames(b - 0.04), frames(b + 0.04)
        if c >= len(env):
            break
        seg = env[a:c + 1]
        if seg.max() > np.percentile(env, 75):
            res.append(((a + int(np.argmax(seg))) / FR - b, b))
    res = np.array(res) if res else np.zeros((0, 2))
    mad = float(np.median(np.abs(res[:, 0]))) if len(res) else 1.0
    # Drift: the median residual in each 16-second stretch, worst against best.
    drift = 0.0
    if len(res):
        chunks = [np.median(res[(res[:, 1] >= a) & (res[:, 1] < a + 16), 0]) for a in np.arange(0, duration, 16)
                  if np.sum((res[:, 1] >= a) & (res[:, 1] < a + 16)) >= 6]
        drift = float(np.ptp(chunks)) if chunks else 0.0
    return 60 / period, beats, mad, drift


def beat_sync(X, beat_frames, T):
    edges = np.concatenate([beat_frames, [T]])
    return np.stack([X[:, a:max(a + 1, b)].mean(axis=1) for a, b in zip(edges[:-1], edges[1:])], axis=1)


def downbeat_phase(S, beats, low_env, high_env):
    """Which of every four beats is the one: chords and bass notes change
    there, and crashes and entrances land there."""
    T = S.shape[1]
    bf = np.clip(frames(beats), 0, T - 1)
    chroma = librosa.feature.chroma_stft(S=S ** 2, sr=SR, hop_length=HOP)
    C = beat_sync(chroma, bf, T)
    C = C / (np.linalg.norm(C, axis=0, keepdims=True) + EPS)
    h = np.concatenate([[0], 1 - np.sum(C[:, 1:] * C[:, :-1], axis=0)])
    lowb = beat_sync(band(S, 30, 160) ** 2, bf, T).sum(axis=0)
    l = np.concatenate([[0], np.maximum(0, np.diff(db(lowb)))])
    c = np.array([high_env[max(0, f - 4):f + 6].max() if f + 6 < len(high_env) else 0 for f in bf])

    def zs(x):
        return (x - x.mean()) / (x.std() + EPS)
    score = zs(h) + 0.5 * zs(l) + 0.5 * zs(c)
    return int(np.argmax([score[p::4].mean() for p in range(4)]))


# ── Events ──

def hits(Sd):
    """Drum hits, from the drum stem (or the percussive part of the mix),
    found band by band so that a kick and a clap on one beat are both found:
    kicks in the low band; claps, snares and snaps where they crack (1.5 to
    7 kHz, and louder there than above); hats above 7 kHz; crashes, hats
    that are loud and ring on for a good part of a second."""
    out = []
    lo_b, hm_b, top_b = band(Sd, 30, 150), band(Sd, 1500, 7000), band(Sd, 7000, 18000)
    hm_e, top_e = (hm_b ** 2).sum(axis=0) + EPS, (top_b ** 2).sum(axis=0) + EPS
    top_db = smooth(db(top_e), 0.03)
    T = Sd.shape[1]
    for kind, env, wait, k in (('kick', flux(lo_b), 0.2, 1.2), ('clap', flux(hm_b), 0.1, 1.2), ('hat', flux(top_b), 0.06, 1.0)):
        p = peaks(env, wait=wait, k=k)
        if not len(p):
            continue
        s = np.clip(env[p] / (np.percentile(env[p], 98) + EPS), 0, 1)
        for i, si in zip(p, s):
            a, b = i, min(T, i + int(0.03 * FR) + 1)
            e = {'t': round(float(i / FR), 4), 'type': kind, 's': round(float(si), 3)}
            if kind == 'clap':
                if hm_e[a:b].sum() < 0.8 * top_e[a:b].sum():
                    continue
                seg = hm_b[:, a:b] ** 2 + EPS
                e['flat'] = round(float(np.exp(np.mean(np.log(seg))) / np.mean(seg)), 3)
            if kind == 'hat':
                ring = top_db[min(T - 1, i + int(0.4 * FR))] - top_db[a:b].max()
                if ring > -6 and si > 0.6:
                    e['type'] = 'crash'
                    e['ring_db'] = round(float(ring), 1)
            out.append(e)
    return out


def stabs(So, y_other=None):
    """Short loud chord or synth hits in the non-drum part."""
    env = flux(band(So, 100, 8000))
    p = peaks(env, wait=0.12, k=1.6)
    out = []
    lvl = db((band(So, 100, 8000) ** 2).sum(axis=0))
    base = ndi.percentile_filter(lvl, 30, size=int(2 * FR) | 1, mode='nearest')
    for i in p:
        rise = lvl[min(len(lvl) - 1, i + 3)] - base[i]
        after = lvl[min(len(lvl) - 1, i + int(0.22 * FR))]
        decay = lvl[min(len(lvl) - 1, i + 3)] - after
        if rise > 6 and decay > 4:
            out.append({'t': round(float(i / FR), 4), 'type': 'stab', 's': float(min(1, rise / 18)), 'dur': 0.2})
    return out


def swells(S, beats, bar):
    """Noise that swells and fades, measured on the mix: whooshes into a beat,
    sweeps passing by, risers building for bars, downlifters falling away.

    High-band energy weighted by how noise-like it is (spectral flatness),
    with short hits taken out by a median over a beat. What the groove does
    every bar (hats, claps and their tails) is taken out too: each moment is
    measured against the same moment one and two bars before and after, so
    only what happens once stands out. Each bump above that is one swell."""
    hb = band(S, 1500, 16000) ** 2 + EPS
    flat = np.exp(np.mean(np.log(hb), axis=0)) / np.mean(hb, axis=0)
    e = db(hb.sum(axis=0))
    noisy = e + 10 * np.log10(np.clip(flat / (np.median(flat) + EPS), 0.1, 10))
    beat = bar / 4
    ns = ndi.median_filter(noisy, size=int(beat * 0.9 * FR) | 1, mode='nearest')
    L = int(round(bar * FR))
    T = len(ns)
    shifted = []
    for k in (-2, -1, 1, 2):
        x = np.full(T, np.nan)
        if k < 0:
            x[-k * L:] = ns[:T + k * L]
        else:
            x[:T - k * L] = ns[k * L:]
        shifted.append(x)
    expect = np.nanmedian(np.vstack(shifted), axis=0)
    expect = np.where(np.isnan(expect), ns, expect)
    bump = smooth(ns - np.minimum(expect, ns + 0), 0.05)
    cent = librosa.feature.spectral_centroid(S=band(S, 1500, 16000), freq=FREQS[(FREQS >= 1500) & (FREQS < 16000)])[0]
    on = bump > 6
    lab, n = ndi.label(on)
    out = []
    near = lambda t: float(np.min(np.abs(beats - t))) if len(beats) else 1.0
    for k in range(1, n + 1):
        idx = np.flatnonzero(lab == k)
        a, b = idx[0], idx[-1]
        dur = (b - a) / FR
        if dur < 0.3 or dur > 16:
            continue
        pk = a + int(np.argmax(ns[a:b + 1]))
        height = float(bump[a:b + 1].max())
        rise = (pk - a) / max(1, b - a)
        seg = np.log2(np.maximum(smooth(cent, 0.1)[a:b + 1], 1))
        slope = float(np.polyfit(np.arange(len(seg)) / FR, seg, 1)[0]) if len(seg) > 4 else 0.0
        end_t, start_t = b / FR, a / FR
        if dur >= 1.5 and rise > 0.6 and slope > -0.05:
            kind = 'riser'
        elif rise > 0.55 and near(end_t) < 0.15:
            kind = 'whoosh'
        elif rise < 0.3 and near(start_t) < 0.15 and slope < 0.05:
            kind = 'downlifter'
        else:
            kind = 'sweep'
        out.append({'t': round(float(pk / FR), 4), 'type': kind, 'start': round(start_t, 4), 'end': round(end_t, 4),
                    'dur': round(dur, 3), 's': round(float(min(1, height / 18)), 3), 'slope': round(slope, 3),
                    'rise': round(float(rise), 2)})
    return out


def tonal_risers(So, downbeats, bar):
    """Pitch and level climbing steadily for two bars or more in the non-drum
    part, into a downbeat."""
    cen = np.log2(np.maximum(smooth(librosa.feature.spectral_centroid(S=So, freq=FREQS)[0], 0.3), 1))
    lvl = smooth(db((So ** 2).sum(axis=0)), 0.3)
    out = []
    for d in downbeats:
        best = None
        for bars in (2, 4, 8):
            a, b = frames(d - bars * bar), frames(d)
            if a < 0 or b >= len(lvl) or b - a < 8:
                continue
            x = np.arange(b - a) / FR
            c, l = cen[a:b], lvl[a:b]
            cs = np.polyfit(x, c, 1)[0] * bar  # octaves per bar
            ls = np.polyfit(x, l, 1)[0] * bar  # dB per bar
            rc = np.corrcoef(x, c)[0, 1]
            rl = np.corrcoef(x, l)[0, 1]
            if cs > 0.08 and ls > 0.5 and rc > 0.6 and rl > 0.5:
                s = min(1, (cs / 0.4 + ls / 5) / 2 * min(1, bars / 4) * (rc + rl) / 2)
                if best is None or s > best['s']:
                    best = {'t': round(float(d), 4), 'type': 'riser', 'start': round(float(d - bars * bar), 4), 'end': round(float(d), 4),
                            'dur': round(bars * bar, 3), 's': round(float(s), 3), 'bars': bars, 'tonal': True}
        if best:
            out.append(best)
    return out


def stops(y_rms_db, downbeats, beat):
    """A gap of near silence, most often the breath before a drop."""
    out = []
    med = ndi.median_filter(y_rms_db, size=int(8 * FR) | 1, mode='nearest')
    quiet = y_rms_db < med - 14
    lab, n = ndi.label(quiet)
    for k in range(1, n + 1):
        idx = np.flatnonzero(lab == k)
        dur = (idx[-1] - idx[0]) / FR
        if dur >= beat * 0.4:
            a, b = idx[0] / FR, idx[-1] / FR
            out.append({'t': round(float(a), 4), 'type': 'stop', 'start': round(float(a), 4), 'end': round(float(b), 4), 'dur': round(dur, 3),
                        's': round(float(min(1, (med[idx] - y_rms_db[idx]).mean() / 30)), 3)})
    return out


def drops_at(low_db, full_db, downbeats, bar):
    """Downbeats where the low end (kick and bass) arrives: the next two bars
    against the last two (or the last one, for a bar-long stop before it)."""
    out = []
    for d in downbeats:
        a2, a1, b, c = frames(d - 2 * bar), frames(d - bar), frames(d), frames(d + 2 * bar)
        if a2 < 0 or c >= len(low_db):
            continue
        after = np.mean(low_db[b:c])
        before = max(np.mean(low_db[a2:b]), np.mean(low_db[a1:b]) - 3)
        jump = after - before
        fj = np.mean(full_db[b:c]) - np.mean(full_db[a2:b])
        if jump > 6 and fj > 2:
            out.append({'t': round(float(d), 4), 'type': 'drop', 's': round(float(min(1, jump / 18)), 3), 'jump_db': round(float(jump), 2)})
    # Keep the strongest within any four bars.
    out.sort(key=lambda e: -e['s'])
    kept = []
    for e in out:
        if all(abs(e['t'] - k['t']) > 3.5 * bar for k in kept):
            kept.append(e)
    return sorted(kept, key=lambda e: e['t'])


def fills(hit_list, downbeats, beat):
    """A burst of drum hits in the last beat or two of a bar."""
    ht = np.array([h['t'] for h in hit_list if h['type'] in ('clap', 'kick', 'hat', 'crash')])
    if not len(ht):
        return []
    per_beat = []
    for d in downbeats:
        per_beat.append(np.sum((ht >= d) & (ht < d + 4 * beat)) / 4)
    typical = np.median(per_beat) if per_beat else 1
    out = []
    for d in downbeats[1:]:
        n = np.sum((ht >= d - beat) & (ht < d - 0.02))
        if n >= max(4, 2.2 * typical):
            out.append({'t': round(float(d - beat), 4), 'type': 'fill', 'start': round(float(d - beat), 4), 'end': round(float(d), 4),
                        'dur': round(beat, 3), 's': round(float(min(1, n / 8)), 3), 'hits': int(n)})
    return out


# ── Sections ──

def sections(bars_info, drops, risers, n_bars):
    """Stretches of bars that sound alike, named by what they do."""
    if not bars_info:
        return []
    F = np.array([[b['full'], b['drums'], b['bass'], b['other'], b['bright']] for b in bars_info])
    Z = (F - F.mean(0)) / (F.std(0) + EPS)
    nov = np.zeros(len(Z))
    for i in range(1, len(Z)):
        a, b = Z[max(0, i - 2):i].mean(0), Z[i:min(len(Z), i + 2)].mean(0)
        nov[i] = np.linalg.norm(a - b)
    th = np.percentile(nov, 80)
    cut = [0] + [i for i in range(2, len(Z) - 1) if nov[i] >= th and nov[i] == nov[max(0, i - 2):i + 3].max()] + [len(Z)]
    # Snap to four-bar phrases where one is near.
    snapped = sorted(set([0, len(Z)] + [int(round(c / 4) * 4) if abs(c - round(c / 4) * 4) <= 1 else c for c in cut[1:-1]]))
    snapped = [c for c in snapped if 0 <= c <= len(Z)]
    out = []
    drums_hi = np.percentile(F[:, 1], 75)
    full_hi = np.percentile(F[:, 0], 75)
    for a, b in zip(snapped[:-1], snapped[1:]):
        if b <= a:
            continue
        seg = F[a:b]
        full, drums = seg[:, 0].mean(), seg[:, 1].mean()
        rise = seg[-1, 0] - seg[0, 0] if b - a > 1 else 0
        start_t, end_t = bars_info[a]['t'], bars_info[b]['t'] if b < len(bars_info) else bars_info[-1]['t'] + bars_info[-1]['len']
        if drums < drums_hi - 12 and full < full_hi - 4:
            kind = 'break'
        elif full > full_hi - 2.5 and drums > drums_hi - 4:
            kind = 'drop'
        elif rise > 3 or any(start_t <= r['t'] <= end_t + 0.1 for r in risers if r.get('bars', 0) >= 2 or r['dur'] > 3):
            kind = 'build'
        else:
            kind = 'groove'
        out.append({'from_bar': a, 'to_bar': b, 'start': round(start_t, 4), 'end': round(end_t, 4), 'kind': kind,
                    'energy_db': round(float(full), 2), 'drums_db': round(float(drums), 2)})
    if out:
        if out[0]['kind'] != 'drop':
            out[0]['kind'] = 'intro'
        if out[-1]['kind'] != 'drop' and len(out) > 1:
            out[-1]['kind'] = 'outro'
    return out


def analyse(path, stems=None, bpm=None):
    y = load(path)
    duration = len(y) / SR
    S = stft(y)
    T = S.shape[1]
    if stems:
        st = {k: stft(load(pathlib.Path(stems) / f'{k}.wav'))[:, :T] for k in ('drums', 'bass', 'other')}
        Sd, Sb, So = st['drums'], st['bass'], st['other']
    else:
        H, P = librosa.decompose.hpss(S, margin=2.0)
        Sd, So = P, H
        Sb = np.where(FREQS[:, None] < 250, H, 0)
    env = flux(band(Sd, 30, 18000))
    high_env = flux(band(Sd, 5000, 18000))
    low_env = flux(band(Sd, 30, 150))
    bpm, beats, mad, drift = fit_grid(env, low_env, duration, bpm)
    beat = 60 / bpm
    bar = 4 * beat
    phase = downbeat_phase(S, beats, low_env, high_env)
    # The first bar starts at the first downbeat where the music has begun.
    rms = db((S ** 2).sum(axis=0))
    begun = np.flatnonzero(rms > np.percentile(rms, 95) - 40)
    t_begin = begun[0] / FR if len(begun) else 0
    downbeats = beats[phase::4]
    first = int(np.searchsorted(downbeats, t_begin - beat * 0.5))
    downbeats = downbeats[max(0, first - (1 if first > 0 and downbeats[first] - t_begin > 2 * beat else 0)):]
    full_db = smooth(rms, 0.05)
    low_db = smooth(db((band(Sb, 30, 160) ** 2).sum(axis=0) + (band(Sd, 30, 160) ** 2).sum(axis=0)), 0.1)
    drums_db = smooth(db((Sd ** 2).sum(axis=0)), 0.1)
    bass_db = smooth(db((Sb ** 2).sum(axis=0)), 0.1)
    other_db = smooth(db((So ** 2).sum(axis=0)), 0.1)
    bright = librosa.feature.spectral_centroid(S=S, freq=FREQS)[0]
    bars_info = []
    for i, d in enumerate(downbeats):
        a, b = frames(d), frames(d + bar)
        if b >= T:
            break
        mean_db = lambda x: float(db(np.mean(10 ** (x[a:b] / 10))))
        bars_info.append({'bar': i, 't': round(float(d), 4), 'len': round(bar, 4), 'full': round(mean_db(full_db), 2), 'drums': round(mean_db(drums_db), 2),
                          'bass': round(mean_db(bass_db), 2), 'other': round(mean_db(other_db), 2), 'bright': round(float(np.log2(np.median(bright[a:b]) + 1)), 3)})
    hit_list = hits(Sd)
    sw = swells(S, beats, bar)
    tr = tonal_risers(So, downbeats, bar)
    dr = drops_at(low_db, full_db, downbeats, bar)
    stp = stops(full_db, downbeats, beat)
    fl = fills(hit_list, downbeats, beat)
    st_list = stabs(So)
    events = hit_list + sw + tr + dr + stp + fl + st_list

    def where(t):
        i = int(np.searchsorted(downbeats, t + 1e-6)) - 1
        if i < 0:
            return -1, round(float((t - downbeats[0]) / beat), 3) if len(downbeats) else 0
        return i, round(float((t - downbeats[i]) / beat), 3)
    for e in events:
        e['bar'], e['beat'] = where(e['t'])
    events.sort(key=lambda e: e['t'])
    secs = sections(bars_info, dr, [e for e in events if e['type'] == 'riser'], len(bars_info))
    return {
        'source': pathlib.Path(path).name, 'duration': round(duration, 3), 'tempo': round(bpm, 4), 'beat': round(beat, 5), 'bar': round(bar, 5),
        'grid': {'residual_ms': round(mad * 1000, 2), 'drift_ms': round(drift * 1000, 2), 'downbeat_phase': phase},
        'beats': [round(float(b), 4) for b in beats], 'downbeats': [round(float(d), 4) for d in downbeats],
        'bars': bars_info, 'sections': secs, 'events': events,
    }


def unique_hits(ev, bar, kinds=('clap', 'crash', 'stab', 'kick')):
    """Hits the groove does not repeat: nothing like them at the same place
    one or two bars before or after. These are the accents to show a new
    thing on; the claps on two and four are the pulse to cut on."""
    by = {}
    for e in ev:
        if e['type'] in kinds and e['s'] >= 0.35:
            by.setdefault(e['type'], []).append(e)
    out = []
    for lst in by.values():
        ts = np.array([e['t'] for e in lst])
        ss = np.array([e['s'] for e in lst])
        for e in lst:
            same = 0
            for d in (-2, -1, 1, 2):
                j = np.flatnonzero(np.abs(ts - (e['t'] + d * bar)) < 0.03)
                if len(j) and ss[j].max() > 0.6 * e['s']:
                    same += 1
            if same <= 1:
                out.append(e)
    return out


def score(m, window=(70, 100)):
    """How well a track's accents can carry a product film, about 0 to 100.

    Asked of the best stretch of 70 to 100 s that starts on a four-bar
    phrase: hits the groove does not repeat, swells of noise to move on
    (whooshes, sweeps, risers, downlifters), real drops, a calm break with
    the drums out, an end (a last hit that rings out, or a quiet phrase end
    to fade on), a tempo near 125, and one steady grid."""
    ev = m['events']
    tempo, bar = m['tempo'], m['bar']
    if not m['bars']:
        return {'total': 0}
    uniq = unique_hits(ev, bar)
    starts = [b['t'] for b in m['bars'] if b['bar'] % 4 == 0][:6]
    full = [b['full'] for b in m['bars']]
    best = None
    for s0 in starts:
        for length in np.arange(window[0], window[1] + 0.1, bar):
            e0, e1 = s0, s0 + length
            if e1 > m['duration'] + 0.5:
                break
            inside = lambda kinds, smin: [e for e in ev if e0 <= e['t'] < e1 and e['type'] in kinds and e['s'] >= smin]
            u = sum(1 for e in uniq if e0 <= e['t'] < e1)
            sw = len(inside(('whoosh', 'sweep', 'downlifter'), 0.3)) + 2 * len(inside(('riser',), 0.25))
            drops = inside(('drop',), 0)
            brk = [x for x in m['sections'] if x['kind'] == 'break' and x['start'] >= e0 + 8 and x['end'] <= e1 - 8 and x['to_bar'] - x['from_bar'] >= 4]
            tail = [b['full'] for b in m['bars'] if e1 - 2 * bar <= b['t'] < e1]
            ends_track = abs(e1 - m['duration']) < 6
            end_quiet = bool(tail) and np.mean(tail) < np.percentile(full, 40)
            minutes = length / 60
            sc = (min(22, u / minutes * 0.5) + min(22, sw / minutes * 1.5) + min(18, 9 * len(drops))
                  + (12 if brk else 0) + (8 if (ends_track or end_quiet) else 0) + max(0, 10 - abs(tempo - 125) * 0.8))
            if not 112 <= tempo <= 138:
                sc *= 0.5
            if m['grid']['residual_ms'] > 8 or m['grid']['drift_ms'] > 25:
                sc *= 0.75
            if best is None or sc > best['total']:
                best = {'total': round(float(sc), 2), 'from': round(e0, 2), 'to': round(e1, 2), 'unique_per_min': round(u / minutes, 1),
                        'swells_per_min': round(sw / minutes, 1), 'drops': len(drops), 'break': bool(brk), 'ending': bool(ends_track or end_quiet)}
    return best or {'total': 0}


def scan_one(src):
    try:
        m = analyse(src, None)
        sc = score(m)
        kinds = {}
        for e in m['events']:
            kinds[e['type']] = kinds.get(e['type'], 0) + 1
        return {'track': pathlib.Path(src).stem, 'tempo': m['tempo'], 'duration': m['duration'], 'grid_ms': m['grid']['residual_ms'],
                'drift_ms': m['grid']['drift_ms'], 'sections': ' '.join(f"{x['kind']}{x['to_bar'] - x['from_bar']}" for x in m['sections']),
                'events': kinds, **sc}
    except Exception as ex:  # a broken download should not stop the scan
        return {'track': pathlib.Path(src).stem, 'error': str(ex), 'total': 0}


def main():
    mode = sys.argv[1]
    if mode == 'map':
        src, out = sys.argv[2], sys.argv[3]
        stems = sys.argv[sys.argv.index('--stems') + 1] if '--stems' in sys.argv else None
        # A tempo known to be exact (checked another way) can be given; only the phase is then fitted.
        bpm = float(sys.argv[sys.argv.index('--bpm') + 1]) if '--bpm' in sys.argv else None
        m = analyse(src, stems, bpm)
        m['score'] = score(m)
        with open(out, 'w', newline='') as f:
            json.dump(m, f, indent=1)
        kinds = {}
        for e in m['events']:
            kinds[e['type']] = kinds.get(e['type'], 0) + 1
        print(json.dumps({'tempo': m['tempo'], 'grid': m['grid'], 'bars': len(m['bars']), 'events': kinds, 'score': m['score']}))
        print(' '.join(f"{s['kind']}@{s['from_bar']}-{s['to_bar']}" for s in m['sections']))
    elif mode == 'scan':
        from concurrent.futures import ProcessPoolExecutor
        out = sys.argv[2]
        workers = int(sys.argv[sys.argv.index('--workers') + 1]) if '--workers' in sys.argv else 6
        srcs = [a for a in sys.argv[3:] if not a.startswith('--') and not a.isdigit()]
        rows = []
        with ProcessPoolExecutor(workers) as pool:
            for row in pool.map(scan_one, srcs):
                rows.append(row)
                print(json.dumps(row), flush=True)
        rows.sort(key=lambda r: -r.get('total', 0))
        with open(out, 'w', newline='') as f:
            json.dump(rows, f, indent=1)


if __name__ == '__main__':
    main()
