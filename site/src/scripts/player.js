/**
 * player.js — the audio player docked at the bottom of the site.
 *
 * Two things make it worth the code:
 *
 * 1. IT KEEPS PLAYING. The player element is marked transition:persist, so when
 *    a visitor navigates the element is carried across instead of rebuilt.
 *    This module therefore has to be idempotent: it binds ONCE, and every later
 *    page load finds the flag and leaves the running player alone.
 *
 * 2. THE BARS ARE REAL. The visualiser reads the actual frequency content of
 *    the playing audio through a Web Audio analyser. It is not a looping
 *    animation pretending to be one, which on a sound engineer's site would be
 *    the wrong kind of joke.
 *
 * Autoplay is never attempted: browsers block it, and a portfolio that starts
 * making noise at a stranger is a portfolio they close.
 */

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function init() {
  const root = document.querySelector('[data-player]');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const audio = root.querySelector('[data-audio]');
  const queue = JSON.parse(root.querySelector('[data-queue-data]').textContent);
  const $ = (sel) => root.querySelector(sel);

  const els = {
    play: $('[data-play]'), prev: $('[data-prev]'), next: $('[data-next]'),
    mute: $('[data-mute]'), seek: $('[data-seek]'), now: $('[data-now]'),
    dur: $('[data-dur]'), title: $('[data-title]'), subText: $('[data-sub-text]'),
    demoChip: $('[data-demo-chip]'), vis: $('[data-vis]'),
    queueToggle: $('[data-queue-toggle]'), queueList: $('[data-queue]'),
  };

  let index = 0;
  let seeking = false;
  let audioCtx = null, analyser = null, freq = null, raf = 0;

  /* --- Restore where the visitor was, if they have been here already ------ */
  try {
    const saved = JSON.parse(sessionStorage.getItem('player') || 'null');
    if (saved && Number.isInteger(saved.i) && queue[saved.i]) {
      index = saved.i;
      load(index, false);
      if (saved.t > 0) audio.currentTime = saved.t;
    } else load(0, false);
  } catch { load(0, false); }

  const save = () => {
    try { sessionStorage.setItem('player', JSON.stringify({ i: index, t: audio.currentTime })); } catch {}
  };

  /* --- Track loading ------------------------------------------------------ */
  function load(i, autoplay = true) {
    index = (i + queue.length) % queue.length;
    const t = queue[index];
    audio.src = t.src;
    audio.preload = 'metadata';
    els.title.textContent = t.title;
    els.subText.textContent = t.subtitle;
    if (els.demoChip) els.demoChip.hidden = !t.isDemo;
    root.querySelectorAll('[data-track]').forEach((b) => {
      b.classList.toggle('is-on', Number(b.dataset.track) === index);
    });
    els.seek.value = 0;
    els.now.textContent = '0:00';
    updateMediaSession(t);
    if (autoplay) play();
  }

  /* --- Web Audio graph ----------------------------------------------------
     Built lazily on first play: an AudioContext created before a user gesture
     starts suspended, and some browsers count that against you. */
  function ensureGraph() {
    if (audioCtx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try {
      audioCtx = new Ctx();
      const src = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
      // Published so other parts of the page (the hero background) can react to
      // what is actually playing rather than animating on a timer.
      window.__audioAnalyser = { analyser, freq, isPlaying: () => !audio.paused };
      return true;
    } catch {
      // If the graph cannot be built the player still plays; it just draws a
      // flat line. Losing the decoration must never cost the audio.
      audioCtx = null; analyser = null;
      return false;
    }
  }

  async function play() {
    ensureGraph();
    if (audioCtx?.state === 'suspended') { try { await audioCtx.resume(); } catch {} }
    try { await audio.play(); } catch { /* blocked or interrupted — leave paused */ }
  }

  /* --- Visualiser ---------------------------------------------------------- */
  const ctx2d = els.vis.getContext('2d');
  function sizeCanvas() {
    const r = els.vis.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.vis.width = Math.max(1, Math.round(r.width * dpr));
    els.vis.height = Math.max(1, Math.round(r.height * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas, { passive: true });

  const css = getComputedStyle(document.documentElement);
  const COL = {
    ok: css.getPropertyValue('--meter-ok').trim() || '#3BE08A',
    warn: css.getPropertyValue('--meter-warn').trim() || '#FFB020',
    peak: css.getPropertyValue('--meter-peak').trim() || '#FF3B30',
    idle: 'rgba(255,255,255,.16)',
  };

  function draw() {
    const r = els.vis.getBoundingClientRect();
    const w = r.width, h = r.height;
    ctx2d.clearRect(0, 0, w, h);

    if (!analyser || audio.paused) {
      // Idle: a flat line, the way a meter reads with no signal.
      ctx2d.fillStyle = COL.idle;
      ctx2d.fillRect(0, h / 2 - 0.5, w, 1);
      raf = 0;
      return;
    }

    analyser.getByteFrequencyData(freq);
    const bars = Math.max(18, Math.min(48, Math.floor(w / 7)));
    const gap = 2;
    const bw = (w - gap * (bars - 1)) / bars;
    // Only the lower ~70% of the bins carry anything visible for music, so the
    // spread is compressed into that range rather than wasting half the canvas.
    const usable = Math.floor(freq.length * 0.7);
    for (let i = 0; i < bars; i++) {
      const from = Math.floor((i / bars) * usable);
      const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * usable));
      let sum = 0;
      for (let k = from; k < to; k++) sum += freq[k];
      const v = (sum / (to - from)) / 255;
      const bh = Math.max(2, Math.pow(v, 1.35) * h);
      // Meter colours mean what they mean: green safe, amber loud, red peaking.
      ctx2d.fillStyle = v > 0.86 ? COL.peak : v > 0.62 ? COL.warn : COL.ok;
      ctx2d.globalAlpha = 0.35 + v * 0.65;
      ctx2d.fillRect(i * (bw + gap), (h - bh) / 2, bw, bh);
    }
    ctx2d.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }
  function startDraw() { if (!raf) raf = requestAnimationFrame(draw); }
  function stopDraw() { if (raf) cancelAnimationFrame(raf); raf = 0; draw(); }

  /* --- Wiring -------------------------------------------------------------- */
  els.play.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
  els.next.addEventListener('click', () => load(index + 1));
  els.prev.addEventListener('click', () => {
    // Standard behaviour: restart the track unless you are near the start.
    if (audio.currentTime > 3) audio.currentTime = 0; else load(index - 1);
  });
  els.mute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    els.mute.setAttribute('aria-pressed', String(audio.muted));
    els.mute.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
    root.classList.toggle('is-muted', audio.muted);
  });

  els.queueToggle.addEventListener('click', () => {
    const open = els.queueList.hidden;
    els.queueList.hidden = !open;
    els.queueToggle.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
  });
  root.querySelectorAll('[data-track]').forEach((b) => {
    b.addEventListener('click', () => load(Number(b.dataset.track)));
  });

  els.seek.addEventListener('input', () => {
    seeking = true;
    if (audio.duration) els.now.textContent = fmt((els.seek.value / 1000) * audio.duration);
  });
  const commitSeek = () => {
    if (audio.duration) audio.currentTime = (els.seek.value / 1000) * audio.duration;
    seeking = false;
  };
  els.seek.addEventListener('change', commitSeek);

  audio.addEventListener('play', () => {
    root.classList.add('is-playing');
    els.play.setAttribute('aria-pressed', 'true');
    els.play.setAttribute('aria-label', 'Pause');
    startDraw();
    // Only one thing makes sound at a time: an A/B comparison elsewhere on the
    // page stops this player, and starting this player stops that one.
    document.dispatchEvent(new CustomEvent('audio:claim', { detail: { by: 'player' } }));
  });
  audio.addEventListener('pause', () => {
    root.classList.remove('is-playing');
    els.play.setAttribute('aria-pressed', 'false');
    els.play.setAttribute('aria-label', 'Play');
    stopDraw();
    save();
  });
  audio.addEventListener('timeupdate', () => {
    if (seeking || !audio.duration) return;
    els.seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
    els.now.textContent = fmt(audio.currentTime);
    els.seek.setAttribute('aria-valuetext', `${fmt(audio.currentTime)} of ${fmt(audio.duration)}`);
  });
  audio.addEventListener('loadedmetadata', () => { els.dur.textContent = fmt(audio.duration); });
  audio.addEventListener('ended', () => load(index + 1));
  audio.addEventListener('error', () => {
    els.subText.textContent = 'Track unavailable';
    root.classList.remove('is-playing');
  });

  document.addEventListener('audio:claim', (e) => {
    if (e.detail?.by !== 'player' && !audio.paused) audio.pause();
  });

  // Anything on the site can ask the player to play a specific file.
  document.addEventListener('player:play', (e) => {
    const { src, title, subtitle } = e.detail || {};
    if (!src) return;
    const found = queue.findIndex((q) => q.src === src);
    if (found >= 0) return load(found);
    queue.push({ src, title: title || 'Selection', subtitle: subtitle || '', isDemo: false });
    load(queue.length - 1);
  });

  /* --- Keyboard: space toggles, arrows seek, but only when the visitor is not
         typing and not on another control. ---------------------------------- */
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag) || e.target.isContentEditable) return;
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? play() : audio.pause(); }
    else if (e.code === 'ArrowRight' && e.shiftKey) { e.preventDefault(); audio.currentTime += 5; }
    else if (e.code === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); audio.currentTime -= 5; }
  });

  /* --- Lock-screen / headphone controls ----------------------------------- */
  function updateMediaSession(t) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: document.title.split('—').pop().trim(), album: 'Portfolio',
      // Resolved against the page, so it works under any publish path.
      artwork: [{ src: new URL('art/og.png', document.baseURI).href, sizes: '1200x630', type: 'image/png' }],
    });
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('nexttrack', () => load(index + 1));
    navigator.mediaSession.setActionHandler('previoustrack', () => load(index - 1));
  }

  window.addEventListener('pagehide', save);
  setInterval(() => { if (!audio.paused) save(); }, 4000);
  draw();
}

document.addEventListener('astro:page-load', init);
