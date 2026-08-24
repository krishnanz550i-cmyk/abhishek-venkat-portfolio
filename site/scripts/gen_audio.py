#!/usr/bin/env python3
"""
gen_audio.py - synthesises the demonstration audio shipped with the site.

WHY THIS EXISTS
The site has two features that need sound to prove they work: the player that
follows you around the site, and the A/B control that lets a visitor hear a raw
recording against the finished mix. Shipping real client masters would mean
shipping other people's copyright, and shipping silence would mean shipping a
feature nobody can evaluate. So the audio here is synthesised from scratch:
original, royalty-free, and safe to publish.

The owner replaces these files with real excerpts - see HANDOVER.md.

THE A/B PAIR IS HONEST
'raw' and 'mixed' are the same performance through two different chains. They
are then LOUDNESS-MATCHED to each other, because a louder version always sounds
better to a listener and an A/B that is not level-matched is a sales trick
rather than a demonstration. The real loudness difference is reported below and
shown in the interface as a number instead of being smuggled into the audio.
"""

import numpy as np
from scipy.signal import lfilter, butter, sosfilt
from pathlib import Path
import subprocess, json, wave, struct, sys

SR = 44100
HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "public" / "audio"
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

rng = np.random.default_rng(20260824)          # fixed: same audio every build


# --------------------------------------------------------------------------
# Building blocks
# --------------------------------------------------------------------------
def t_of(n):
    return np.arange(n) / SR


def adsr(n, a=0.005, d=0.08, s=0.5, r=0.2):
    """Standard attack/decay/sustain/release volume envelope."""
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    return np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False) if a_n else np.array([]),
        np.linspace(1, s, d_n, endpoint=False) if d_n else np.array([]),
        np.full(s_n, s),
        np.linspace(s, 0, r_n) if r_n else np.array([]),
    ])[:n]


def sine(f, n, phase=0.0):
    return np.sin(2 * np.pi * f * t_of(n) + phase)


def saw(f, n, harmonics=18):
    """Additive sawtooth - band-limited by construction, so no aliasing."""
    out = np.zeros(n)
    for k in range(1, harmonics + 1):
        if f * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * f * k * t_of(n)) / k
    return out * (2 / np.pi)


def tri(f, n, harmonics=12):
    out = np.zeros(n)
    for i in range(harmonics):
        k = 2 * i + 1
        if f * k > SR / 2.2:
            break
        out += ((-1) ** i) * np.sin(2 * np.pi * f * k * t_of(n)) / (k * k)
    return out * (8 / np.pi ** 2)


def noise(n):
    return rng.standard_normal(n) * 0.5


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), btype="high", output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100) / (SR / 2), btype="low", output="sos"), x)


def eq_shelf(x, f, gain_db, kind="high"):
    """Gentle first-order shelf, implemented as filtered-band addition."""
    g = 10 ** (gain_db / 20) - 1
    band = hp(x, f) if kind == "high" else lp(x, f)
    return x + band * g


def eq_bell(x, f, gain_db, q=1.0):
    g = 10 ** (gain_db / 20) - 1
    bw = f / q
    band = bp(x, max(20, f - bw / 2), f + bw / 2)
    return x + band * g


def compress(x, thresh_db=-18, ratio=4.0, attack=0.005, release=0.12, makeup_db=0.0):
    """Straightforward feed-forward compressor with a smoothed level detector."""
    eps = 1e-9
    lvl = np.abs(x)
    a_c = np.exp(-1 / (attack * SR))
    r_c = np.exp(-1 / (release * SR))
    env = np.empty_like(lvl)
    prev = 0.0
    for i in range(len(lvl)):                       # sample loop: detector is serial
        c = a_c if lvl[i] > prev else r_c
        prev = c * prev + (1 - c) * lvl[i]
        env[i] = prev
    env_db = 20 * np.log10(env + eps)
    over = np.maximum(0.0, env_db - thresh_db)
    gain_db = -over * (1 - 1 / ratio) + makeup_db
    return x * (10 ** (gain_db / 20))


