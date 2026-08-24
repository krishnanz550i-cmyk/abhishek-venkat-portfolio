/**
 * smoke.mjs — drives the built site in a real browser and checks the things
 * that screenshots cannot tell you: does the music keep playing when you change
 * page, does the A/B switch actually swap which file you hear, do the filters
 * filter, does the site still work with JavaScript switched off.
 */
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:4322';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const server = await serve(join(ROOT, 'dist'), 4322);
const browser = await launch();

/* ---------------------------------------------------------------- 1. Reveal */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/work', { waitUntil: 'load' });
  const before = await p.locator('.work-card.is-in').count();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(900);
  const after = await p.locator('.work-card.is-in').count();
  const total = await p.locator('.work-card').count();
  check('Scroll reveals every project card', after === total,
        `${before} visible at top → ${after}/${total} after scrolling`);
  await p.close();
}

/* --------------------------------------------------------------- 2. Filters */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/work', { waitUntil: 'load' });
  const all = await p.locator('.work-card:not([hidden])').count();
  await p.click('[data-filter="screen"]');
  await p.waitForTimeout(250);
  const screen = await p.locator('.work-card:not([hidden])').count();
  const url = p.url();
  check('Filter narrows the grid', screen > 0 && screen < all, `${all} → ${screen} projects`);
  check('Filter is shareable in the URL', url.includes('filter=screen'), url.replace(BASE, ''));
  await p.goBack();
  await p.waitForTimeout(300);
  const back = await p.locator('.work-card:not([hidden])').count();
  check('Back button restores the full grid', back === all, `${back} projects`);
  await p.close();
}

/* ------------------------------------------- 3. Player survives navigation */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.click('[data-play]');
  await p.waitForTimeout(1400);
  const playing = await p.evaluate(() => {
    const a = document.querySelector('[data-audio]');
    return { paused: a.paused, t: a.currentTime, src: a.currentSrc };
  });
  check('Player starts on click', !playing.paused && playing.t > 0, `${playing.t.toFixed(2)}s in`);

  await p.click('a[href="/about"]');
  await p.waitForTimeout(1400);
  const after = await p.evaluate(() => {
    const a = document.querySelector('[data-audio]');
    return { paused: a.paused, t: a.currentTime, path: location.pathname };
  });
  check('Music keeps playing across a page change',
        !after.paused && after.t > playing.t,
        `now on ${after.path} at ${after.t.toFixed(2)}s (was ${playing.t.toFixed(2)}s)`);

  const vis = await p.evaluate(() => {
    const c = document.querySelector('[data-vis]');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
    return lit;
  });
  check('Visualiser is drawing from the signal', vis > 500, `${vis} lit pixels`);
  await p.close();
}

/* ----------------------------------------------------------------- 4. A/B */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.locator('[data-ab-play]').scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await p.click('[data-ab-play]');
  await p.waitForTimeout(1200);
  const s1 = await p.evaluate(() => {
    const el = [...document.querySelectorAll('audio')];
    return el.map((a) => ({ src: a.currentSrc.split('/').pop(), v: Math.round(a.volume * 100), paused: a.paused }));
  });
  const rawOn = s1.find((x) => x.src === 'demo-raw.mp3');
  const mixOff = s1.find((x) => x.src === 'demo-mixed.mp3');
  check('A/B plays both files in sync', rawOn && mixOff && !rawOn.paused && !mixOff.paused,
        JSON.stringify(s1.filter((x) => x.src.startsWith('demo'))));
  check('A/B starts on the rough bounce', rawOn?.v === 100 && mixOff?.v === 0,
        `raw ${rawOn?.v}% / mixed ${mixOff?.v}%`);

  await p.click('[data-ab-side="mixed"]');
  await p.waitForTimeout(500);
  const s2 = await p.evaluate(() => [...document.querySelectorAll('audio')]
    .map((a) => ({ src: a.currentSrc.split('/').pop(), v: Math.round(a.volume * 100) })));
  const r2 = s2.find((x) => x.src === 'demo-raw.mp3'), m2 = s2.find((x) => x.src === 'demo-mixed.mp3');
  check('Switching to B crossfades to the finished mix', m2?.v === 100 && r2?.v === 0,
        `raw ${r2?.v}% / mixed ${m2?.v}%`);

  const drift = await p.evaluate(() => {
    const [a, b] = [...document.querySelectorAll('audio')].filter((x) => x.currentSrc.includes('demo'));
    return Math.abs(a.currentTime - b.currentTime);
  });
  check('The two versions stay in sync', drift < 0.12, `${(drift * 1000).toFixed(0)} ms apart`);
  await p.close();
}

