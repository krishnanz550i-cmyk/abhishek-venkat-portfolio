/**
 * check-build.mjs — inspects the finished site, not the source.
 *
 * The content check earlier asks "is the content sensible?". This one asks
 * "did the thing we actually built come out right?" — which is a different
 * question, and the one that catches a link that points at a page that no
 * longer exists, or a placeholder that leaked into the published HTML.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const errors = [], warnings = [];

if (!existsSync(DIST)) {
  console.error('  No dist/ folder — the build did not produce anything.');
  process.exit(1);
}

/* --- Walk the built output ----------------------------------------------- */
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(DIST);

const html = files.filter((f) => f.endsWith('.html'));
const rel = (f) => '/' + relative(DIST, f).replace(/\\/g, '/');

/* --- 1. Every page we expect actually exists ----------------------------- */
const content = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));
const expected = ['index.html', 'work/index.html', 'about/index.html',
                  'services/index.html', 'contact/index.html', '404.html',
                  'sitemap.xml', 'robots.txt',
                  ...content.works.map((w) => `work/${w.slug}/index.html`)];
for (const e of expected) {
  if (!existsSync(join(DIST, e))) errors.push(`Expected page missing from the build: ${e}`);
}

/* --- 2. Internal links point at something that exists -------------------- */
// When the site is published under a sub-path the built links carry that
// prefix, but on disk dist/ has no such folder. Strip it before resolving.
const BASE = (process.env.SITE_BASE || '/').replace(/\/$/, '');
const resolveLink = (href) => {
  let clean = href.split('#')[0].split('?')[0];
  if (BASE && (clean === BASE || clean.startsWith(BASE + '/'))) clean = clean.slice(BASE.length) || '/';
  if (!clean || clean === '/') return join(DIST, 'index.html');
  const base = join(DIST, clean.replace(/^\//, ''));
  if (existsSync(base) && statSync(base).isFile()) return base;
  if (existsSync(join(base, 'index.html'))) return join(base, 'index.html');
  return null;
};

let linkCount = 0;
for (const page of html) {
  const src = readFileSync(page, 'utf8');
  for (const m of src.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    linkCount++;
    if (!resolveLink(href)) errors.push(`${rel(page)} links to ${href}, which does not exist in the build.`);
  }
}

/* --- 3. Nothing unfinished leaked into a published page ------------------ */
if (process.env.ALLOW_PLACEHOLDER !== '1') {
  for (const page of html) {
    const src = readFileSync(page, 'utf8');
    if (src.includes('NEEDS-CONFIRMATION'))
      errors.push(`${rel(page)} contains the text NEEDS-CONFIRMATION — a placeholder reached the published page.`);
    if (/lorem ipsum/i.test(src))
      errors.push(`${rel(page)} contains lorem ipsum.`);
  }
}

/* --- 4. Every page carries what a search engine and a share need --------- */
for (const page of html) {
  if (rel(page) === '/404.html') continue;
  const src = readFileSync(page, 'utf8');
  const need = [
    [/<title>[^<]{5,}<\/title>/, 'a <title>'],
    [/name="description" content="[^"]{20,}"/, 'a meta description'],
    [/rel="canonical"/, 'a canonical link'],
    [/property="og:image"/, 'a share image'],
    [/application\/ld\+json/, 'structured data'],
    [/<h1[\s>]/, 'an <h1> heading'],
  ];
  for (const [re, what] of need) {
    if (!re.test(src)) warnings.push(`${rel(page)} is missing ${what}.`);
  }
  // Images without alt text are invisible to screen readers and to Google.
  for (const m of src.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) {
    warnings.push(`${rel(page)} has an <img> with no alt attribute: ${m[0].slice(0, 70)}…`);
  }
}

/* --- 5. Weight ----------------------------------------------------------- */
const totalKb = files.reduce((n, f) => n + statSync(f).size, 0) / 1024;
const jsKb = files.filter((f) => extname(f) === '.js').reduce((n, f) => n + statSync(f).size, 0) / 1024;
const cssKb = files.filter((f) => extname(f) === '.css').reduce((n, f) => n + statSync(f).size, 0) / 1024;
const homeKb = existsSync(join(DIST, 'index.html')) ? statSync(join(DIST, 'index.html')).size / 1024 : 0;
if (jsKb > 120) warnings.push(`JavaScript totals ${jsKb.toFixed(0)} KB — heavier than this site should need.`);

/* --- Report -------------------------------------------------------------- */
const line = '─'.repeat(64);
console.log(`\n${line}`);
console.log(`  Built ${html.length} pages · ${linkCount} internal links checked`);
console.log(`  Home page HTML ${homeKb.toFixed(0)} KB · CSS ${cssKb.toFixed(0)} KB · JS ${jsKb.toFixed(0)} KB · everything ${(totalKb / 1024).toFixed(1)} MB`);
console.log(line);

if (warnings.length) {
  console.log(`\n  ${warnings.length} warning${warnings.length > 1 ? 's' : ''}:`);
  warnings.slice(0, 25).forEach((w, i) => console.log(`   ${String(i + 1).padStart(2)}. ${w}`));
  if (warnings.length > 25) console.log(`   … and ${warnings.length - 25} more.`);
}
if (errors.length) {
  console.error(`\n  ${errors.length} problem${errors.length > 1 ? 's' : ''} with the built site:`);
  errors.forEach((e, i) => console.error(`   ${String(i + 1).padStart(2)}. ${e}`));
  console.error('');
  process.exit(1);
}
console.log('\n  Build check passed.\n');