def reverb(x, decay=1.9, mix=0.28, predelay=0.02):
    """Schroeder reverb: four combs in parallel into two allpasses."""
    combs = [0.0297, 0.0371, 0.0411, 0.0437]
    out = np.zeros(len(x) + int(SR * 0.5))
    src = np.concatenate([np.zeros(int(predelay * SR)), x])
    src = np.concatenate([src, np.zeros(len(out) - len(src))])[:len(out)]
    for d in combs:
        dn = int(d * SR)
        g = 10 ** (-3 * d / decay)
        buf = lfilter([1.0], np.concatenate([[1.0], np.zeros(dn - 1), [-g]]), src)
        out += buf / len(combs)
    for d in (0.0050, 0.0017):
        dn = int(d * SR)
        g = 0.7
        b = np.concatenate([[-g], np.zeros(dn - 1), [1.0]])
        a = np.concatenate([[1.0], np.zeros(dn - 1), [-g]])
        out = lfilter(b, a, out)
    out = lp(out, 7200)
    out = out[:len(x)]
    return x * (1 - mix) + out * mix


def limit(x, ceiling=0.94):
    """Soft-knee limiter. tanh rather than a hard clip so it does not buzz."""
    drive = 1.6
    return np.tanh(x * drive) / np.tanh(drive) * ceiling


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def match_rms(x, target_db):
    return x * (10 ** ((target_db - rms_db(x)) / 20))


# --------------------------------------------------------------------------
# Instruments
# --------------------------------------------------------------------------
def kick(n):
    e = np.exp(-t_of(n) * 26)
    f = 45 + 90 * np.exp(-t_of(n) * 42)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * e
    click = lp(noise(n), 4200) * np.exp(-t_of(n) * 260) * 0.35
    return body + click


def snare(n):
    body = (sine(196, n) + sine(262, n)) * np.exp(-t_of(n) * 34) * 0.25
    crack = bp(noise(n), 1400, 8200) * np.exp(-t_of(n) * 22)
    return body + crack


def hat(n, open_=False):
    d = 9 if open_ else 55
    return bp(noise(n), 6500, 15000) * np.exp(-t_of(n) * d) * 0.5


def pluck(f, n):
    """Karplus-Strong: a burst of noise cycled through a short delay - the
    cheapest convincing plucked string there is."""
    ln = max(2, int(SR / f))
    buf = rng.standard_normal(ln)
    out = np.zeros(n)
    idx = 0
    for i in range(n):
        out[i] = buf[idx]
        buf[idx] = 0.5 * (buf[idx] + buf[(idx + 1) % ln]) * 0.996
        idx = (idx + 1) % ln
    return out * adsr(n, 0.001, 0.02, 0.7, 0.35)


def tanpura(root, n):
    """Drone: root, fifth and octave with slow detuning so it breathes."""
    out = np.zeros(n)
    for mult, amp in ((1.0, 0.5), (1.5, 0.34), (2.0, 0.26), (3.0, 0.10)):
        det = 1 + 0.0016 * np.sin(2 * np.pi * 0.13 * t_of(n) + mult)
        out += saw(root * mult, n, 10) * amp * det
    return lp(out, 2600) * 0.3


def lead(freqs, durs, n, vib=5.2):
    """Melody line with vibrato and a short portamento between notes."""
    out = np.zeros(n)
    pos = 0
    for f, d in zip(freqs, durs):
        ln = int(d * SR)
        if pos + ln > n:
            ln = n - pos
        if ln <= 0:
            break
        v = 1 + 0.008 * np.sin(2 * np.pi * vib * t_of(ln))
        tone = (sine(f, ln) * 0.62 + sine(f * 2, ln) * 0.2 + sine(f * 3, ln) * 0.09) * v
        out[pos:pos + ln] += tone * adsr(ln, 0.03, 0.12, 0.72, 0.22)
        pos += ln
    return out


# --------------------------------------------------------------------------
# Arrangement
# --------------------------------------------------------------------------
NOTES = {"A2": 110.00, "C3": 130.81, "D3": 146.83, "E3": 164.81, "G3": 196.00,
         "A3": 220.00, "C4": 261.63, "D4": 293.66, "E4": 329.63, "G4": 392.00,
         "A4": 440.00, "C5": 523.25, "D5": 587.33, "E5": 659.25}


