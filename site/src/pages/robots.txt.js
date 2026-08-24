import { abs } from '../lib/content.js';
export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
