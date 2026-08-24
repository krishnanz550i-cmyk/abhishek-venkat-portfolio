# Abhishek Venkatasubramanian — portfolio site

The website for a Dubai-based audio engineer, producer and composer.

**Live at:** https://krishnanz550i-cmyk.github.io/abhishek-venkat-portfolio

## If you own this site, read this one file

**[HANDOVER.md](HANDOVER.md)** — written for you, not for a developer. How to
change anything on the site, add a project, put your own audio up, and turn on
the enquiry form. No software to install.

**[CONTENT-NEEDED.md](CONTENT-NEEDED.md)** — what is still outstanding, in
priority order.

## Changing the site

Everything you can see on the website comes from one file:
[`site/content/site.json`](site/content/site.json). Edit it here on GitHub, click
Commit, and the site republishes itself in about two minutes.

If you make a mistake in that file, nothing goes live and nothing is lost — the
publish stops and tells you which line, and the site already online stays exactly
as it is.

## For a developer

```bash
cd site
npm install
ALLOW_PLACEHOLDER=1 npm run dev      # local preview
ALLOW_PLACEHOLDER=1 npm run build    # content + contrast checks, build, build check
node test/smoke.mjs                  # browser checks against dist/
SITE_BASE=/abhishek-venkat-portfolio/ node test/base.mjs   # checks it under the published sub-path
```

Static Astro build: 29 pre-rendered pages, no server, no database, no runtime
keys, nothing fetched from a third party at page load. Publishing is
`.github/workflows/publish.yml`, which switches GitHub Pages on by itself the
first time it runs.
