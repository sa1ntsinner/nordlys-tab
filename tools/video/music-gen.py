"""Candidate soundtracks for the promo video, made with ACE-Step 1.5 (MIT).

Run inside an ACE-Step 1.5 checkout (uv run python music-gen.py <out_dir>).
Every track is instrumental, original, and shaped with section tags so it
has clear events to cut the picture to: an intro, a build, a drop, a
breakdown, a second build and drop, and an ending.
"""
import os
import sys
import time

sys.path.insert(0, os.getcwd())
from acestep.handler import AceStepHandler  # noqa: E402
from acestep.llm_inference import LLMHandler  # noqa: E402
from acestep.inference import GenerationParams, GenerationConfig, generate_music  # noqa: E402

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "candidates")
SEEDS = [int(s) for s in (sys.argv[2].split(",") if len(sys.argv) > 2 else ["11", "29"])]
os.makedirs(OUT, exist_ok=True)

SHAPE = "[Intro]\n\n[Build]\n\n[Drop]\n\n[Breakdown]\n\n[Build]\n\n[Drop]\n\n[Outro]"
STYLES = {
    "futurebass": ("Energetic future bass instrumental, punchy kick, crisp claps, wide supersaw chords, sidechained pads, "
                   "bright plucked lead melody, riser and snare roll build-up, euphoric hard-hitting drop, polished modern "
                   "production, confident and joyful, product launch trailer", 128),
    "house": ("Driving melodic house instrumental, tight four-on-the-floor kick, offbeat open hats, deep rolling bassline, "
              "shimmering synth stabs, filter sweep build-up, explosive drop, clean premium production, tech commercial", 124),
    "electropop": ("Uplifting electro pop instrumental, punchy live-feel drums, funky synth bass, glossy chords, hand claps, "
                   "catchy synth hook, energetic and confident, bright and modern, keynote product video", 120),
    "trailer": ("Dynamic electronic trailer instrumental, pulsing synth arpeggios, hard hitting drums and big toms, dramatic "
                "risers and impacts, massive drop with bold synth brass, modern, cinematic and fast", 130),
}

root = os.getcwd()
dit = AceStepHandler()
msg, ok = dit.initialize_service(project_root=root, config_path="acestep-v15-turbo", device="auto", offload_to_cpu=False)
if not ok:
    sys.exit(f"DiT init failed: {msg}")
lm = LLMHandler()
msg, ok = lm.initialize(checkpoint_dir=os.path.join(root, "checkpoints"), lm_model_path="acestep-5Hz-lm-1.7B",
                        backend="pt", device="auto", offload_to_cpu=False, dtype=None)
if not ok:
    sys.exit(f"LM init failed: {msg}")

for name, (caption, bpm) in STYLES.items():
    for seed in SEEDS:
        t0 = time.time()
        params = GenerationParams(task_type="text2music", thinking=True, caption=caption, lyrics=SHAPE,
                                  instrumental=True, bpm=bpm, timesignature="4", vocal_language="unknown",
                                  duration=70, inference_steps=8, guidance_scale=1.0, seed=seed)
        result = generate_music(dit, lm, params=params, config=GenerationConfig(batch_size=1, audio_format="wav"),
                                save_dir=os.path.join(OUT, f"{name}-{seed}"))
        paths = [a.get("path") for a in result.audios] if result.success else []
        print(f"{name}-{seed}: {'ok' if result.success else 'FAILED ' + str(result.status_message)} {time.time() - t0:.1f}s {paths}", flush=True)
