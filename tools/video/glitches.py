"""Frames of a plate that do not belong between their neighbours: a frame drawn
half-way (tiles missing), a flash.

    uv run --with numpy python tools/video/glitches.py <ffmpeg> <plate.mp4> [<plate.mp4> ...]

Frames are read small and grey; with d(a, b) the mean absolute difference, a
frame f is flagged when d(f-1, f) + d(f, f+1) > 2.5 * d(f-1, f+1) + 1.5: it is
further from both neighbours than they are from each other. A change that
stays (a theme switch, a letter typed) is not flagged; one that comes and goes
in a frame is.
"""
import pathlib, subprocess, sys
import numpy as np

W, H = 256, 144
ff = sys.argv[1]
total = 0
for plate in sys.argv[2:]:
    raw = subprocess.run([ff, '-v', 'error', '-i', plate, '-an', '-vf', f'scale={W}:{H}:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    d = lambda a, b: np.abs(fr[a] - fr[b]).mean()
    bad = [f for f in range(1, len(fr) - 1) if d(f - 1, f) + d(f, f + 1) > 2.5 * d(f - 1, f + 1) + 1.5]
    total += len(bad)
    name = pathlib.Path(plate).stem
    print(f'{name}: {len(fr)} frames' + (f', odd frames: {bad[:20]}' if bad else ', clean'))
print(f'{total} odd frames in all')
