/**
 * gen-art.mjs — generates one cover image per project, as SVG.
 *
 * WHY THIS EXISTS
 * A portfolio grid pulling thumbnails off YouTube and SoundCloud looks like a
 * list of links, not a body of work: mismatched crops, other people's logos,
 * broken images the day a video goes private. So each project gets its own
 * artwork drawn here instead — vector, a few kilobytes, and consistent.
 *
 * The drawing is DETERMINISTIC: the same project slug always produces exactly
 * the same image, so rebuilding the site never reshuffles the grid. The form
 * follows the kind of work — see STYLES below.
 *
 * The owner can replace any of these at any time by putting a real image at
 * public/img/covers/<slug>.jpg — the site prefers a real photo when it finds one.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'art');
const SIZE = 1000;

/* --- Deterministic randomness -------------------------------------------- */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
const r2 = (n) => Math.round(n * 100) / 100;

/* --- Colour ---------------------------------------------------------------
   Every cover is printed on the same sheet of poster paper so the grid reads as
   a set. Only the ink changes, and only within a family chosen per style — the
   five inks a Bombay poster press actually ran. */
const PAPER = '#F6EAD4';
const INK = '#2A1508';
const HUE = {
  raga:     [352, 8],   // sindoor red — Hindi originals
  mandala:  [34, 46],   // marigold gold — devotional
  spectrum: [176, 196], // peacock teal — instrumental
  contour:  [138, 162], // leaf green — the Tamil nature cycle
  groove:   [316, 340], // gulaal rose — covers
  frames:   [232, 256], // indigo — screen work
};
const hsl = (h, s, l, a = 1) => `hsla(${r2(h)} ${r2(s)}% ${r2(l)}% / ${a})`;

/* --- Shared chrome: grain, vignette, gradient ---------------------------- */
function defs(id, h) {
  return `
  <defs>
    <linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hsl(h, 82, 38)}"/>
      <stop offset=".55" stop-color="${hsl(h + 12, 88, 28)}"/>
      <stop offset="1" stop-color="${hsl(h + 26, 74, 18)}"/>
    </linearGradient>
    <radialGradient id="glow-${id}" cx=".5" cy=".38" r=".72">
      <stop offset="0" stop-color="${hsl(h - 6, 70, 91, .95)}"/>
      <stop offset="1" stop-color="${hsl(h + 10, 58, 76, .95)}"/>
    </radialGradient>
    <pattern id="dot-${id}" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="7" r="2.1" fill="${hsl(h + 18, 70, 34)}"/>
    </pattern>
    <radialGradient id="vig-${id}" cx=".5" cy=".5" r=".78">
      <stop offset=".55" stop-color="#5A2A10" stop-opacity="0"/>
      <stop offset="1" stop-color="#5A2A10" stop-opacity=".22"/>
    </radialGradient>
    <filter id="grain-${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="${id % 100}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
    </filter>
    <filter id="soft-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>`;
}
/* A poster was printed on a flat tint, not on white: the ground is a wash of
   the family's own ink, with a halftone screen laid across the lower half the
   way a press graded a tint down the sheet. That is also what makes a thumbnail
   read from across a grid — a hairline drawing on bare paper does not. */
const ground = (id) => `<rect width="${SIZE}" height="${SIZE}" fill="${PAPER}"/>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#glow-${id})"/>
  <rect y="${SIZE * .52}" width="${SIZE}" height="${SIZE * .48}" fill="url(#dot-${id})" opacity=".22"/>`;
/* The finish is what makes it read as print: edge darkening, paper tooth
   multiplied down, and the double keyline a poster is framed inside — an ink
   rule with a gold hairline set in from it. */
const finish = (id) => `<rect width="${SIZE}" height="${SIZE}" fill="url(#vig-${id})"/>
  <rect width="${SIZE}" height="${SIZE}" filter="url(#grain-${id})" opacity=".07" style="mix-blend-mode:multiply"/>
  <rect x="4" y="4" width="${SIZE - 8}" height="${SIZE - 8}" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="6"/>
  <rect x="24.5" y="24.5" width="${SIZE - 49}" height="${SIZE - 49}" fill="none" stroke="${PAPER}" stroke-opacity=".75" stroke-width="3"/>`;

