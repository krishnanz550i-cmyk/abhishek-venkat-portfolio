import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const server = await serve(join(ROOT, 'dist'), 4321);
const browser = await launch();

const pages = [
  ['home', '/'], ['work', '/work'], ['project', '/work/tere-bin-main-adhoora'],
  ['about', '/about'], ['services', '/services'], ['contact', '/contact'],
];

for (const [name, path] of pages) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4321' + path, { waitUntil: 'load', timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  // Full-page captures happen at scroll 0, so scroll-revealed sections would
  // photograph as blank space. Force them visible for the review capture.
  await page.evaluate(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.classList.add('is-in');
      [...el.children].forEach((c) => c.classList.add('is-in'));
    });
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  await page.close();
}

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto('http://localhost:4321/', { waitUntil: 'load', timeout: 20000 });
await m.evaluate(() => document.fonts.ready);
await m.waitForTimeout(600);
await m.screenshot({ path: `${OUT}/mobile-home.png` });
await m.close();

await browser.close();
server.close();
console.log('shots written to', OUT);
