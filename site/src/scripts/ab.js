/**
 * ab.js — the before/after comparison.
 *
 * Both files play at the same time, in sync, and only the GAIN changes when the
 * visitor switches. That is what makes the switch instant: if you stopped one
 * file and started the other you would get a gap and a restart, and the
 * comparison would be lost in the seam.
 *
 * The crossfade is 70 ms. Shorter clicks; longer and the two versions smear
 * into each other and you cannot tell which one you are hearing.
 */
const FADE_MS = 70;
const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function init() {
  document.querySelectorAll('[data-ab]').forEach(setup);
}

function setup(root) {
  if (root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const srcs = { raw: root.dataset.raw, mixed: root.dataset.mixed };
  const peaks = JSON.parse(root.dataset.peaks || '{"raw":[],"mixed":[]}');
  const canvas = root.querySelector('[data-ab-wave]');
  const head = root.querySelector('[data-ab-head]');
  const playBtn = root.querySelector('[data-ab-play]');
  const playLabel = root.querySelector('[data-ab-playlabel]');
  const opts = [...root.querySelectorAll('[data-ab-side]')];

  // Created here rather than in the markup (two <audio> tags would be two
  // things for a screen reader to find), but ATTACHED to the component so the
  // pair is inspectable in dev tools and cleaned up with the rest of the page.
  const make = (src, volume) => {
    const a = Object.assign(new Audio(src), { preload: 'auto', loop: true, volume });
    a.setAttribute('data-ab-audio', '');
    a.hidden = true;
    root.appendChild(a);
    return a;
  };
  const el = { raw: make(srcs.raw, 1), mixed: make(srcs.mixed, 0) };
  let side = 'raw';
  let fading = 0;
  let raf = 0;

  /* --- Drawing ------------------------------------------------------------ */
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const SIGNAL = css.getPropertyValue('--signal').trim() || '#C1121F';
  // Bars are ink on paper: the inactive lane is a pale brown, not a pale white.
  const PLAYED = 'rgba(64,28,10,.55)';
  const DIM = 'rgba(64,28,10,.22)';

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  function paint(progress = 0) {
    const r = canvas.getBoundingClientRect();
    const w = r.width, h = r.height;
    ctx.clearRect(0, 0, w, h);
    const lanes = [
      { data: peaks.raw, y: h * 0.27, label: 'raw' },
      { data: peaks.mixed, y: h * 0.73, label: 'mixed' },
    ];
    for (const lane of lanes) {
      const n = lane.data.length;
      if (!n) continue;
      const bw = Math.max(1, w / n - 1);
      const active = lane.label === side;
      const maxH = h * 0.21;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * w;
        const v = lane.data[i];
        const bh = Math.max(1, v * maxH);
        const passed = x / w <= progress;
        ctx.fillStyle = active ? (passed ? SIGNAL : PLAYED) : DIM;
        ctx.globalAlpha = active ? 1 : 0.5;
        ctx.fillRect(x, lane.y - bh, bw, bh * 2);
      }
    }
    ctx.globalAlpha = 1;
    // Divider between the two lanes.
    ctx.fillStyle = 'rgba(64,28,10,.14)';
    ctx.fillRect(0, h / 2 - 0.5, w, 1);
  }

  function tick() {
    const a = el[side];
    const p = a.duration ? a.currentTime / a.duration : 0;
    paint(p);
    if (head) head.style.setProperty('--p', p);
    raf = a.paused ? 0 : requestAnimationFrame(tick);
  }

  /* --- Transport ----------------------------------------------------------- */
  function resync() {
    // Two independent audio elements drift by a few milliseconds over time.
    // Nudge the silent one back into line whenever we switch.
    const from = el[side];
    const other = side === 'raw' ? el.mixed : el.raw;
    if (Math.abs(other.currentTime - from.currentTime) > 0.06) {
      other.currentTime = from.currentTime;
    }
  }

  function crossfade(to) {
    cancelAnimationFrame(fading);
    const from = to === 'raw' ? 'mixed' : 'raw';
    resync();
    if (REDUCED()) {                       // no ramp: switch cleanly
      el[to].volume = 1; el[from].volume = 0;
      side = to; sync(); return;
    }
    const t0 = performance.now();
    const startTo = el[to].volume, startFrom = el[from].volume;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const step = (now) => {
      // `now` is the frame's start time, which can be EARLIER than the
      // performance.now() taken a moment ago — so progress must be clamped at
      // BOTH ends. Clamping only the top yields a negative volume, which throws
      // and leaves the fade stuck half way.
      const k = clamp((now - t0) / FADE_MS);
      el[to].volume = clamp(startTo + (1 - startTo) * k);
      el[from].volume = clamp(startFrom * (1 - k));
      if (k < 1) fading = requestAnimationFrame(step);
    };
    fading = requestAnimationFrame(step);
    side = to;
    sync();
  }

  function sync() {
    opts.forEach((o) => {
      const on = o.dataset.abSide === side;
      o.classList.toggle('is-on', on);
      o.setAttribute('aria-checked', String(on));
    });
    root.dataset.side = side;
    paint(el[side].duration ? el[side].currentTime / el[side].duration : 0);
  }

  async function play() {
    document.dispatchEvent(new CustomEvent('audio:claim', { detail: { by: root } }));
    try {
      await Promise.all([el.raw.play(), el.mixed.play()]);
      resync();
    } catch { return; }
    playBtn.setAttribute('aria-pressed', 'true');
    playLabel.textContent = 'Pause';
    root.classList.add('is-playing');
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function pause() {
    el.raw.pause(); el.mixed.pause();
    playBtn.setAttribute('aria-pressed', 'false');
    playLabel.textContent = 'Play both';
    root.classList.remove('is-playing');
    cancelAnimationFrame(raf); raf = 0;
  }

  playBtn.addEventListener('click', () => (el.raw.paused ? play() : pause()));
  opts.forEach((o) => o.addEventListener('click', () => {
    if (o.dataset.abSide !== side) crossfade(o.dataset.abSide);
  }));

  // Click the waveform to seek.
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    for (const k of ['raw', 'mixed']) {
      if (el[k].duration) el[k].currentTime = p * el[k].duration;
    }
    paint(p);
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (el.raw.paused) return;                        // only while this is playing
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); crossfade('raw'); }
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); crossfade('mixed'); }
  });

  // Only one source of sound on the page at a time.
  document.addEventListener('audio:claim', (e) => {
    if (e.detail?.by !== root && !el.raw.paused) pause();
  });

  // Stop when the visitor navigates away mid-comparison.
  document.addEventListener('astro:before-swap', pause, { once: true });

  window.addEventListener('resize', size, { passive: true });
  size();
  sync();
}

document.addEventListener('astro:page-load', init);
