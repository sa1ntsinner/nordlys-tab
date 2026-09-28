"""Where a film's picture shakes: the camera path, frame by frame, and what is wrong with it.

    uv run --with numpy --with opencv-python-headless python tools/video/shake.py \
        <film.mp4> <edit-map.json> <cut name> <ffmpeg> [--csv out.csv] [--json out.json]

Between each two frames inside a shot, the global motion is estimated on the
film at a quarter of its size: points are tracked from one frame to the next
and one similarity (a scale and a shift) is fitted to them, ignoring the points
that do not agree (typing, a card being dragged, words coming in, the pointer),
so what is measured is the camera, not the content. Where too few points agree
(a smooth sky), the whole frame is aligned instead (ECC). The motion is how far
the frame's centre moves (in pixels of a 3840-wide film) and how much the
picture scales (as a log, so a zoom reads the same in and out). A shot's path is
then checked for what an eye reads as shake:
- bounce: in one move, the velocity turns back (a spring's overshoot);
- step: the speed jumps from one frame to the next in the middle of a move;
- doubled: a frame with no motion between two that move (a frame shown twice);
- dropped: a frame with about twice the motion of its neighbours;
- wobble: small back-and-forth after a move has ended;
- shimmer: fine detail that crawls while the camera moves slowly (text drawn
  again at each scale snaps to the pixel grid a little differently every
  frame). Measured at full size in the middle of the frame: points on the fine
  detail are tracked between two frames, one similarity is fitted to them, and
  what is left, how far the points stray from the camera's smooth motion, is
  the jitter (median, in pixels of a 3840-wide film). A still frame scores 0; a
  zoom done by the edit on a 5K plate about 0.04-0.08 px; a zoom filmed in the
  page 0.14-0.20 px, at the same speeds.
Frames around the cuts and inside transitions are left out: they are meant to
jump. The edit map is scripts/render.cjs's (the shots with their frames).
"""
import json, os, subprocess, sys
import numpy as np
import cv2

args = sys.argv[1:]
opt = lambda name: args[args.index(name) + 1] if name in args else None
film, edit_map, cut_name, ffmpeg = args[:4]
cut = next(m for m in json.load(open(edit_map, encoding='utf-8')) if m['cut'] == cut_name)
FPS = 60