/* =============================================================================
   STYLES — one drawing routine per kind of work.
   ========================================================================== */

/* Two sine waves at slightly different frequencies drawn over each other, the
   way a raga's phrases circle the same notes without repeating exactly. */
function raga(rand, id, h) {
  const lines = 26; let out = '';
  for (let i = 0; i < lines; i++) {
    const t = i / (lines - 1);
    const y = lerp(180, 820, t);
    const amp = lerp(120, 34, Math.abs(t - .5) * 2) * lerp(.7, 1.25, rand());
    const f1 = lerp(1.6, 3.4, rand()), f2 = f1 * lerp(1.4, 2.3, rand());
    const ph = rand() * Math.PI * 2;
    let d = '';
    for (let x = 40; x <= 960; x += 8) {
      const u = (x - 40) / 920;
      const yy = y + Math.sin(u * Math.PI * f1 + ph) * amp * .7
                   + Math.sin(u * Math.PI * f2 + ph * 1.7) * amp * .3;
      d += (x === 40 ? 'M' : 'L') + x + ' ' + Math.round(yy);
    }
    out += `<path d="${d}" fill="none" stroke="url(#g-${id})" stroke-width="${r2(lerp(6.5, 2.2, Math.abs(t - .5) * 2))}" opacity="${r2(lerp(.42, 1, 1 - Math.abs(t - .5) * 2))}"/>`;
  }
  return out;
}

/* A radial figure built from the harmonic series — the physical basis of every
   sung note. Petals = harmonics 1..n. */
function mandala(rand, id, h) {
  const cx = 500, cy = 500; let out = '';
  const rings = 5 + Math.floor(rand() * 3);
  for (let r = 0; r < rings; r++) {
    const harmonic = r + 2;
    const rad = lerp(110, 420, r / (rings - 1));
    const pts = harmonic * 12;
    let d = '';
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const wob = 1 + Math.sin(a * harmonic) * lerp(.06, .18, rand() * .2 + .5);
      const x = cx + Math.cos(a) * rad * wob, y = cy + Math.sin(a) * rad * wob;
      d += (i === 0 ? 'M' : 'L') + Math.round(x) + ' ' + Math.round(y);
    }
    out += `<path d="${d}Z" fill="none" stroke="url(#g-${id})" stroke-width="${r2(lerp(7, 2.6, r / rings))}" opacity="${r2(lerp(1, .55, r / rings))}"/>`;
  }
  const spokes = 12 + Math.floor(rand() * 8) * 2;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    out += `<line x1="${r2(cx + Math.cos(a) * 90)}" y1="${r2(cy + Math.sin(a) * 90)}" x2="${r2(cx + Math.cos(a) * 450)}" y2="${r2(cy + Math.sin(a) * 450)}" stroke="${hsl(h, 70, 40, .18)}" stroke-width="1"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="66" fill="none" stroke="url(#g-${id})" stroke-width="2.5" opacity=".95"/>`;
  return out;
}

/* A spectrum analyser frozen mid-frame. The silhouette is built from a
   1/f roll-off (so it reads as music, not static) PLUS two or three resonant
   bumps placed per seed — without those every instrumental cover came out the
   same shape. */
