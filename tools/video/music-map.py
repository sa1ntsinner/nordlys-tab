"""The map of a piece of music that the promo video is cut to.

    python tools/video/music-map.py <track.wav|mp3> <out.json>

Nothing is added to the music: the video follows what is already in it.
The map holds
    beats       every beat, in seconds
    downbeats   the first beat of each bar (4/4 assumed)
    accents     the strongest onsets: snares, hits, stabs, the moments to cut on
    sections    stretches of similar sound, each with its mean energy (0..1)
    drops       where the energy jumps up the most: the big arrivals
    energy      loudness per beat (0..1), to pace how busy the picture is
    score       a few numbers to compare candidate tracks by
"""
import json
import sys

import librosa
import numpy as np

src, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=True)
duration = len(y) / sr
hop = 512

# Beats, and which of every four is the one: the beat with the most low end
# (kick) on average is taken as the downbeat phase.
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, tightness=120)
tempo = float(np.atleast_1d(tempo)[0])
beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[freqs < 150].sum(axis=0)
low_at = low[np.clip(beat_frames, 0, len(low) - 1)]
phase = int(np.argmax([low_at[p::4].mean() if len(low_at[p::4]) else 0 for p in range(4)]))
downbeats = beats[phase::4]

# Energy per beat, normalised.
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
edges = np.concatenate([beat_frames, [len(rms)]])
beat_energy = np.array([rms[a:b].mean() if b > a else 0 for a, b in zip(edges[:-1], edges[1:])])
beat_energy = (beat_energy - beat_energy.min()) / (np.ptp(beat_energy) + 1e-9)

# Accents: onset peaks well above their neighbourhood.
peaks = librosa.util.peak_pick(onset_env, pre_max=6, post_max=6, pre_avg=20, post_avg=20, delta=np.percentile(onset_env, 90) * 0.5, wait=8)
strength = onset_env[peaks]
keep = strength >= np.percentile(strength, 55) if len(strength) else []
accent_t = librosa.frames_to_time(peaks[keep], sr=sr, hop_length=hop)
accent_s = strength[keep] / (strength.max() + 1e-9) if len(strength) else []
accents = [{"t": round(float(t), 3), "s": round(float(s), 3)} for t, s in zip(accent_t, accent_s)]

# Sections: agglomerative clustering on timbre and harmony, per beat.
mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
feat = np.vstack([librosa.util.normalize(mfcc, axis=1), chroma])
sync = librosa.util.sync(feat, beat_frames, aggregate=np.median)
k = max(4, min(10, int(round(duration / 12))))
bounds = librosa.segment.agglomerative(sync, k)
bound_t = [0.0] + [float(beats[min(b, len(beats) - 1)]) for b in bounds[1:]] + [duration]
# Snap section starts to the nearest downbeat: sections begin on the one.
def snap(t):
    return float(downbeats[np.argmin(np.abs(downbeats - t))]) if len(downbeats) else t
starts = sorted(set([0.0] + [snap(t) for t in bound_t[1:-1]]))
sections = []
for a, b in zip(starts, starts[1:] + [duration]):
    if b - a < 1.0:
        continue
    fa, fb = librosa.time_to_frames([a, b], sr=sr, hop_length=hop)
    e = float(rms[fa:fb].mean()) if fb > fa else 0.0
    sections.append({"start": round(a, 3), "end": round(b, 3), "energy": e})
emax = max(s["energy"] for s in sections) or 1
for s in sections:
    s["energy"] = round(s["energy"] / emax, 3)

# Drops: downbeats where the energy of the next two bars most exceeds the last two.
bar = 60 / tempo * 4
drops = []
for t in downbeats:
    if t < 2 * bar or t > duration - 2 * bar:
        continue
    before = rms[librosa.time_to_frames(t - 2 * bar, sr=sr, hop_length=hop):librosa.time_to_frames(t, sr=sr, hop_length=hop)].mean()
    after = rms[librosa.time_to_frames(t, sr=sr, hop_length=hop):librosa.time_to_frames(t + 2 * bar, sr=sr, hop_length=hop)].mean()
    drops.append((float(after / (before + 1e-9)), float(t)))
drops.sort(reverse=True)
chosen = []
for ratio, t in drops:
    if ratio < 1.25:
        break
    if all(abs(t - c) > 4 * bar for c in chosen):
        chosen.append(t)
    if len(chosen) == 3:
        break

# Numbers to compare candidates: a steady tempo, contrast between parts,
# many clear accents, and real drops.
ibi = np.diff(beats)
score = {
    "tempo": round(tempo, 2),
    "beat_steadiness": round(float(1 - np.std(ibi) / (np.mean(ibi) + 1e-9)), 3) if len(ibi) else 0,
    "dynamic_range": round(float(np.percentile(beat_energy, 90) - np.percentile(beat_energy, 10)), 3),
    "accents_per_second": round(len(accents) / duration, 2),
    "drops": len(chosen),
}
json.dump({
    "source": src, "duration": round(duration, 3), "tempo": round(tempo, 3),
    "beats": [round(float(t), 3) for t in beats],
    "downbeats": [round(float(t), 3) for t in downbeats],
    "accents": accents,
    "sections": sections,
    "drops": [round(t, 3) for t in sorted(chosen)],
    "energy": [round(float(e), 3) for e in beat_energy],
    "score": score,
}, open(out, "w"), indent=1)
print(json.dumps(score), f"{len(sections)} sections, drops at {[round(t, 1) for t in sorted(chosen)]}")
