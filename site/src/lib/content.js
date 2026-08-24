/**
 * content.js — the one place the site reads its content from.
 *
 * Every page imports from here rather than reaching into the JSON directly, so
 * if the shape of content/site.json ever changes there is a single file to fix.
 * The helpers below also mean pages never contain a hard-coded project name.
 */
import raw from '../../content/site.json';

export const site = raw;
export const { meta, identity, hero, about, experience, education, skills, softSkills, works, services, process, faq, social, contact, workFilters } = raw;

/**
 * Prefix an internal path with wherever the site is published.
 *
 * A site published at the root of a domain serves /work; the same site
 * published as a GitHub Pages project serves /repo-name/work. Writing "/work"
 * by hand works in the first case and 404s in the second, so every internal
 * path in this project goes through here. External links, mail and phone links,
 * data URIs and plain anchors are returned untouched.
 */
const BASE = import.meta.env.BASE_URL || '/';
export const url = (p) => {
  if (typeof p !== 'string' || p === '') return p;
  if (/^([a-z]+:|\/\/|#|\?)/i.test(p)) return p;
  // Split before any ?query or #anchor so only the path part gets prefixed.
  const [path, ...rest] = p.split(/(?=[?#])/);
  const prefix = BASE.replace(/\/$/, '');
  // Idempotent on purpose: Astro already includes the base in Astro.url.pathname,
  // so a value that has been through here once must survive a second pass
  // unchanged rather than becoming /repo/repo/work.
  if (prefix && (path === prefix || path.startsWith(prefix + '/'))) return p;
  return prefix + '/' + path.replace(/^\//, '') + rest.join('');
};

/** A value the owner has not filled in yet. Those are hidden from the public
 *  site rather than published half-finished. */
export const PENDING = 'NEEDS-CONFIRMATION';
export const isPending = (v) => typeof v === 'string' && v.startsWith(PENDING);
export const clean = (v) => (isPending(v) || v === '' || v == null ? null : v);

/** Only projects the owner has marked as worth leading with. */
export const featured = works.filter((w) => w.featured);

/** Cover image for a project: a real photo if one has been added, otherwise the
 *  generated artwork. Checked at build time by check-content.mjs. */
export const coverFor = (w) => url(w.cover || `/art/${w.slug}.svg`);

/**
 * Is this file actually present in public/? Photographs are supplied by the
 * owner over time, so the pages that use them check first and lay themselves
 * out accordingly rather than leaving a broken image.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const hasAsset = (p) => {
  if (!p || isPending(p)) return false;
  try {
    return existsSync(fileURLToPath(new URL('../../public' + p.replace(/^\/?/, '/'), import.meta.url)));
  } catch { return false; }
};

/** Group projects for the work page. */
export const byKind = (kind) => works.filter((w) => w.kind === kind);
export const byCollection = (id) => works.filter((w) => w.collection === id);

/** The roles that actually appear in the catalogue, for the filter bar —
 *  derived rather than typed out, so it can never fall out of step. */
export const allRoles = [...new Set(works.flatMap((w) => w.roles || []))].sort();

/** Human label for a kind/collection id. */
export const kindLabel = (id) => workFilters.kinds.find((k) => k.id === id)?.label || id;
export const collectionLabel = (id) => workFilters.collections.find((c) => c.id === id)?.label || id;

/** Social links that have a real URL behind them. */
export const liveSocial = social.filter((s) => clean(s.url));

/** Years active, computed so it never goes stale. */
export const yearsActive = new Date().getFullYear() - identity.yearsFrom;

/** Absolute URL for share cards and canonical tags. */
export const abs = (path) => new URL(path, meta.siteUrl).href;

/** Structured data. This is what makes a name, a job title and a catalogue of
 *  work legible to Google and to any AI assistant asked "who mixed this?".
 *  It is the single highest-leverage SEO item on a portfolio. */
export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: identity.name,
    alternateName: identity.shortName,
    jobTitle: identity.roles,
    description: about.lead,
    url: meta.siteUrl,
    ...(clean(contact.email) ? { email: `mailto:${contact.email}` } : {}),
    ...((contact.phones || []).some((p) => clean(p.number))
      ? { telephone: contact.phones.filter((p) => clean(p.number)).map((p) => p.number) }
      : {}),
    address: { '@type': 'PostalAddress', addressLocality: identity.location },
    sameAs: liveSocial.map((s) => s.url),
    alumniOf: education.map((e) => ({ '@type': 'EducationalOrganization', name: e.org })),
    knowsAbout: skills.map((s) => s.name),
    worksFor: { '@type': 'Organization', name: identity.name },
  };
}

export function workSchema(w) {
  const isScreen = w.kind === 'screen';
  return {
    '@context': 'https://schema.org',
    '@type': isScreen ? 'CreativeWork' : 'MusicRecording',
    name: [w.title, w.subtitle].filter(Boolean).join(' — '),
    description: w.summary,
    url: abs(url(`/work/${w.slug}`)),
    image: abs(coverFor(w)),
    ...(w.links?.length ? { sameAs: w.links.map((l) => l.url) } : {}),
    contributor: {
      '@type': 'Person', name: identity.name, url: meta.siteUrl,
      roleName: (w.roles || []).join(', '),
    },
  };
}

export function breadcrumbSchema(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.label, item: abs(url(t.href)),
    })),
  };
}