/* ---------------------------------------------------- 5. Only one sound source */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.click('[data-play]');
  await p.waitForTimeout(700);
  await p.locator('[data-ab-play]').scrollIntoViewIfNeeded();
  await p.click('[data-ab-play]');
  await p.waitForTimeout(700);
  const state = await p.evaluate(() => ({
    player: document.querySelector('[data-audio]').paused,
    ab: [...document.querySelectorAll('audio')].filter((a) => a.currentSrc.includes('demo-')).every((a) => !a.paused),
  }));
  check('Starting the comparison stops the player', state.player && state.ab,
        `player paused=${state.player}, comparison playing=${state.ab}`);
  await p.close();
}

/* --------------------------------------------------------- 6. Mobile menu */
{
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  const hiddenFirst = await p.locator('[data-menu]').isHidden();
  await p.click('[data-menu-toggle]');
  await p.waitForTimeout(400);
  const open = await p.locator('[data-menu]').isVisible();
  await p.click('.menu__link >> nth=1');
  await p.waitForTimeout(700);
  check('Mobile menu opens and navigates', hiddenFirst && open && p.url().includes('/about'),
        p.url().replace(BASE, ''));
  await p.close();
}

/* --------------------------------------------------- 7. Works without JS */
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/work', { waitUntil: 'load' });
  const cards = await p.locator('.work-card').count();
  const visible = await p.locator('.work-card').first().isVisible();
  const headingVisible = await p.locator('h1').isVisible();
  check('Every project is readable with JavaScript off', cards === 23 && visible && headingVisible,
        `${cards} projects rendered, first card visible=${visible}`);
  await ctx.close();
}

/* ------------------------------------------------- 8. Contact route works */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/contact', { waitUntil: 'load' });
  const details = await p.evaluate(() => {
    const dd = [...document.querySelectorAll('.proj__fact')].map((f) => f.textContent.replace(/\s+/g, ' ').trim());
    return {
      details: dd,
      mailto: document.querySelector('a[href^="mailto:"]')?.getAttribute('href') || '',
      tel: [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href')),
      note: document.querySelector('[data-contact-note]')?.textContent.trim() || '',
      leaksAddress: /Al Furjan|Villa|Qourtaj/i.test(document.body.innerHTML),
      leaksDob: /May 3rd|2000-05-03|Date of Birth/i.test(document.body.innerHTML),
    };
  });
  check('Contact page shows a reachable email', details.mailto.includes('@'), details.mailto);
  check('Both phone numbers are dialable', details.tel.length === 2 && details.tel.every((t) => /^tel:\+\d{8,}$/.test(t)),
        details.tel.join(' , '));
  check('Form explains it will use the email app', /email app/i.test(details.note), `"${details.note}"`);
  // The old site published a home address and a date of birth. Neither belongs
  // on a public page; this check makes sure neither creeps back in unnoticed.
  check('No home address or date of birth is published',
        !details.leaksAddress && !details.leaksDob,
        `address=${details.leaksAddress} dob=${details.leaksDob}`);
  await p.close();
}

/* ---------------------------------------------------- 9. Keyboard access */
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + '/', { waitUntil: 'load' });
  await p.keyboard.press('Tab');
  const first = await p.evaluate(() => document.activeElement?.className || '');
  check('First tab reaches the skip link', first.includes('skip'), `focus on "${first}"`);
  await p.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n  ${results.length - failed.length}/${results.length} checks passed.\n`);
process.exit(failed.length ? 1 : 0);
