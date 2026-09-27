"""Splits tracks into drums, bass, other and vocals with Demucs (htdemucs),
and says how much singing there is.

    python tools/video/stems.py <out-dir> <track> [<track> ...]

For each track, <out-dir>/<name>/{drums,bass,other,vocals}.wav (44.1 kHz,
stereo), and a line with the vocal stem's share of the energy and the share
of time it is active (above 15 % of the mix in 100 ms windows). An
instrumental has both near zero. music-events.py map --stems reads the folder.

Needs torch, torchaudio and demucs (on this PC: the ACE-Step venv's python,
used for Demucs only).
"""
import json
import pathlib
import sys

import torch
import torchaudio
from demucs.apply import apply_model
from demucs.pretrained import get_model

out_dir = pathlib.Path(sys.argv[1])
model = get_model('htdemucs').to('cuda' if torch.cuda.is_available() else 'cpu').eval()
device = next(model.parameters()).device
report = {}
for src in sys.argv[2:]:
    src = pathlib.Path(src)
    wav, sr = torchaudio.load(str(src))
    wav = torchaudio.functional.resample(wav, sr, model.samplerate)
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    ref = wav.mean(0)
    with torch.no_grad():
        stems = apply_model(model, ((wav - ref.mean()) / ref.std())[None].to(device), split=True, overlap=0.25)[0].cpu()
    stems = stems * ref.std() + ref.mean()
    dest = out_dir / src.stem
    dest.mkdir(parents=True, exist_ok=True)
    for k, name in enumerate(model.sources):
        torchaudio.save(str(dest / f'{name}.wav'), torchaudio.functional.resample(stems[k], model.samplerate, 44100), 44100)
    names = model.sources
    energy = {n: float((stems[k] ** 2).mean()) for k, n in enumerate(names)}
    total = sum(energy.values()) or 1
    v = stems[names.index('vocals')].pow(2).mean(0)
    frame = model.samplerate // 10
    n = v.shape[0] // frame * frame
    frames = v[:n].reshape(-1, frame).mean(1)
    mix = stems.pow(2).sum(0).mean(0)[:n].reshape(-1, frame).mean(1)
    active = float(((frames / (mix + 1e-9)) > 0.15).float().mean())
    report[src.stem] = {'vocal_share': round(energy['vocals'] / total, 4), 'vocal_active': round(active, 4),
                        'shares': {k: round(e / total, 3) for k, e in energy.items()}}
    print(src.stem, json.dumps(report[src.stem]), flush=True)
with open(out_dir / 'vocals.json', 'w', newline='') as f:
    json.dump(report, f, indent=1)
