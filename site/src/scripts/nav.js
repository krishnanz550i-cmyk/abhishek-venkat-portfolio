/**
 * nav.js — header behaviour: the mobile menu, and hiding the bar while the
 * visitor is reading downward.
 */
function init() {
  const header = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');

  if (toggle && menu && toggle.dataset.bound !== '1') {
    toggle.dataset.bound = '1';
    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      document.documentElement.classList.toggle('menu-open', open);
      if (open) menu.querySelector('a')?.focus();
    };
    toggle.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('astro:before-swap', () => setOpen(false));
  }

  if (header && header.dataset.scrollBound !== '1') {
    header.dataset.scrollBound = '1';
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        header.classList.toggle('is-stuck', y > 24);
        // Hide going down, show going up — but never while a menu is open and
        // never in the first screenful, where hiding feels like a glitch.
        const hide = y > last && y > 320 && !document.documentElement.classList.contains('menu-open');
        header.classList.toggle('is-hidden', hide);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}
document.addEventListener('astro:page-load', init);
