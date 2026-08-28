/**
 * check-contrast.mjs — proves the palette is readable, instead of claiming it.
 *
 * The colours are defined once in src/styles/tokens.css. This reads them from
 * that file — not from a copy — computes the real contrast ratio of every text
 * colour against every surface it is used on, and fails the build if one drops
 * below the threshold for its role.
 *
 * The point is that a comment saying "9.4:1" stops being true the moment someone
 * nudges a hex value, and nobody notices. A check cannot go stale.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8');

const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`Token --${name} not found in tokens.css`);
  return m[1];
};

const channel = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// WCAG: 4.5 for body text, 3.0 for large headings and for non-text indicators
// that carry meaning (the meter colours, the availability dot).
const SURFACES = ['ink', 'ink-2', 'panel', 'panel-2'];
const RULES = [
  { fg: 'text', min: 4.5, role: 'body text' },
  { fg: 'text-2', min: 4.5, role: 'secondary text' },
  { fg: 'text-3', min: 4.5, role: 'small labels' },
  { fg: 'signal', min: 3.0, role: 'accent on large text and rules' },
  { fg: 'signal-lo', min: 4.5, role: 'accent used as running text' },
  { fg: 'meter-ok', min: 3.0, role: 'meter indicator' },
  { fg: 'meter-warn', min: 3.0, role: 'meter indicator' },
  { fg: 'meter-peak', min: 3.0, role: 'meter indicator' },
  { fg: 'gold', min: 3.0, role: 'ornament rules and garlands' },
  { fg: 'rose', min: 4.5, role: 'second accent, used as text' },
  { fg: 'teal', min: 4.5, role: 'third accent, used as text' },
];

const failures = [];
const rows = [];
for (const rule of RULES) {
  const fg = token(rule.fg);
  let worst = Infinity, worstOn = '';
  for (const s of SURFACES) {
    const r = contrast(fg, token(s));
    if (r < worst) { worst = r; worstOn = s; }
  }
  rows.push(`  --${rule.fg.padEnd(11)} ${worst.toFixed(2).padStart(6)}:1 on --${worstOn.padEnd(8)} (needs ${rule.min})  ${rule.role}`);
  if (worst < rule.min) {
    failures.push(`--${rule.fg} is only ${worst.toFixed(2)}:1 against --${worstOn}; ${rule.role} needs at least ${rule.min}:1.`);
  }
}

// Text sitting ON the accent (buttons) is the pairing people forget. The
// colour used there is a token too (--on-signal), so this reads the real value
// rather than a copy of it that can drift.
const PAIRS = [
  { fg: 'on-signal', bg: 'signal', min: 4.5, role: 'label on a filled button' },
  { fg: 'on-signal', bg: 'signal-lo', min: 4.5, role: 'label on the deeper red' },
  { fg: 'on-signal', bg: 'text', min: 4.5, role: 'label on an ink-filled panel' },
  { fg: 'on-ink', bg: 'text', min: 4.5, role: 'credits-block type on the ink slab' },
  { fg: 'on-ink-2', bg: 'text', min: 4.5, role: 'small credits line on the ink slab' },
  { fg: 'gold-hi', bg: 'text', min: 4.5, role: 'gold on the ink slab' },
];
for (const p of PAIRS) {
  const r = contrast(token(p.fg), token(p.bg));
  rows.push(`  --${p.fg} on --${p.bg.padEnd(9)} ${r.toFixed(2).padStart(6)}:1  (needs ${p.min})  ${p.role}`);
  if (r < p.min) failures.push(`--${p.fg} is only ${r.toFixed(2)}:1 on --${p.bg}; ${p.role} needs at least ${p.min}:1.`);
}

console.log('\n  Contrast, measured from tokens.css (worst surface for each):');
rows.forEach((r) => console.log(r));

if (failures.length) {
  console.error(`\n  ${failures.length} colour pairing is not readable enough:`);
  failures.forEach((f, i) => console.error(`   ${i + 1}. ${f}`));
  console.error('');
  process.exit(1);
}
console.log('  All pairings pass.\n');
