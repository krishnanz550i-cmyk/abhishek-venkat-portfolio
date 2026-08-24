/**
 * pointer.js — two small pieces of pointer polish.
 *
 * Both are switched off entirely for touch screens (there is no cursor to
 * decorate) and for anyone who has asked for reduced motion. Neither carries
 * information, so losing them costs nothing.
 */
function init() {
  const fine = window.matchMedia('(pointer: fine)').matches;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || still) return;

  /* --- 1. A ring that trails the cursor and grows over anything clickable. */
  if (!document.querySelector('.cursor')) {
    const ring = document.createElement('div');
    ring.className = 'cursor';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);

    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
    addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      ring.classList.add('is-live');   // only appears once there is a pointer to follow
      if (!raf) raf = requestAnimationFrame(loop);
      const over = e.target.closest('a, button, [role="radio"], input, .card');
      ring.classList.toggle('is-over', !!over);
    }, { passive: true });

    function loop() {
      // Ease toward the pointer rather than snapping: the lag is what makes it
      // read as a physical object instead of a second cursor.
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      raf = (Math.abs(x - rx) > 0.3 || Math.abs(y - ry) > 0.3) ? requestAnimationFrame(loop) : 0;
    }
    addEventListener('pointerleave', () => ring.classList.add('is-gone'));
    addEventListener('pointerenter', () => ring.classList.remove('is-gone'));
  }

  /* --- 2. Magnetic buttons: primary calls-to-action lean toward the cursor. */
  document.querySelectorAll('[data-magnetic]:not([data-bound])').forEach((el) => {
    el.dataset.bound = '1';
    const strength = Number(el.dataset.magnetic) || 0.28;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}
document.addEventListener('astro:page-load', init);