function spectrum(rand, id, h) {
  const bars = [48, 56, 64, 72, 80][Math.floor(rand() * 5)];
  const gap = bars > 64 ? 2 : 3;
  const w = (920 - gap * (bars - 1)) / bars;
  const tilt = lerp(.85, 2.1, rand());                 // how fast the top rolls off
  const floorH = lerp(.05, .16, rand());
  const humps = Array.from({ length: 2 + Math.floor(rand() * 3) }, () => ({
    at: rand(), width: lerp(.04, .17, rand()), gain: lerp(.18, .52, rand()),
  }));
  let out = '';
  for (let i = 0; i < bars; i++) {
    const f = (i + .5) / bars;
    let v = Math.pow(1 - f, tilt) * .72 + floorH;
    for (const hp of humps) {
      const d = (f - hp.at) / hp.width;
      v += hp.gain * Math.exp(-d * d);
    }
    v += (rand() - .5) * .07;
    const hgt = Math.max(12, Math.min(1, v) * 640);
    const x = 40 + i * (w + gap);
    out += `<rect x="${r2(x)}" y="${r2(820 - hgt)}" width="${r2(w)}" height="${r2(hgt)}" fill="url(#g-${id})" opacity="${r2(lerp(1, .5, f))}"/>`;
    out += `<rect x="${r2(x)}" y="${r2(820 - hgt - 6)}" width="${r2(w)}" height="2.5" fill="${hsl(h, 90, 30, .9)}"/>`;
  }
  out += `<line x1="40" y1="820" x2="960" y2="820" stroke="${hsl(h, 60, 34, .45)}" stroke-width="1"/>`;
  return out;
}

/* Topographic contour lines — land seen from above, for the songs about
   nature, country and the things that outlast us.
   Each contour is TRACED rather than stippled: for every peak we fire rays
   outward and bisect along each ray to find where the height field crosses the
   level. That yields smooth closed curves at a fraction of the file size. */
function contour(rand, id, h) {
  const peaks = Array.from({ length: 3 + Math.floor(rand() * 2) }, () => ({
    x: lerp(330, 670, rand()), y: lerp(340, 660, rand()),
    s: lerp(150, 280, rand()), a: lerp(.7, 1.15, rand()),
  }));
  const field = (x, y) => peaks.reduce((sum, p) => {
    const dx = (x - p.x) / p.s, dy = (y - p.y) / p.s;
    return sum + p.a * Math.exp(-(dx * dx + dy * dy));
  }, 0);

  const RAYS = 56, LEVELS = 10;
  let out = '';
  for (let l = 1; l <= LEVELS; l++) {
    const iso = (l / (LEVELS + 1.5)) * 1.4;
    for (const p of peaks) {
      if (field(p.x, p.y) < iso) continue;      // peak too low to hold this level
      const pts = [];
      for (let i = 0; i < RAYS; i++) {
        const ang = (i / RAYS) * Math.PI * 2;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        // Bisect between the peak (above iso) and a far point (below iso).
        let lo = 0, hi = 430;   // cap the radius so no curve leaves the frame
        if (field(p.x + cos * hi, p.y + sin * hi) > iso) continue;
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          if (field(p.x + cos * mid, p.y + sin * mid) > iso) lo = mid; else hi = mid;
        }
        const r = (lo + hi) / 2;
        pts.push([Math.round(p.x + cos * r), Math.round(p.y + sin * r)]);
      }
      if (pts.length < RAYS) continue;          // open curve — skip, keeps it clean
      if (pts.some(([x, y]) => x < 46 || x > 954 || y < 46 || y > 954)) continue;
      const d = pts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join('') + 'Z';
      out += `<path d="${d}" fill="none" stroke="url(#g-${id})" stroke-width="${r2(lerp(6.5, 2.4, l / LEVELS))}" opacity="${r2(lerp(1, .5, l / LEVELS))}" stroke-linejoin="round"/>`;
    }
  }
  return out;
}

/* Vinyl grooves with one bright arc — someone else's record, re-cut.
   Rings are drawn brighter and fewer than a literal record would have, because
   at thumbnail size a faithful groove count turns into flat grey. */
