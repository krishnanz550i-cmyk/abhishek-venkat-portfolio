import { defineConfig } from 'astro/config';

/**
 * Audio-engineer portfolio — build configuration.
 *
 * Static output only: every page is pre-rendered to plain HTML at build time.
 * That means no server to pay for, no database, no API keys, and nothing that
 * can break at 3am. The whole site is a folder of files any host can serve.
 *
 * `site` must match the final public address — it is used for the sitemap,
 * canonical URLs and social-share cards. Change it in ONE place: content/site.json
 * (meta.siteUrl); this file reads it from there so the two can never disagree.
 */
import { readFileSync } from 'node:fs';

const content = JSON.parse(readFileSync(new URL('./content/site.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: content.meta.siteUrl,
  base: process.env.SITE_BASE || '/',
  output: 'static',
  trailingSlash: 'ignore',
  build: { assets: 'assets', format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
