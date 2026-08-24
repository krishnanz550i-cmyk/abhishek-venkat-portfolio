/**
 * check-content.mjs — runs before every build and refuses to publish a site
 * that would embarrass its owner.
 *
 * The point is not schema pedantry. It is that a portfolio has a small number
 * of ways to go badly wrong in public — a placeholder price left in, a dead
 * link to a project page, a share card pointing at a missing image — and every
 * one of them is cheap to catch here and expensive to discover after a client
 * has already seen it.
 *
 * ERRORS stop the build. WARNINGS are printed and let it through.
 *
 * Deliberate escape hatch: ALLOW_PLACEHOLDER=1 lets you build a preview with
 * unfinished content, for showing work in progress. It is off by default, so
 * nobody can publish placeholder text by accident.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PENDING = 'NEEDS-CONFIRMATION';
const allowPlaceholder = process.env.ALLOW_PLACEHOLDER === '1';

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

let content;
try {
  content = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));
} catch (e) {
  console.error(`\n  Your content file has a typo in it and the site cannot be built.\n`);
  console.error(`  ${e.message}\n`);
  console.error(`  This is almost always a missing comma, an extra comma before a }` +
                `, or a missing quote mark.\n  Paste content/site.json into jsonlint.com to see exactly which line.\n`);
  process.exit(1);
}

const has = (v) => typeof v === 'string' && v.trim() !== '' && !v.startsWith(PENDING);
const asset = (p) => existsSync(join(ROOT, 'public', p.replace(/^\//, '')));

/* --- The things that must be true before anyone sees this ---------------- */
if (!has(content.meta?.siteUrl) || content.meta.siteUrl.includes('example.'))
  err('meta.siteUrl is not set to your real web address. Search engines and share links depend on it.');

if (!has(content.identity?.name)) err('identity.name is empty.');
if (!Array.isArray(content.works) || content.works.length === 0)
  err('There are no projects in "works" — the site would have an empty work page.');

/* --- Projects ------------------------------------------------------------ */
const slugs = new Set();
for (const w of content.works || []) {
  const where = `works → ${w.slug || w.title || '(untitled)'}`;
  if (!has(w.slug)) err(`${where}: missing "slug" (the web address for its page).`);
  else if (slugs.has(w.slug)) err(`${where}: two projects share the slug "${w.slug}". Slugs must be unique.`);
  else slugs.add(w.slug);

  if (!has(w.title)) err(`${where}: missing "title".`);
  if (!has(w.summary)) warn(`${where}: no summary — its page and its share card will look bare.`);
  if (!w.roles?.length) warn(`${where}: no roles listed, so nobody can tell what you did on it.`);

  const cover = w.cover || `/art/${w.slug}.svg`;
  if (!asset(cover)) err(`${where}: cover image "${cover}" does not exist. Run "npm run assets" or fix the path.`);

  for (const l of w.links || []) {
    if (!has(l.url)) err(`${where}: a link has no URL.`);
    else if (!/^https?:\/\//.test(l.url)) err(`${where}: link "${l.url}" must start with https://`);
    if (!has(l.label)) warn(`${where}: a link has no label, so the button will be blank.`);
  }
  if (w.rightsNote?.startsWith(PENDING))
    warn(`${where}: rightsNote still says ${PENDING} — confirm how this project should be described before publishing.`);
}

/* --- Audio --------------------------------------------------------------- */
for (const t of content.player?.queue || []) {
  if (!asset(t.src)) err(`player queue: audio file "${t.src}" does not exist.`);
}
if (content.compare?.enabled) {
  for (const k of ['raw', 'mixed']) {
    const src = content.compare[k]?.src;
    if (!src || !asset(src)) err(`compare.${k}: audio file "${src}" does not exist.`);
  }
}

/* --- Contact ------------------------------------------------------------- */
if (!has(content.contact?.email) && !has(content.contact?.formEndpoint)) {
  // In a preview build this is expected - the owner has not supplied it yet.
  // In a real build it is the single worst thing that can be wrong with a
  // portfolio, so it stops everything.
  (allowPlaceholder ? warn : err)('Nobody can reach you: set contact.email, or contact.formEndpoint, or both.');
}
if (has(content.contact?.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(content.contact.email))
  err(`contact.email "${content.contact.email}" does not look like an email address.`);

/* --- Placeholders still in the file -------------------------------------- */
const pending = [];
(function walk(node, path) {
  if (typeof node === 'string') {
    // rightsNote gets its own, more specific warning above; listing it twice
    // just makes the report look longer than the job actually is.
    if (node.startsWith(PENDING) && !path.endsWith('.rightsNote')) pending.push(path);
  } else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  }
})(content, '');

if (content._placeholder === true || pending.length) {
  const lines = [
    content._placeholder === true
      ? 'content/site.json still has "_placeholder": true — delete that line when the content is real.'
      : null,
    ...pending.map((p) => `${p} still says ${PENDING}.`),
  ].filter(Boolean);
  if (allowPlaceholder) lines.forEach(warn);
  else lines.forEach(err);
}

/* --- Report -------------------------------------------------------------- */
const line = '─'.repeat(64);
if (warnings.length) {
  console.log(`\n${line}\n  ${warnings.length} thing${warnings.length > 1 ? 's' : ''} worth fixing (the site will still build)\n${line}`);
  warnings.forEach((w, i) => console.log(`  ${String(i + 1).padStart(2)}. ${w}`));
}
if (errors.length) {
  console.error(`\n${line}\n  BUILD STOPPED — ${errors.length} problem${errors.length > 1 ? 's' : ''} must be fixed first\n${line}`);
  errors.forEach((e, i) => console.error(`  ${String(i + 1).padStart(2)}. ${e}`));
  if (!allowPlaceholder && (content._placeholder === true || pending.length)) {
    console.error(`\n  To build a PREVIEW anyway, with the unfinished bits left in:\n     ALLOW_PLACEHOLDER=1 npm run build\n`);
  }
  console.error('');
  process.exit(1);
}
console.log(`\n  Content check passed — ${content.works.length} projects, ${(content.player?.queue || []).length} player tracks.\n`);
