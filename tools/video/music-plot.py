"""A picture of a music map: the spectrogram, the bars, and every event on it.

    python tools/video/music-plot.py <track> <map.json> <out.png> [--from 0 --to 100 --stems dir]

Rows of 20 seconds each: the mel spectrogram with the downbeats (bar numbers
on top), the events as marks by kind (size by strength), and the level of the
drums, the bass and the rest (or of the mix), in dB.
"""
import json
import pathlib
import sys

import librosa
import matplotlib
import numpy as np

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

src, map_file, out = sys.argv[1], sys.argv[2], sys.argv[3]
arg = lambda name, default: sys.argv[sys.argv.index(f'--{name}') + 1] if f'--{name}' in sys.argv else default
m = json.load(open(map_file))
t_from, t_to = float(arg('from', 0)), float(arg('to', m['duration']))
stems = arg('stems', None)
SR, HOP = 22050, 256
y, _ = librosa.load(src, sr=SR, mono=True)
M = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=SR, hop_length=HOP, n_mels=128, fmax=11000), ref=np.max)
fr = SR / HOP
levels = {}
for name in (['drums', 'bass', 'other'] if stems else []):
    s, _ = librosa.load(str(pathlib.Path(stems) / f'{name}.wav'), sr=SR, mono=True)
    levels[name] = librosa.amplitude_to_db(librosa.feature.rms(y=s, hop_length=HOP)[0], ref=1.0)
if not levels:
    levels['mix'] = librosa.amplitude_to_db(librosa.feature.rms(y=y, hop_length=HOP)[0], ref=1.0)
KINDS = ['kick', 'clap', 'hat', 'crash', 'stab', 'whoosh', 'sweep', 'riser', 'downlifter', 'drop', 'stop', 'fill']
COL = {'kick': '#5b8def', 'clap': '#f5c542', 'hat': '#9aa4b2', 'crash': '#ffffff', 'stab': '#ff7ab6', 'whoosh': '#4fe3c1', 'sweep': '#39a0ff',
       'riser': '#ff8a3d', 'downlifter': '#b48cff', 'drop': '#ff3b3b', 'stop': '#00e0ff', 'fill': '#c0ff3e'}
ROW = float(arg('row', 20))
rows = int(np.ceil((t_to - t_from) / ROW))
fig, axes = plt.subplots(rows * 3, 1, figsize=(26, rows * 7.2), gridspec_kw={'height_ratios': [3, 1.6, 1] * rows}, facecolor='#0b0e14')
for r in range(rows):
    a, b = t_from + r * ROW, min(t_to, t_from + (r + 1) * ROW)
    ax, ev, lv = axes[3 * r], axes[3 * r + 1], axes[3 * r + 2]
    fa, fb = int(a * fr), int(b * fr)
    ax.imshow(M[:, fa:fb], origin='lower', aspect='auto', extent=[a, b, 0, 128], cmap='magma', vmin=-80, vmax=0)
    for x in (ax, ev, lv):
        x.set_xlim(a, b)
        x.set_facecolor('#0b0e14')
        x.tick_params(colors='#aab', labelsize=8)
        for d in m['downbeats']:
            if a <= d <= b:
                x.axvline(d, color='#ffffff', alpha=0.35 if x is ax else 0.2, lw=0.8)
        for bt in m['beats']:
            if a <= bt <= b and x is ev:
                x.axvline(bt, color='#ffffff', alpha=0.06, lw=0.5)
    for bi in m['bars']:
        if a <= bi['t'] <= b:
            ax.text(bi['t'] + 0.03, 122, str(bi['bar']), color='#fff', fontsize=9, va='top')
    for sct in m['sections']:
        if sct['start'] < b and sct['end'] > a:
            ax.text(max(a, sct['start']) + 0.05, 4, sct['kind'], color='#7fffd4', fontsize=10, weight='bold')
    for e in m['events']:
        if not (a <= e['t'] <= b) or e['type'] not in KINDS:
            continue
        yk = KINDS.index(e['type'])
        if 'start' in e and 'end' in e and e['type'] in ('whoosh', 'sweep', 'riser', 'downlifter', 'stop', 'fill'):
            ev.plot([max(a, e['start']), min(b, e['end'])], [yk, yk], color=COL[e['type']], lw=1 + 5 * e['s'], alpha=0.8, solid_capstyle='butt')
        ev.scatter([e['t']], [yk], s=8 + 70 * e['s'], color=COL[e['type']], edgecolors='none', zorder=3)
    ev.set_yticks(range(len(KINDS)))
    ev.set_yticklabels(KINDS, fontsize=8, color='#ccd')
    ev.set_ylim(-0.7, len(KINDS) - 0.3)
    for name, L in levels.items():
        lv.plot(np.arange(fa, min(fb, len(L))) / fr, L[fa:fb], lw=0.8, label=name)
    lv.set_ylim(-60, 0)
    lv.legend(loc='upper right', fontsize=7, facecolor='#0b0e14', labelcolor='#ccd')
fig.suptitle(f"{m['source']}  {m['tempo']:.3f} bpm  grid {m['grid']['residual_ms']} ms, drift {m['grid']['drift_ms']} ms", color='#fff', fontsize=14)
plt.tight_layout(rect=(0, 0, 1, 0.985))
plt.savefig(out, dpi=60, facecolor='#0b0e14')
print('wrote', out)
