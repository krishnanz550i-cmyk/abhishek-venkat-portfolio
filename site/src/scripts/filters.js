/**
 * filters.js — the filter bar on the work page.
 *
 * Filtering happens in the browser against markup that is ALREADY in the page,
 * so every project is in the HTML for search engines and for anyone with
 * JavaScript switched off. The filters are an enhancement, never the source.
 *
 * The chosen filter is written to the URL, so a filtered view can be shared or
 * bookmarked and the back button behaves.
 */
function init() {
  const grid = document.querySelector('[data-work-grid]');
  if (!grid || grid.dataset.bound === '1') return;
  grid.dataset.bound = '1';

  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...grid.querySelectorAll('[data-tags]')];
  const count = document.querySelector('[data-work-count]');
  const empty = document.querySelector('[data-work-empty]');

  function apply(value, push = true) {
    let shown = 0;
    for (const card of cards) {
      const tags = card.dataset.tags.split(' ');
      const on = value === 'all' || tags.includes(value);
      card.hidden = !on;
      if (on) {
        card.style.setProperty('--reveal-delay', `${Math.min(shown * 40, 320)}ms`);
        shown++;
      }
    }
    buttons.forEach((b) => {
      const on = b.dataset.filter === value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    if (count) count.textContent = String(shown);
    if (empty) empty.hidden = shown > 0;

    if (push) {
      // Some embedding contexts (a sandboxed frame, for one) refuse pushState.
      // Losing a shareable URL is acceptable; losing the filter is not.
      try {
        const url = new URL(location.href);
        if (value === 'all') url.searchParams.delete('filter');
        else url.searchParams.set('filter', value);
        history.pushState({ filter: value }, '', url);
      } catch { /* filtering still works, the URL just does not update */ }
    }
  }

  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter)));
  window.addEventListener('popstate', () => {
    apply(new URL(location.href).searchParams.get('filter') || 'all', false);
  });

  apply(new URL(location.href).searchParams.get('filter') || 'all', false);
}
document.addEventListener('astro:page-load', init);
