/** Verifies the packed single-file build behaves like the real site. */
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (n, pass, d = '') => { results.push(pass); console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); };

const server = await serve(join(ROOT, 'dist-single'), 4355);
const browser = await launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
// Nothing may reach the network: the file has to be entirely self-contained.
const external = [];
p.on('request', (r) => { if (!r.url().startsWith('http://localhost:4355') && !r.url().startsWith('data:')) external.push(r.url()); });

await p.goto('http://localhost:4355/preview.html', { waitUntil: 'load' });
await p.waitForTimeout(1200);

check('Home renders', await p.locator('h1.display').isVisible(),
      (await p.locator('h1.display').innerText()).replace(/\n/g, ' '));
check('Cover artwork is embedded and drawn', await p.evaluate(() => {
  const i = document.querySelector('.work-card__media img');
  return !!i && i.currentSrc.startsWith('data:') && i.naturalWidth > 0;
}));

await p.click('a[href="/work"]');
await p.waitForTimeout(700);
const workCards = await p.locator('.work-card').count();
check('Navigating to Work swaps the page', workCards === 23, `${workCards} projects`);

const content = JSON.parse((await import('node:fs')).readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));
const expectedTamil = content.works.filter((w) => w.collection === 'tamil').length;
await p.click('[data-filter="tamil"]');
await p.waitForTimeout(300);
const shownTamil = await p.locator('.work-card:not([hidden])').count();
check('Filters still work after a swap', shownTamil === expectedTamil,
      `${shownTamil} shown, ${expectedTamil} expected`);

// The whole point: start audio, change page, confirm it is still playing.
await p.click('[data-play]');
await p.waitForTimeout(1300);
const t1 = await p.evaluate(() => document.querySelector('[data-audio]').currentTime);
await p.click('a[href="/about"]');
await p.waitForTimeout(1300);
const after = await p.evaluate(() => ({ t: document.querySelector('[data-audio]').currentTime, paused: document.querySelector('[data-audio]').paused }));
check('Audio survives a page change in the packed file', !after.paused && after.t > t1,
      `${t1.toFixed(2)}s → ${after.t.toFixed(2)}s`);

await p.click('a[href="/"]');
await p.waitForTimeout(900);
await p.locator('[data-ab-play]').scrollIntoViewIfNeeded();
await p.click('[data-ab-play]');
await p.waitForTimeout(1200);
await p.click('[data-ab-side="mixed"]');
await p.waitForTimeout(500);
const ab = await p.evaluate(() => [...document.querySelectorAll('[data-ab-audio]')].map((a) => Math.round(a.volume * 100)));
check('Before/after comparison plays and switches', ab.length === 2 && ab.includes(100) && ab.includes(0), `volumes ${ab.join('/')}`);

await p.goto('http://localhost:4355/preview.html#/work/nadhi', { waitUntil: 'load' });
await p.waitForTimeout(900);
check('A deep link opens the right project', /nadhi/i.test(await p.locator('h1').innerText()),
      await p.locator('h1').innerText());

check('Nothing is fetched from the network', external.length === 0, external.slice(0, 3).join(', ') || 'no external requests');
check('No JavaScript errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');

await p.screenshot({ path: '/tmp/single-home.png' });
await browser.close(); server.close();
console.log(`\n  ${results.filter(Boolean).length}/${results.length} checks passed.\n`);
process.exit(results.every(Boolean) ? 0 : 1);