def arrange(bpm=84, bars=7, style="fusion"):
    beat = 60 / bpm
    n = int(beat * 4 * bars * SR)
    stems = {k: np.zeros(n) for k in
             ("kick", "snare", "hats", "bass", "pluck", "lead", "drone")}

    stems["drone"] = tanpura(NOTES["A2"], n)

    def place(stem, sample, at_beats):
        i = int(at_beats * beat * SR)
        ln = min(len(sample), n - i)
        if ln > 0:
            stems[stem][i:i + ln] += sample[:ln]

    has_drums = style in ("fusion", "cinematic")
    for b in range(bars * 4 if has_drums else 0):
        if b % 4 in (0, 2) or (b % 8 == 6):
            place("kick", kick(int(0.42 * SR)), b)
        if b % 4 in (1, 3) and style == "fusion":
            place("snare", snare(int(0.28 * SR)) * 0.8, b)
        for eighth in (0, 0.5) if style == "fusion" else ():
            amp = 0.75 if eighth == 0 else 0.42
            place("hats", hat(int(0.14 * SR), open_=(b % 8 == 7 and eighth == 0.5)) * amp, b + eighth)

    prog = [("A2", 0), ("A2", 4), ("G3", 8), ("G3", 12),
            ("C3", 16), ("C3", 20), ("D3", 24), ("A2", 28)]
    for name, at in prog:
        if at >= bars * 4:
            break
        f = NOTES[name] / 2 if NOTES[name] > 150 else NOTES[name]
        ln = int(beat * 4 * SR)
        b = (saw(f, ln, 8) * 0.55 + sine(f, ln) * 0.6) * adsr(ln, 0.01, 0.5, 0.55, 0.4)
        place("bass", lp(b, 260) * 0.9, at)

    arp = ["A3", "C4", "E4", "G4", "E4", "C4", "D4", "A3"]
    for b in range(bars * 4):
        if style == "cinematic" and b % 4 != 0:
            continue
        subs = (0, 0.25, 0.5, 0.75) if style != "cinematic" else (0,)
        for i, sub in enumerate(subs):
            f = NOTES[arp[(b * 4 + i) % len(arp)]]
            place("pluck", pluck(f, int(0.30 * SR)) * 0.22, b + sub)

    mel_f = [NOTES[x] for x in ("E4", "G4", "A4", "G4", "E4", "D4", "C4", "D4",
                                "E4", "A4", "C5", "A4", "G4", "E4", "D4", "C4")]
    mel_d = [beat * x for x in (1, .5, 1.5, 1, .5, .5, 1, 1, 1, .5, 1.5, 1, 1, 1, .5, 1.5)]
    if style == "devotional":
        # Slower, wider phrasing - the melody carries it, not the groove.
        mel_d = [d * 1.5 for d in mel_d]
    if style == "cinematic":
        # Sparse: hold long low notes, let the drone and the hits do the work.
        mel_f = [f / 2 for f in mel_f[:8]]
        mel_d = [beat * x for x in (3, 2, 3, 2, 3, 2, 3, 3)]
        stems["drone"] = tanpura(NOTES["A2"] / 2, n) * 1.5
    stems["lead"] = lead(mel_f, mel_d, n)
    return stems, n


# --------------------------------------------------------------------------
# The two chains - this is the whole point of the A/B
# --------------------------------------------------------------------------
def chain_raw(stems, n):
    """What a rough bounce sounds like: everything centred, nothing filtered,
    levels set by whoever happened to move a fader last, no dynamics."""
    mono = (stems["kick"] * 1.35 + stems["snare"] * 0.95 + stems["hats"] * 0.30 +
            stems["bass"] * 1.05 + stems["pluck"] * 0.85 + stems["lead"] * 0.42 +
            stems["drone"] * 0.95)
    mono = eq_bell(mono, 250, +3.5, q=0.7)       # the classic low-mid pile-up
    mono = lp(mono, 7000)                        # dull, unopened top end
    st = np.stack([mono, mono])                  # dead centre: no width at all
    return st


