"""Frames of a finished film that lost picture: black, half-decoded or missing layers.

    uv run --with numpy python tools/video/dropouts.py <film.mp4> <reference.mp4> <ffmpeg>

The reference is the same edit rendered another way (half size, from the 1080
plates). Both are read small and grey; each frame is cut into 4 x 4 cells and
the detail (the mean gradient) of each cell compared. A cell where the
reference has detail and the film has lost most of it is a dropout. The film
is the sharper of the two (5K plates), so resolution alone never trips it.
"""
import subprocess, sys
import numpy as np

W, H, G = 256, 144, 4

def frames(src, ff):
    p = subprocess.Popen([ff, '-v', 'error', '-i', src, '-an', '-vf', f'scale={W}:{H}:flags=area,format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    n = W * H
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            return
        yield np.frombuffer(b, np.uint8).reshape(H, W).astype(np.float32)

def cells(img):
    e = np.abs(np.diff(img, axis=1))[:-1, :] + np.abs(np.diff(img, axis=0))[:, :-1]
    h, w = e.shape[0] // G * G, e.shape[1] // G * G
    return e[:h, :w].reshape(G, h // G, G, w // G).mean(axis=(1, 3))

film, ref, ff = sys.argv[1:4]
bad = []
n = 0
for i, (a, b) in enumerate(zip(frames(film, ff), frames(ref, ff))):
    n += 1
    ca, cb = cells(a), cells(b)
    lost = int(((cb > 1.5) & (ca < 0.3 * cb)).sum())
    if lost >= 2:
        bad.append((i, lost))
print(f'{n} frames compared, {len(bad)} with lost picture')
runs = []
for i, lost in bad:
    if runs and i == runs[-1][1] + 1:
        runs[-1][1] = i
        runs[-1][2] = max(runs[-1][2], lost)
    else:
        runs.append([i, i, lost])
for s, e, lost in runs:
    print(f'  frames {s}-{e} ({s / 60:.2f}-{(e + 1) / 60:.2f} s): up to {lost} of {G * G} cells lost')
