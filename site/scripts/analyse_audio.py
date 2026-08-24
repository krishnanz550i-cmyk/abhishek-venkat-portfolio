#!/usr/bin/env python3
"""Measures the generated audio. Used to verify the A/B pair genuinely differs
in the ways a mix is supposed to differ, rather than just being louder."""
import numpy as np, subprocess, sys, json
from pathlib import Path
from scipy.signal import stft

HERE = Path(__file__).resolve().parent
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
SR = 44100

def load(p):
    raw = subprocess.run([str(FFMPEG), "-v", "error", "-i", str(p), "-f", "f32le",
                          "-acodec", "pcm_f32le", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    return x.reshape(-1, 2).T.astype(np.float64)

def db(v): return 20*np.log10(v + 1e-12)

def measure(p):
    s = load(p); m = s.mean(axis=0)
    peak, rms = np.max(np.abs(s)), np.sqrt(np.mean(m**2))
    # Stereo correlation: 1.0 means the two channels are identical (mono).
    c = np.corrcoef(s[0], s[1])[0,1] if np.std(s[1])>1e-9 else 1.0
    f, _, Z = stft(m, SR, nperseg=2048)
    mag = np.abs(Z).mean(axis=1)
    centroid = float((f*mag).sum()/(mag.sum()+1e-12))
    # Share of energy above 6 kHz - "is the top end open?"
    hi = float(mag[f>6000].sum()/(mag.sum()+1e-12))
    lowmid = float(mag[(f>200)&(f<500)].sum()/(mag.sum()+1e-12))
    return dict(
        peak_db=round(db(peak),2), rms_db=round(db(rms),2),
        crest_db=round(db(peak)-db(rms),2),
        stereo_correlation=round(float(c),3),
        spectral_centroid_hz=round(centroid),
        energy_above_6k_pct=round(hi*100,2),
        energy_200_500_pct=round(lowmid*100,2),
        clipped_samples=int(np.sum(np.abs(s)>=0.999)),
        has_nan=bool(np.isnan(s).any()),
        seconds=round(s.shape[1]/SR,1),
    )

out = {p.name: measure(p) for p in sorted((HERE.parent/"public"/"audio").glob("*.mp3"))}
print(json.dumps(out, indent=2))
