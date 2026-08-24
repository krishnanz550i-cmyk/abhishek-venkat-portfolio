/**
 * contact.js — makes the enquiry form work with or without a form service.
 *
 * The site is a folder of static files: there is no server of ours to receive a
 * form. So there are two modes, and the page picks the right one by itself:
 *
 *  - An endpoint IS configured (Formspree, Netlify Forms, anything that accepts
 *    a POST): the form submits in the background and the visitor stays put.
 *  - No endpoint yet: pressing send opens the visitor's own email app with the
 *    message already written. Not as slick, but nothing is silently lost —
 *    which is what happens with a form wired to nowhere.
 */
function init() {
  const form = document.querySelector('[data-contact]');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  const status = form.querySelector('[data-contact-status]');
  const note = form.querySelector('[data-contact-note]');
  const endpoint = form.dataset.endpoint;
  const email = form.dataset.email;

  // Arriving from a "Enquire" button on the services page pre-selects it.
  const wanted = new URL(location.href).searchParams.get('service');
  if (wanted) {
    const select = form.querySelector('#service');
    if (select && [...select.options].some((o) => o.value === wanted)) select.value = wanted;
  }

  if (!endpoint) {
    if (note) {
      note.hidden = false;
      note.textContent = email
        ? 'This will open your email app with the message ready to send.'
        : 'The enquiry form is not connected yet — see the owner guide to switch it on.';
    }
  }

  form.addEventListener('submit', async (e) => {
    if (form.querySelector('[name="_gotcha"]')?.value) { e.preventDefault(); return; }
    const data = Object.fromEntries(new FormData(form));

    if (!endpoint) {
      e.preventDefault();
      if (!email) {
        status.textContent = 'No destination configured.';
        return;
      }
      const subject = `Enquiry${data.service ? ` — ${data.service}` : ''} from ${data.name || 'the website'}`;
      const body = [
        `Name: ${data.name || ''}`,
        `Email: ${data.email || ''}`,
        data.service ? `Service: ${data.service}` : '',
        '', data.message || '',
      ].filter(Boolean).join('\n');
      location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Opening your email app…';
      return;
    }

    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    status.textContent = 'Sending…';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.textContent = 'Sent. I will reply shortly.';
    } catch {
      // Never swallow it: tell them, and give them the address.
      status.textContent = email
        ? `Could not send — please email ${email} directly.`
        : 'Could not send. Please try again shortly.';
    } finally {
      btn.disabled = false;
    }
  });
}
document.addEventListener('astro:page-load', init);
