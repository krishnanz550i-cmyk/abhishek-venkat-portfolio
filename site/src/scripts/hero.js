/**
 * hero.js — the moving field behind the hero headline.
 *
 * It draws a set of horizontal lines that ripple. When the site's player is
 * actually playing, the ripple is driven by the real frequency content of the
 * track; when nothing is playing it drifts slowly on its own. That connection
 * is the point: the background of an audio engineer's site should be doing
 * something with the audio rather than looping a stock animation.
 *
 * Costs nothing when off screen (IntersectionObserver pauses it) and does not
 * run at all for visitors who asked for reduced motion.
 */
function init() {
  const canvas = document.querySelector('[data-hero]');
  if (!canvas || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const SIGNAL = read('--signal', '#C1121F');
  const GOLD = read('--gold', '#9A6B0F');
  // The field is ink on paper, so the quiet lines are a transparent brown-black
  // rather than a transparent white — white would simply disappear.
  const INK_RGB = '64,28,10';

  let w = 0, h = 0, raf = 0, visible = true, t = 0;

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Average energy of the playing track, 0..1. Zero when nothing plays. */
  function level() {
    const a = window.__audioAnalyser;
    if (!a?.analyser || !a.isPlaying?.()) return 0;
    a.analyser.getByteFrequencyData(a.freq);
    let sum = 0;
    const n = Math.floor(a.freq.length * 0.6);
    for (let i = 0; i < n; i++) sum += a.freq[i];
    return Math.min(1, (sum / n) / 190);
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const energy = level();
    const LINES = w < 640 ? 16 : 28;
    t += still ? 0 : 0.004 + energy * 0.012;

    for (let i = 0; i < LINES; i++) {
      const p = i / (LINES - 1);
      const y = h * (0.12 + p * 0.78);
      // Lines nearer the middle move most, so the field has a focal point.
      const centreness = 1 - Math.abs(p - 0.5) * 2;
      const amp = (10 + centreness * 46) * (0.35 + energy * 1.15);
      const freq1 = 1.1 + p * 1.7;
      const freq2 = 2.3 - p * 0.9;

      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const u = x / w;
        const yy = y
          + Math.sin(u * Math.PI * freq1 + t * 2.1 + i * 0.35) * amp * 0.66
          + Math.sin(u * Math.PI * freq2 - t * 1.4 + i * 0.2) * amp * 0.34;
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      const near = 0.09 + centreness * 0.30 + energy * 0.34;
      // Every seventh line is inked in red and every eleventh in gold, so the
      // field reads as a two-colour print rather than a wash.
      ctx.strokeStyle = i % 7 === 3
        ? `color-mix(in srgb, ${SIGNAL} ${Math.round(near * 90)}%, transparent)`
        : i % 11 === 5
          ? `color-mix(in srgb, ${GOLD} ${Math.round(near * 85)}%, transparent)`
          : `rgba(${INK_RGB},${(near * 0.42).toFixed(3)})`;
      ctx.lineWidth = 1 + centreness * 0.8;
      ctx.stroke();
    }
    raf = visible ? requestAnimationFrame(frame) : 0;
  }

  size();
  window.addEventListener('resize', size, { passive: true });

  if (still) { frame(); return; }              // draw one static frame and stop

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }, { threshold: 0 });
  io.observe(canvas);

  document.addEventListener('astro:before-swap', () => {
    visible = false; cancelAnimationFrame(raf); io.disconnect();
  }, { once: true });

  raf = requestAnimationFrame(frame);
}
document.addEventListener('astro:page-load', init);
