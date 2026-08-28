/**
 * build-single.mjs — packs the whole built site into ONE self-contained HTML file.
 *
 * WHY. Sending a client a folder of files is not a way to show them their site.
 * This produces a single page that can be hosted anywhere, opened from a phone,
 * and works with no network at all: fonts, artwork and audio are embedded in the
 * file itself.
 *
 * HOW IT KEEPS WORKING. The real site uses Astro's client router to move between
 * pages while the audio keeps playing. There is no server here to fetch the next
 * page from, so this file carries every page's content inside it and swaps them
 * in place, firing the same `astro:page-load` / `astro:before-swap` events the
 * behaviour scripts already listen for. Nothing in src/ is written differently
 * for this; the events are the seam that was already there.
 *
 * This is a REVIEW artifact, not the thing that gets published. The real site
 * ships as separate pages, which is what search engines need.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const content = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));

const read = (p) => readFileSync(join(DIST, p), 'utf8');
const grab = (html, re, what) => {
  const m = html.match(re);
  if (!m) throw new Error(`Could not find ${what} in the built HTML`);
  return m[1];
};

/* --- Pages ---------------------------------------------------------------- */
const ROUTES = [
  ['/', 'index.html'],
  ['/work', 'work/index.html'],
  ['/about', 'about/index.html'],
  ['/services', 'services/index.html'],
  ['/contact', 'contact/index.html'],
  ...content.works.map((w) => [`/work/${w.slug}`, `work/${w.slug}/index.html`]),
];

const home = read('index.html');

// Shared chrome: everything before <main> and everything after </main>.
const mainOpen = home.match(/<main[^>]*>/);
const bodyStart = home.indexOf('<body>') + '<body>'.length;
const prefix = home.slice(bodyStart, home.indexOf(mainOpen[0]));
const suffix = home.slice(home.indexOf('</main>') + '</main>'.length, home.indexOf('</body>'));

const pages = {};
for (const [route, file] of ROUTES) {
  const html = read(file);
  const inner = html.slice(
    html.indexOf(html.match(/<main[^>]*>/)[0]) + html.match(/<main[^>]*>/)[0].length,
    html.indexOf('</main>')
  );
  pages[route] = {
    html: inner,
    title: grab(html, /<title>([^<]*)<\/title>/, 'a title'),
  };
}