function groove(rand, id, h) {
  const cx = 500, cy = 500; let out = '';
  const rings = 30;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const r = lerp(130, 450, t);
    out += `<circle cx="${cx}" cy="${cy}" r="${r2(r)}" fill="none" stroke="url(#g-${id})" stroke-width="${r2(lerp(6, 2.4, t))}" opacity="${r2(lerp(1, .55, t))}"/>`;
  }
  // One groove lit up, as if the needle were sitting in it.
  const litR = lerp(190, 400, rand());
  const a0 = rand() * Math.PI * 2, sweep = lerp(.7, 1.9, rand());
  const px = (a) => `${r2(cx + Math.cos(a) * litR)} ${r2(cy + Math.sin(a) * litR)}`;
  out += `<path d="M${px(a0)}A${r2(litR)} ${r2(litR)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${px(a0 + sweep)}" fill="none" stroke="#9A6B0F" stroke-width="4" stroke-linecap="round"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="86" fill="${hsl(h, 68, 46, .22)}" stroke="url(#g-${id})" stroke-width="2.5"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="9" fill="#2A1508"/>`;
  return out;
}

/* A strip of film frames with a waveform running underneath — score written
   to picture, which is exactly what the screen work is. */
function frames(rand, id, h) {
  let out = '';
  const cols = 3, rows = 2, pad = 70, gapx = 26, gapy = 26;
  const fw = (SIZE - pad * 2 - gapx * (cols - 1)) / cols;
  const fh = fw * 0.56;
  const top = 210;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (fw + gapx), y = top + r * (fh + gapy);
      out += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(fw)}" height="${r2(fh)}" fill="${hsl(h, 60, 50, .12)}" stroke="url(#g-${id})" stroke-width="1.5" opacity=".8"/>`;
      const bars = 5 + Math.floor(rand() * 4);
      for (let b = 0; b < bars; b++) {
        const bx = x + 10 + rand() * (fw - 26);
        const bh = 8 + rand() * (fh - 26);
        out += `<rect x="${r2(bx)}" y="${r2(y + fh - 10 - bh)}" width="3" height="${r2(bh)}" fill="url(#g-${id})" opacity=".55"/>`;
      }
    }
  }
  // sprocket holes, top and bottom
  for (const y of [128, SIZE - 168]) {
    for (let x = pad; x < SIZE - pad; x += 62) {
      out += `<rect x="${r2(x)}" y="${y}" width="30" height="22" rx="4" fill="none" stroke="${hsl(h, 50, 34, .35)}" stroke-width="1.5"/>`;
    }
  }
  // waveform along the base
  let d = ''; const mid = SIZE - 96;
  for (let x = pad; x <= SIZE - pad; x += 4) {
    const u = (x - pad) / (SIZE - pad * 2);
    const env = Math.sin(u * Math.PI) * .9 + .1;
    const amp = env * (24 + rand() * 22);
    d += `M${r2(x)} ${r2(mid - amp)}V${r2(mid + amp)}`;
  }
  out += `<path d="${d}" stroke="url(#g-${id})" stroke-width="2" opacity=".9"/>`;
  return out;
}

const STYLES = { raga, mandala, spectrum, contour, groove, frames };

/* --- Build ---------------------------------------------------------------- */
function makeSvg(slug, style) {
  const seed = hashSeed(slug + ':' + style);
  const rand = rng(seed);
  const [h0, h1] = HUE[style] || HUE.raga;
  const h = h0 > h1 ? (h0 + rand() * ((360 - h0) + h1)) % 360 : lerp(h0, h1, rand());
  const id = seed % 9973;
  const draw = (STYLES[style] || raga)(rand, id, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="Abstract generated cover artwork">${defs(id, h)}${ground(id)}${draw}${finish(id)}</svg>`;
}

const content = JSON.parse(readFileSync(join(HERE, '..', 'content', 'site.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });

let n = 0, bytes = 0;
for (const w of content.works) {
  const svg = makeSvg(w.slug, w.artStyle || 'raga');
  const file = join(OUT, `${w.slug}.svg`);
  writeFileSync(file, svg);
  n++; bytes += Buffer.byteLength(svg);
}
// An open-graph / social-share card reuses the spectrum language.
writeFileSync(join(OUT, '_og.svg'), makeSvg(content.identity.name, 'spectrum'));

console.log(`gen-art: wrote ${n} covers + 1 share card (${Math.round(bytes / 1024)} KB total, avg ${Math.round(bytes / n / 1024 * 10) / 10} KB)`);
