/**
 * reveal.js — fades sections in as they scroll into view.
 *
 * Uses IntersectionObserver rather than scroll listeners, so the browser does
 * the work off the main thread and long pages stay smooth. Elements are
 * revealed ONCE and then unobserved: re-animating on the way back up looks
 * nervous and costs work for nothing.
 */
function init() {
  const items = document.querySelectorAll('[data-reveal]:not(.is-in)');
  if (!items.length) return;

  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  items.forEach((el, i) => {
    // Children of a group stagger; standalone elements do not wait.
    if (el.dataset.reveal === 'stagger') {
      [...el.children].forEach((child, k) => {
        child.setAttribute('data-reveal', '');
        child.style.setProperty('--reveal-delay', `${Math.min(k * 60, 420)}ms`);
        io.observe(child);
      });
      el.classList.add('is-in');
    } else {
      io.observe(el);
    }
  });
}
document.addEventListener('astro:page-load', init);