ffprobe = os.path.join(os.path.dirname(ffmpeg), os.path.basename(ffmpeg).replace('ffmpeg', 'ffprobe'))
FW, FH = map(int, subprocess.run([ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', film], capture_output=True, text=True).stdout.strip().split(','))
MW, MH = FW // 4, FH // 4          # motion, at a quarter size
SCALE = 3840 / MW                  # to pixels of a 3840-wide film
CX, CY, CW, CH = FW // 3, FH // 3, FW // 3, FH // 3   # shimmer: the middle ninth, at full size

def frames(vf, w, h):
    p = subprocess.Popen([ffmpeg, '-v', 'error', '-i', film, '-an', '-vf', vf, '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    n = w * h
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            return
        yield np.frombuffer(b, np.uint8).reshape(h, w)

# Frames that belong to a transition or a cut, where jumps are meant.
TRANSITION = {'cut': 0, 'whip': 14, 'whipUp': 14, 'zoom': 20, 'iris': 26, 'wipe': 22, 'fade': 18}
skip = set()
for s in cut['shots']:
    f, n = s['frame'], s.get('transitionFrames', TRANSITION.get(s['arrives'], 0))
    for k in range(f - n // 2 - 2, f + n // 2 + 3):
        skip.add(k)

# Frames where words come in or go out, and shots that are not one camera over one plate (the
# page as a tilted window, the grid of tiles): no shimmer is judged there, the motion is the content's.
# The cards (the title, the statement, the end card) fill the frame with moving words, so a
# camera fit is not judged while they come in or go out; the small captions only keep the
# shimmer check off their own coming and going.
words, captions = set(), set()
for c in cut.get('cards', []):
    words.update(range(c['frame'] - 8, c['frame'] + (130 if c['card'] in ('title', 'end') else 48)))
    words.update(range(c['untilFrame'] - 36, c['untilFrame'] + 2))
for c in cut.get('captions', []):
    if 'untilFrame' in c:
        captions.update(range(c['frame'] - 8, c['frame'] + 48)); captions.update(range(c['untilFrame'] - 30, c['untilFrame'] + 2))
not_one_camera = {s['shot'] for s in cut['shots'] if s.get('kind') in ('window', 'grid')}
words.update(range(cut['frames'] - 26, cut['frames'] + 1))  # the fade to black at the end
# Where a camera moves (the edit map says, from the edit's keys and the plates whose page camera
# moves): shimmer is judged only there. Content moving under a still camera (a card coming in,
# typing) is not a camera's shimmer.
camera_moves = None
if all('moving' in s for s in cut['shots']):
    camera_moves = set()
    for s in cut['shots']:
        for a, b in s['moving']:
            camera_moves.update(range(a, b + 1))

centre = np.array([MW / 2, MH / 2, 1.0])
crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 60, 1e-6)

def motion(prev, cur):
    """The camera between two frames: a 2x3 similarity, how it was found, and on how many points."""
    pts = cv2.goodFeaturesToTrack(prev, 600, 0.01, 7, blockSize=7)
    if pts is not None and len(pts) >= 30:
        nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, cur, pts, None, winSize=(21, 21), maxLevel=3)
        ok = st.ravel() == 1
        if ok.sum() >= 30:
            m, inl = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC, ransacReprojThreshold=0.6, maxIters=3000, confidence=0.998)
            if m is not None and inl.sum() >= max(30, 0.35 * ok.sum()):
                return m.astype(np.float32), 'points', int(inl.sum())
    a, b = (cv2.GaussianBlur(x.astype(np.float32) / 255, (0, 0), 1.2) for x in (prev, cur))
    (dx, dy), _ = cv2.phaseCorrelate(a, b)
    warp = np.array([[1, 0, dx], [0, 1, dy]], np.float32)
    try:
        _, warp = cv2.findTransformECC(a, b, warp, cv2.MOTION_AFFINE, crit, None, 1)
        return warp, 'ecc', 0
    except cv2.error:
        return warp, 'none', 0

def shimmer(prev, cur):
    """How far fine detail strays from one smooth motion between two frames, at full size."""
    p = cv2.goodFeaturesToTrack(prev, 800, 0.02, 6, blockSize=5)
    if p is None or len(p) < 40:
        return np.nan  # no fine detail here to judge
    q, st, _ = cv2.calcOpticalFlowPyrLK(prev, cur, p, None, winSize=(15, 15), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.001))
    ok = st.ravel() == 1
    if ok.sum() < 40:
        return np.nan
    m, inl = cv2.estimateAffinePartial2D(p[ok], q[ok], method=cv2.RANSAC, ransacReprojThreshold=1.5)
    if m is None or inl.sum() < 40:
        return np.nan
    pp, qq = p[ok][inl.ravel() == 1].reshape(-1, 2), q[ok][inl.ravel() == 1].reshape(-1, 2)
    return float(np.median(np.linalg.norm(qq - (pp @ m[:, :2].T + m[:, 2]), axis=1)) * 3840 / FW)

rows = []
prev = prevc = None
for i, (cur, curc) in enumerate(zip(frames(f'scale={MW}:{MH}:flags=area,format=gray', MW, MH),
                                    frames(f'crop={CW}:{CH}:{CX}:{CY},format=gray', CW, CH))):
    if prev is not None:
        m, how, n = motion(prev, cur)
        moved = m @ centre
        vx, vy = (moved[0] - centre[0]) * SCALE, (moved[1] - centre[1]) * SCALE
        vz = 0.5 * np.log(max(1e-9, abs(np.linalg.det(m[:, :2]))))
        edge = abs(vz) * 1920
        slow = (0.15 < edge < 4) or (0.3 < np.hypot(vx, vy) < 4)
        rs = shimmer(prevc, curc) if (slow or i % 30 == 0) and i not in skip else np.nan
        rows.append((i, vx, vy, vz, rs, how, n))
    prev, prevc = cur, curc

t = np.array([r[0] for r in rows])
vx = np.array([r[1] for r in rows]); vy = np.array([r[2] for r in rows]); vz = np.array([r[3] for r in rows])
resid = np.array([r[4] for r in rows])
how = [r[5] for r in rows]
zspeed = np.abs(vz) * 1920  # the zoom as the speed a frame's edge moves at (px/frame), to compare with pans

if opt('--csv'):
    with open(opt('--csv'), 'w', newline='') as fh:
        fh.write('frame,seconds,vx,vy,vz,shimmer,how,points\n')
        for r in rows:
            fh.write(f'{r[0]},{r[0] / FPS:.3f},{r[1]:.3f},{r[2]:.3f},{r[3]:.6f},{r[4]:.4f},{r[5]},{r[6]}\n')

flags = []
def flag(f, shot, kind, what):
    flags.append({'frame': int(f), 'seconds': round(f / FPS, 3), 'shot': shot, 'kind': kind, 'what': what})

MOVE = 1.5      # px/frame (either the pan or the zoom's edge speed) above which the camera is moving
# Shimmer: jitter above 0.1 px, plus a little for speed (tracking itself strays more on a faster move).
shimmer_limit = lambda speed: 0.1 + 0.01 * speed
floor = np.nanpercentile(resid[(zspeed < 0.05) & (np.hypot(vx, vy) < 0.05)], 50) if np.any((zspeed < 0.05) & (np.hypot(vx, vy) < 0.05) & ~np.isnan(resid)) else np.nan
per_shot = []
for idx, s in enumerate(cut['shots']):
    a = s['frame']
    b = cut['shots'][idx + 1]['frame'] if idx + 1 < len(cut['shots']) else cut['frames']
    # The tilted window and the grid of tiles are not one camera over one plate, and words coming
    # in or going out move on their own: a camera fit does not describe them.
    sel = [k for k in range(len(t)) if a < t[k] < b and t[k] not in skip and t[k] not in words] if s['shot'] not in not_one_camera else []
    if len(sel) < 6:
        continue
    for comp, v, scale_px in (('pan x', vx, 1), ('pan y', vy, 1), ('zoom', vz, 1920)):
        sv = v[sel] * scale_px
        fr = t[sel]
        mag = np.abs(sv)
        # bounce: the velocity of a clear move turns back from one frame to the next
        for k in range(1, len(sv)):
            if fr[k] == fr[k - 1] + 1 and sv[k - 1] * sv[k] < 0 and min(mag[k - 1], mag[k]) > MOVE:
                flag(fr[k], s['shot'], 'bounce', f'{comp} turns back ({sv[k - 1]:+.1f} to {sv[k]:+.1f} px/frame)')
        # step, doubled, dropped: in the middle of a move (both neighbours moving the same way)
        for k in range(1, len(sv) - 1):
            if not (fr[k - 1] == fr[k] - 1 and fr[k + 1] == fr[k] + 1):
                continue
            n0, n1 = sv[k - 1], sv[k + 1]
            if not (np.sign(n0) == np.sign(n1) and min(abs(n0), abs(n1)) > 2 * MOVE):
                continue
            mid = (n0 + n1) / 2
            if abs(sv[k]) < 0.25 * abs(mid):
                flag(fr[k], s['shot'], 'doubled', f'{comp} stops for a frame ({n0:+.1f}, {sv[k]:+.1f}, {n1:+.1f} px/frame)')
            elif abs(sv[k]) > 1.8 * abs(mid):
                flag(fr[k], s['shot'], 'dropped', f'{comp} jumps for a frame ({n0:+.1f}, {sv[k]:+.1f}, {n1:+.1f} px/frame)')
            elif abs(sv[k] - mid) > 0.6 * abs(mid) + 1.0:
                flag(fr[k], s['shot'], 'step', f'{comp} speed steps ({n0:+.1f}, {sv[k]:+.1f}, {n1:+.1f} px/frame)')
    # wobble: after the camera has settled, the pan going back and forth (three or more
    # sign changes of more than half a pixel a frame within half a second)
    both = np.hypot(vx[sel], vy[sel])
    fr = t[sel]
    for comp, v in (('pan x', vx), ('pan y', vy)):
        sv = v[sel]
        changes = [fr[k] for k in range(1, len(sv)) if sv[k - 1] * sv[k] < 0 and min(abs(sv[k - 1]), abs(sv[k])) > 0.5 and both[k] < 3 * MOVE]
        for k in range(len(changes) - 2):
            if changes[k + 2] - changes[k] <= 30:
                flag(changes[k], s['shot'], 'wobble', f'{comp} shakes back and forth (sign changes at frames {changes[k]}, {changes[k + 1]}, {changes[k + 2]})')
                break
    # shimmer: fine detail changing while the camera moves slowly
    slow = ((zspeed[sel] > 0.15) & (zspeed[sel] < 4)) | ((both > 0.3) & (both < 4))
    rs = resid[sel]
    moving = rs[slow & ~np.isnan(rs)]
    # A run of 12 slow frames (0.2 s) whose median jitter is over the limit: a few stray frames
    # (a live sky moving on its own, words coming in) are not shimmer.
    speed = np.maximum(zspeed[sel], both)
    ks = [k for k in range(len(rs)) if slow[k] and not np.isnan(rs[k]) and fr[k] not in captions and (camera_moves is None or fr[k] in camera_moves)]
    hot = sorted({fr[k] for i in range(len(ks) - 11) if fr[ks[i + 11]] - fr[ks[i]] <= 20
                  and np.median(rs[ks[i:i + 12]]) > shimmer_limit(np.median(speed[ks[i:i + 12]])) for k in ks[i:i + 12]})
    per_shot.append({'shot': s['shot'], 'slowFrames': int(slow.sum()), 'jitterMoving': round(float(np.median(moving)), 3) if len(moving) else None,
                     'jitterStill': round(float(np.nanmedian(rs[~slow])), 3) if np.any(~slow & ~np.isnan(rs)) else None,
                     'measuredBy': max(set(how[k] for k in sel), key=[how[k] for k in sel].count)})
    if hot:
        flag(hot[0], s['shot'], 'shimmer', f'fine detail crawls while the camera moves slowly ({len(hot)} frames from {hot[0] / FPS:.2f} s to {hot[-1] / FPS:.2f} s, jitter median {np.median(moving):.3f} px)')

# Runs of the same flag in the same shot are one line.
flags.sort(key=lambda x: (x['shot'], x['kind'], x['frame']))
merged = []
for fl in flags:
    if merged and merged[-1]['shot'] == fl['shot'] and merged[-1]['kind'] == fl['kind'] and fl['frame'] - merged[-1]['last'] <= 12:
        merged[-1]['last'] = fl['frame']; merged[-1]['count'] += 1
        continue
    merged.append({**fl, 'last': fl['frame'], 'count': 1})
merged.sort(key=lambda x: x['frame'])

summary = {'film': film, 'frames': int(len(t) + 1), 'size': [FW, FH], 'jitterStill': None if np.isnan(floor) else round(float(floor), 3), 'flags': merged, 'shots': per_shot}
if opt('--json'):
    json.dump(summary, open(opt('--json'), 'w', newline=''), indent=1)
print(f'{cut_name}: {len(t) + 1} frames measured, {len(merged)} places flagged (fine-detail jitter on still frames: {summary["jitterStill"]} px)')
for m in merged:
    span = f'{m["seconds"]:.2f} s' + (f' to {m["last"] / FPS:.2f} s ({m["count"]} frames)' if m['count'] > 1 else '')
    print(f'  {span}  {m["shot"]:<12} {m["kind"]:<8} {m["what"]}')
