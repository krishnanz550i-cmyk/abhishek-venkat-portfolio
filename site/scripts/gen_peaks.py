#!/usr/bin/env python3
"""
gen_peaks.py — reduces each audio file to a small array of peak values.

The site draws waveforms from this instead of decoding audio in the browser:
a visitor sees the shape of the track immediately, on any connection, without
downloading the audio first. For the before/after control it does something
better than that — the rough bounce and the finished mix have visibly different
shapes, so the difference is legible before a note is played.
"""
import numpy as np, subprocess, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIO = HERE.parent / "public" / "audio"
def _find_ffmpeg():
    """ffmpeg is needed only to regenerate the demo audio, which is committed to
    the repository. Prefer a system install; fall back to the optional npm
    package; explain clearly if neither is present."""
    import shutil
    found = shutil.which("ffmpeg")
    if found:
        return found
    bundled = HERE.parent / "node_modules" / "ffmpeg-static" / "ffmpeg"
    if bundled.exists():
        return str(bundled)
    raise SystemExit(
        "\n  ffmpeg is not available, and it is needed to write MP3 files.\n"
        "  Either install ffmpeg on this machine, or run:\n"
        "      npm install ffmpeg-static\n"
        "  inside the site folder. Nothing else in the build needs it - the\n"
        "  audio files are already committed.\n")

FFMPEG = _find_ffmpeg()
BUCKETS = 400          # enough detail at full width, ~2 KB of JSON per track

def peaks(path, buckets=BUCKETS):
    raw = subprocess.run(
        [str(FFMPEG), "-v", "error", "-i", str(path), "-ac", "1",
         "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "22050", "-"],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if x.size == 0:
        return []
    edges = np.linspace(0, x.size, buckets + 1).astype(int)
    out = [float(np.abs(x[a:b]).max()) if b > a else 0.0 for a, b in zip(edges[:-1], edges[1:])]
    top = max(out) or 1.0
    return [round(v / top, 3) for v in out]      # normalised 0..1 for drawing

data = {}
for f in sorted(AUDIO.glob("*.mp3")):
    data[f"/audio/{f.name}"] = peaks(f)
    print(f"  {f.name}: {len(data[f'/audio/{f.name}'])} buckets")

(AUDIO / "peaks.json").write_text(json.dumps(data, separators=(",", ":")))
print("peaks.json written")
