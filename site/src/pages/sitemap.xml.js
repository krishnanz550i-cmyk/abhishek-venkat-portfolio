/** The map search engines read to find every page. Generated from the same
 *  content the pages are, so it can never list a page that does not exist. */
import { works, abs, url } from '../lib/content.js';

export function GET() {
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/work', priority: '0.9' },
    { loc: '/about', priority: '0.8' },
    { loc: '/services', priority: '0.8' },
    { loc: '/contact', priority: '0.7' },
    ...works.map((w) => ({ loc: `/work/${w.slug}`, priority: '0.6' })),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${abs(url(u.loc))}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