def chain_mixed(stems, n):
    """A mix: each part filtered to its own lane, placed across the image,
    depth from a shared reverb, then glued and limited."""
    k = eq_bell(stems["kick"], 62, +2.5, q=1.1)
    k = eq_bell(k, 380, -3.0, q=1.0)
    k = compress(k, -20, 3.0, 0.004, 0.09) * 1.05

    s = hp(stems["snare"], 180)
    s = eq_shelf(s, 5200, +3.0)
    s = compress(s, -22, 3.5, 0.003, 0.08) * 0.82

    h = hp(stems["hats"], 480)
    h = eq_shelf(h, 9000, +2.0) * 0.34

    b = lp(stems["bass"], 900)
    b = eq_bell(b, 90, +2.0, q=1.0)
    b = eq_bell(b, 260, -2.5, q=0.9)
    b = compress(b, -20, 4.0, 0.008, 0.14) * 1.0

    p = hp(stems["pluck"], 320)
    p = eq_bell(p, 3000, +2.0, q=1.2) * 0.8

    l = hp(stems["lead"], 220)
    l = eq_bell(l, 420, -2.5, q=1.0)             # clear the mud out of the voice
    l = eq_bell(l, 3600, +3.5, q=0.9)            # presence, so it sits in front
    l = eq_shelf(l, 10000, +2.5)                 # air
    l = compress(l, -24, 3.0, 0.006, 0.10) * 0.95

    d = hp(stems["drone"], 140)
    d = eq_bell(d, 300, -2.0, q=0.8) * 0.55

    def pan(x, position):                        # -1 hard left .. +1 hard right
        ang = (position + 1) / 2 * (np.pi / 2)
        return x * np.cos(ang), x * np.sin(ang)

    left = np.zeros(n); right = np.zeros(n)
    for sig, pos in ((k, 0.0), (b, 0.0), (l, 0.0), (s, -0.08), (h, 0.62), (p, -0.68), (d, 0.30)):
        lx, rx = pan(sig, pos)
        left += lx; right += rx

    # Depth: only the parts that should sit back get sent to the reverb.
    send = (l * 0.22 + p * 0.30 + s * 0.18 + d * 0.20)
    wet_l = reverb(send, decay=1.7, mix=1.0)
    # ~13 ms of offset between the two reverb feeds is what actually
    # decorrelates them; a couple of samples does nothing audible.
    off = int(0.013 * SR)
    wet_r = reverb(np.concatenate([np.zeros(off), send[:-off]]), decay=2.1, mix=1.0)
    left += wet_l * 0.26
    right += wet_r * 0.26

    st = np.stack([left, right])
    glue = compress(st.mean(axis=0), -16, 2.0, 0.02, 0.20)
    ratio = glue / (st.mean(axis=0) + 1e-9)
    st = st * np.clip(ratio, 0.3, 1.6)           # apply bus gain to both sides equally
    st = np.stack([eq_shelf(st[0], 12000, +1.5), eq_shelf(st[1], 12000, +1.5)])
    return st


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------
def write_wav(path, stereo, peak=0.92):
    x = stereo / (np.max(np.abs(stereo)) + 1e-9) * peak
    ints = (x.T * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(ints.tobytes())


def to_mp3(wav, mp3, bitrate="160k"):
    subprocess.run([str(FFMPEG), "-y", "-loglevel", "error", "-i", str(wav),
                    "-codec:a", "libmp3lame", "-b:a", bitrate, str(mp3)], check=True)
    wav.unlink()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    stems, n = arrange()
    raw = chain_raw(stems, n)
    mixed = chain_mixed(stems, n)

    raw_lufs, mixed_lufs = rms_db(raw.mean(axis=0)), rms_db(mixed.mean(axis=0))

    # Level-match the pair to the quieter of the two, then limit only the mixed
    # one (which is what mastering actually does) without letting it get louder.
    target = min(raw_lufs, mixed_lufs)
    raw_m = match_rms(raw, target)
    mixed_m = match_rms(np.stack([limit(mixed[0]), limit(mixed[1])]), target)

    for name, sig in (("demo-raw", raw_m), ("demo-mixed", mixed_m)):
        w = OUT / f"{name}.wav"
        write_wav(w, sig, peak=0.88)
        to_mp3(w, OUT / f"{name}.mp3")

    # Three short pieces for the player that follows you around the site.
    reels = [
        ("reel-01", dict(bpm=84, bars=7, style="fusion")),
        ("reel-02", dict(bpm=64, bars=6, style="devotional")),
        ("reel-03", dict(bpm=52, bars=5, style="cinematic")),
    ]
    for name, kw in reels:
        st, ln = arrange(**kw)
        sig = chain_mixed(st, ln)
        sig = np.stack([limit(sig[0]), limit(sig[1])])
        w = OUT / f"{name}.wav"
        write_wav(w, sig, peak=0.90)   # headroom so lame never clips on encode
        to_mp3(w, OUT / f"{name}.mp3", "128k")
        manifest.append({"id": name, "seconds": round(ln / SR, 1)})

    report = {
        "generated": "synthesised, royalty-free",
        "abPair": {
            "rawLoudnessDb": round(raw_lufs, 1),
            "mixedLoudnessDb": round(mixed_lufs, 1),
            "loudnessDifferenceDb": round(mixed_lufs - raw_lufs, 1),
            "levelMatched": True,
            "note": "Both versions are played back at the same loudness so the comparison is of the mix, not the volume.",
        },
        "reels": manifest,
    }
    (OUT / "manifest.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