/* --- Assets become part of the file --------------------------------------- */
const MIME = { '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const embedded = [];
function dataUri(publicPath) {
  const file = join(DIST, publicPath.replace(/^\//, ''));
  if (!existsSync(file)) throw new Error(`Asset referenced but missing: ${publicPath}`);
  const buf = readFileSync(file);
  embedded.push([publicPath, buf.length]);
  return `data:${MIME[extname(file)] || 'application/octet-stream'};base64,${buf.toString('base64')}`;
}

let css = read('assets/' + grab(home, /href="\/assets\/(Base\.[^"]+\.css)"/, 'the stylesheet'));
for (const font of ['/fonts/archivo-latin-var.woff2', '/fonts/inter-latin-var.woff2']) {
  css = css.replaceAll(font, dataUri(font));
}

const js = read('assets/' + grab(home, /src="\/assets\/(Base\.astro[^"]+\.js)"/, 'the behaviour bundle'));


/* --- Make the output pure ASCII -------------------------------------------
   A single file has no HTTP header to declare its encoding, and if the client
   saves it and opens it from their desktop there is no server at all. Anything
   non-ASCII then renders as mojibake ("Composer A. Producer"). Escaping every
   non-ASCII character in the form its context understands means the encoding
   simply cannot matter. The `u` flag makes the class match whole code points,
   so characters outside the basic plane are not split in half. */
const NON_ASCII = /[^\x00-\x7F]/gu;
const cp = (c) => c.codePointAt(0).toString(16);
const asciiHtml = (s) => s.replace(NON_ASCII, (c) => `&#x${cp(c)};`);
const asciiJs = (s) => s.replace(NON_ASCII, (c) => {
  const n = c.codePointAt(0);
  return n > 0xFFFF ? `\\u{${cp(c)}}` : `\\u${cp(c).padStart(4, '0')}`;
});
// CSS escapes consume up to six hex digits, so always emit six: no ambiguity
// about where the escape ends and the next character begins.
const asciiCss = (s) => s.replace(NON_ASCII, (c) => `\\${cp(c).padStart(6, '0')}`);

// A <script type="application/json"> block is NOT parsed as HTML, so an HTML
// entity inside it is never decoded - it reaches the page as the literal text
// "&#x2014;". Escape those blocks the way JSON understands BEFORE the HTML pass,
// which then finds nothing left to do there.
const escapeJsonScripts = (html) => html.replace(
  /(<script[^>]*type="application\/json"[^>]*>)([\s\S]*?)(<\/script>)/g,
  (_, open, body, close) => open + asciiJs(body) + close,
);

/* --- Compose -------------------------------------------------------------- */
let doc = [prefix, '<main id="main"></main>', suffix].join('\n');
let pagesJson = JSON.stringify(pages);

// Swap every remaining asset reference, in the chrome and inside every page.
const assetRefs = new Set();
for (const src of [doc, pagesJson]) {
  for (const m of src.matchAll(/"(\/(?:art|audio|img|fonts)\/[^"\\]+)"/g)) assetRefs.add(m[1]);
  for (const m of src.matchAll(/\\"(\/(?:art|audio|img|fonts)\/[^"\\]+)\\"/g)) assetRefs.add(m[1]);
}
for (const ref of assetRefs) {
  if (ref === '/art/og.png') continue;             // only used in meta tags we drop
  const uri = dataUri(ref);
  doc = doc.replaceAll(ref, uri);
  pagesJson = pagesJson.replaceAll(ref, uri);
}

const router = `
/* Router. The site normally fetches the next page; here every page is already
   in this file, so we swap the content and fire the same events the behaviour
   scripts listen for. That is why the player keeps playing across a "page
   change" in this file exactly as it does on the real site. */
(() => {
  const PAGES = ${pagesJson};
  const main = document.getElementById('main');
  const clean = (p) => { p = (p || '/').split('?')[0]; return p.length > 1 ? p.replace(/\\/$/, '') : '/'; };

  function paint(path) {
    const page = PAGES[path] || PAGES['/'];
    document.dispatchEvent(new Event('astro:before-swap'));
    main.innerHTML = page.html;
    document.title = page.title;
    document.querySelectorAll('.nav__link').forEach((a) => {
      const href = clean(a.getAttribute('href'));
      const on = href === path || (href !== '/' && path.startsWith(href));
      a.classList.toggle('is-on', on);
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    document.dispatchEvent(new Event('astro:page-load'));
  }

  function go(path, push = true) {
    path = clean(path);
    if (push) { try { location.hash = '#' + path; return; } catch {} }
    paint(path);
  }

  addEventListener('hashchange', () => paint(clean(location.hash.slice(1)) || '/'));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/"]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });

  paint(clean(location.hash.slice(1)) || '/');
})();
`;

// A quiet, dismissible note. A draft shared with a client should say it is one.
const draftNote = `
<div class="draft-note" id="draft-note">
  <span class="draft-note__dot" aria-hidden="true"></span>
  <span><strong>Draft preview.</strong> The audio and the prices are placeholders — everything here can change.</span>
  <button type="button" class="draft-note__x" aria-label="Dismiss">&times;</button>
</div>
<style>
.draft-note {
  /* Top right, under the header: the bottom of the screen belongs to the
     player, and the middle belongs to the buttons this note was covering. */
  position: fixed; z-index: 88; top: 4.9rem; right: var(--gutter); left: var(--gutter);
  display: flex; align-items: flex-start; gap: .7rem;
  max-width: 23rem; margin-left: auto;
  padding: .7rem 1rem;
  background: color-mix(in srgb, var(--panel-2) 94%, transparent);
  backdrop-filter: blur(12px);
  border: 1px solid color-mix(in srgb, var(--meter-warn) 40%, transparent);
  border-radius: var(--radius);
  font-size: var(--t-xs); color: var(--text-2); line-height: 1.45;
}
.draft-note strong { color: var(--meter-warn); }
.draft-note__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--meter-warn); flex: none; margin-top: .45rem; }
@media (max-width: 640px) { .draft-note { max-width: none; margin-left: 0; } }
.draft-note__x { margin-left: auto; background: none; border: 0; color: var(--text-3); font-size: 1.2rem; line-height: 1; cursor: pointer; padding: 0 .2rem; }
.draft-note__x:hover { color: var(--text); }
.draft-note[hidden] { display: none; }
</style>
<script>
(() => {
  const note = document.getElementById('draft-note');
  // Remember the dismissal, so someone coming back to the link is not told the
  // same thing twice. Storage can be unavailable (private windows, previews),
  // in which case the note simply shows again - which is harmless.
  try { if (localStorage.getItem('draft-note-dismissed') === '1') note.hidden = true; } catch {}
  note.querySelector('.draft-note__x').addEventListener('click', () => {
    note.hidden = true;
    try { localStorage.setItem('draft-note-dismissed', '1'); } catch {}
  });
})();
</script>
`;

const out = [
  `<title>${asciiHtml(content.identity.name)}</title>`,
  `<style>${asciiCss(css)}</style>`,
  asciiHtml(escapeJsonScripts(doc)),
  asciiHtml(draftNote),
  `<script type="module">${asciiJs(js)}</script>`,
  `<script type="module">${asciiJs(router)}</script>`,
].join('\n');

const stray = out.match(NON_ASCII);
if (stray) throw new Error(`Output is not pure ASCII - found ${stray.length} stray characters, first is U+${cp(stray[0])}`);

// dist-single/ is not committed, so on a fresh clone it does not exist yet.
const target = join(ROOT, 'dist-single', 'preview.html');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, out, { flag: 'w' });

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`\n  Packed ${Object.keys(pages).length} pages into one file.`);
console.log(`  Embedded ${embedded.length} assets:`);
const byKind = {};
for (const [p, size] of embedded) {
  const kind = p.split('/')[1];
  byKind[kind] = (byKind[kind] || 0) + size;
}
for (const [k, v] of Object.entries(byKind)) console.log(`    ${k.padEnd(6)} ${kb(v)}`);
console.log(`  CSS ${kb(css.length)} · JS ${kb(js.length)}`);
console.log(`  Total: ${(Buffer.byteLength(out) / 1024 / 1024).toFixed(2)} MB (limit 16 MB)\n`);
