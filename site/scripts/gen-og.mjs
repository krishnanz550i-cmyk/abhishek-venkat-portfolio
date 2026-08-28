/**
 * gen-og.mjs — renders the image that appears when someone shares a link.
 *
 * This is the picture that shows up in a WhatsApp preview, an Instagram DM or a
 * Google result. It has to carry the name at a glance. Rendered once here and
 * committed, so publishing the site never needs a browser.
 *
 * Run with: npm run og   (needs the dev dependencies installed)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { launch } from '../test/browser.mjs';

const content = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
const art = readFileSync(new URL('../public/art/_og.svg', import.meta.url), 'utf8');
const font = readFileSync(new URL('../public/fonts/archivo-latin-var.woff2', import.meta.url)).toString('base64');

const { name, roles, location } = content.identity;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family:'Archivo'; src:url(data:font/woff2;base64,${font}) format('woff2-variations'); font-weight:100 900; font-stretch:62% 125%; }
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#FCF6EA;color:#2A1508;font-family:Archivo,sans-serif;position:relative;overflow:hidden}
/* The sunburst behind a hand-painted poster title. */
.rays{position:absolute;inset:0;background:repeating-conic-gradient(from -8deg at 8% 100%,rgba(154,107,15,.20) 0deg 3.2deg,transparent 3.2deg 9deg);
  -webkit-mask-image:radial-gradient(95% 95% at 8% 100%,#000 12%,transparent 74%)}
.art{position:absolute;right:0;top:-285px;width:1200px;height:1200px;opacity:.6;
  -webkit-mask-image:linear-gradient(100deg,transparent 34%,#000 78%)}
.art svg{width:100%;height:100%}
.scrim{position:absolute;inset:0;background:linear-gradient(100deg,#FCF6EA 40%,rgba(252,246,234,.55) 62%,rgba(252,246,234,0))}
.in{position:absolute;inset:0;padding:72px;display:flex;flex-direction:column;justify-content:space-between}
.kick{font-size:21px;letter-spacing:.26em;text-transform:uppercase;color:#A4121C;font-weight:600}
h1{font-size:88px;line-height:.92;font-weight:800;font-stretch:88%;letter-spacing:-.04em;text-transform:uppercase;max-width:16ch;
  text-shadow:3px 4px 0 rgba(154,107,15,.22)}
.roles{display:flex;gap:12px;flex-wrap:wrap}
.role{border:1px solid rgba(64,28,10,.30);border-radius:999px;padding:9px 20px;font-size:19px;letter-spacing:.1em;text-transform:uppercase;color:#5B4126}
.foot{display:flex;justify-content:space-between;align-items:flex-end}
.loc{font-size:20px;letter-spacing:.18em;text-transform:uppercase;color:#6E5334}
/* The marigold garland strung across the foot of the sheet. */
.bar{position:absolute;left:0;right:0;bottom:0;height:18px;
  background:radial-gradient(circle at 10px 9px,#9A6B0F 0 4px,transparent 4.5px) 0 0/20px 18px repeat-x,
             radial-gradient(circle at 20px 9px,#C1121F 0 2.5px,transparent 3px) 0 0/20px 18px repeat-x,
             #FCF6EA}
</style>
<div class="art">${art}</div><div class="scrim"></div><div class="rays"></div>
<div class="in">
  <p class="kick">${roles.slice(0, 2).join(' · ')}</p>
  <div>
    <h1>${name}</h1>
    <div class="roles" style="margin-top:34px">${roles.map((r) => `<span class="role">${r}</span>`).join('')}</div>
  </div>
  <div class="foot"><span class="loc">${location}</span></div>
</div>
<div class="bar"></div>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL('../public/art/og.png', import.meta.url).pathname });
await browser.close();
console.log('gen-og: public/art/og.png written (1200×630)');
