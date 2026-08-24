/**
 * base.mjs — proves the site works when published under a sub-path.
 *
 * GitHub Pages serves a project site at /repo-name/, not at the domain root.
 * Every absolute path in the site would 404 there, which is a failure that only
 * shows up after publishing. This builds with a base and serves it the way
 * Pages does, so the failure shows up here instead.
 */
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SITE_BASE?.replace(/\/$/, '') || '/preview-base';
const PORT = 4377;
const at = (p = '') => `http://localhost:${PORT}${BASE}${p}`;

const results = [];
const check = (n, pass, d = '') => { results.push(pass); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); };

const server = await serve(join(ROOT, 'dist'), PORT, BASE);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const failed = [];
// A media element that is told to preload and then never played has its request
// cancelled by the browser. That is normal and is NOT a broken path, so only
// genuine errors count here.
page.on('requestfailed', (r) => {
  const why = r.failure()?.errorText || 'unknown';
  if (why !== 'net::ERR_ABORTED') failed.push(`${why} ${r.url()}`);
});
page.on('response', (r) => { if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url()}`); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(at('/'), { waitUntil: 'load' });
await page.waitForTimeout(1200);

check('Home loads under the sub-path', await page.locator('h1.display').isVisible());
check('Fonts resolve', await page.evaluate(() => document.fonts.check('700 2rem Archivo')));
check('Cover artwork resolves', await page.evaluate(() => {
  const i = document.querySelector('.work-card__media img');
  return !!i && i.naturalWidth > 0;
}));

// Every internal link the page renders must sit inside the base.
const strayLinks = await page.evaluate((base) => [...document.querySelectorAll('a[href^="/"]')]
  .map((a) => a.getAttribute('href'))
  .filter((h) => !h.startsWith(base + '/') && h !== base), BASE);
check('No link escapes the sub-path', strayLinks.length === 0, strayLinks.slice(0, 4).join(', ') || 'all prefixed');

await page.click(`a[href="${BASE}/work"]`);
await page.waitForTimeout(900);
check('Navigating to Work works', (await page.locator('.work-card').count()) === 23);

await page.click('[data-play]');
await page.waitForTimeout(1500);
const audio = await page.evaluate(() => {
  const a = document.querySelector('[data-audio]');
  return { paused: a.paused, t: a.currentTime, src: a.currentSrc };
});
check('Audio file resolves and plays', !audio.paused && audio.t > 0,
      `${audio.t.toFixed(2)}s from ${audio.src.split('/').slice(3).join('/')}`);

await page.goto(at('/work/nadhi'), { waitUntil: 'load' });
await page.waitForTimeout(700);
check('A project page loads directly', /nadhi/i.test(await page.locator('h1').innerText()));

const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
check('Canonical URL is not doubled up', !/(\/[^/]+)\1/.test(new URL(canonical).pathname), canonical);

// Ask for every asset the page depends on directly, so an aborted preload can
// never hide a path that genuinely does not resolve.
const assets = await page.evaluate(() => {
  const abRoot = document.querySelector('[data-ab]');
  return [
    ...[...document.querySelectorAll('img[src]')].map((i) => i.getAttribute('src')),
    ...(abRoot ? [abRoot.dataset.raw, abRoot.dataset.mixed] : []),
    ...JSON.parse(document.querySelector('[data-queue-data]').textContent).map((t) => t.src),
  ];
});
const statuses = await Promise.all([...new Set(assets)].map(async (a) => {
  const res = await fetch(new URL(a, at('/')).href, { method: 'GET' });
  return [a, res.status];
}));
const missing = statuses.filter(([, code]) => code >= 400);
check('Every asset the page references actually serves', missing.length === 0,
      missing.length ? missing.map(([a, c]) => `${c} ${a}`).join(' | ') : `${statuses.length} assets, all 200`);
check('No request errors', failed.length === 0, failed.slice(0, 4).join(' | ') || 'none');
check('No JavaScript errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');

await page.screenshot({ path: '/tmp/base-check.png' });
await browser.close(); server.close();
console.log(`\n  ${results.filter(Boolean).length}/${results.length} checks passed.\n`);
process.exit(results.every(Boolean) ? 0 : 1);
