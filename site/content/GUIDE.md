# Field reference for `site.json`

Every setting on the website, and what happens when you change it. If you only
read one thing, read the rule at the bottom.

---

## `meta` — how the site appears in Google and in shared links

| Field | What it does |
|---|---|
| `siteUrl` | Your real web address. Decides the sitemap and share links. Must match your actual domain or links break when shared. |
| `title` | The browser tab and the Google result heading for the home page. |
| `description` | The grey text under your name in a Google result. Around 150 characters is right. |
| `themeColor` | The colour of the browser bar on a phone. |

## `identity` — who you are

| Field | What it does |
|---|---|
| `name` | Used everywhere, including the copyright line and the structured data Google reads. |
| `shortName` | Shown in the header on narrow phones, where the full name would not fit. |
| `initials` | The two letters in the small box in the header, and the favicon. |
| `roles` | The list under your name, and the job titles Google is told about. |
| `location` | Shown in the footer and on the contact page. |
| `availability` | The text behind the dot in the header. |
| `availabilityState` | `open` gives a green pulsing dot; anything else gives a grey one. |
| `yearsFrom` | The year you started. Used to work out years active, so it never goes stale. |

## `hero` — the first screen

| Field | What it does |
|---|---|
| `lines` | The big headline, one array item per line. **The second line prints in red and the third in gold**, the way a poster title was set in two inks. Three short lines works best; four gets cramped on a laptop. |
| `kicker` | The small red line above it. |
| `intro` | The paragraph below. Keep it under about 45 words. |
| `ctaPrimary` / `ctaSecondary` | The two buttons: `label` and `href`. |

## `about`

`lead` is the large opening sentence. `paragraphs` is a list — each item becomes
its own paragraph. `philosophy` is the pull-quote with the red bar; delete it
and the quote disappears. `facts` is the "at a glance" table: each item is a
`label` and a `value`.

## `experience` and `education`

Each entry is `org`, `from`, `to`, plus `role` for experience or `award` for
education. They appear in the order you write them.

## `works` — your projects

The most important section. One entry per project.

| Field | Required | What it does |
|---|---|---|
| `slug` | yes | The web address: `/work/your-slug`. Lower case, hyphens, no spaces. Must be unique. |
| `title` | yes | The project name. |
| `subtitle` | no | A second line — a subtitle, or what a piece was scored for. |
| `kind` | yes | `original`, `cover` or `screen`. Drives the top row of filters. |
| `collection` | yes | `hindi`, `tamil`, `bhajan`, `instrumental` or `media`. Drives the second row. |
| `artStyle` | no | Which artwork gets drawn — see HANDOVER.md section 6. |
| `roles` | no | What you did: `["Producer", "Mix"]`. |
| `summary` | no | One or two sentences. Also becomes the description in Google and in shared links, so make it a real sentence — under about 20 characters and it is treated as missing. |
| `with` | no | A collaborator, shown as "with …". |
| `series` | no | Groups a set of songs, shown as a tag. |
| `featured` | no | `true` puts it on the home page. |
| `cover` | no | Path to a real image, replacing the generated artwork. |
| `links` | no | Buttons out to YouTube, SoundCloud, Instagram, Linktree. Each is `label`, `url`, `type`. |
| `story` | no | A list of paragraphs, shown lower down the project page. Good for a case study. |
| `rightsNote` | no | A note for you, never shown to visitors. |

## `services`

`enabled: false` removes the whole services page and its menu link.
`currency` is the prefix on prices. Each item in `items` has `name`, `price`,
`unit`, `turnaround`, `blurb`, and `includes` (a list of bullet points).
`popular: true` adds the "most asked for" flag.

**Leave `price` as `NEEDS-CONFIRMATION` and it shows "On enquiry"** — a real
choice, not a broken one.

## `process` and `faq`

`process` is the numbered "how a project runs" list: `title` and `body`.
`faq` is `q` and `a`. The FAQ is also given to Google in a form it can show
directly in search results, so real questions people ask you are worth more here
than invented ones.

## `player` — the bar at the bottom

`queue` is the list of tracks. Each has `title`, `subtitle`, `src` (a file in
`public/audio/`), and `isDemo`. While `isDemo` is `true` an amber "demo audio"
label is shown, so nobody mistakes a placeholder for your work.

## `compare` — the before/after control

`enabled: false` removes it. `raw` and `mixed` each have a `label` and a `src`,
and **must be the same performance** — same length, same starting point, because
they play in sync and you switch between them.

## `social` and `contact`

`social` is a list of `label`, `url`, `icon`. **Any link whose `url` still says
`NEEDS-CONFIRMATION` is hidden**, so an unfinished link never becomes a dead one.

`contact` holds `email`, `phones`, `formEndpoint` (see HANDOVER.md section 7),
`note` (the line above the form) and `responseTime`.

`phones` is a list, because you have numbers in two countries and a single field
could not say which is which. Each entry is a `label` and a `number`:

```json
"phones": [
  { "label": "Dubai", "number": "+971 56 724 3945" },
  { "label": "India", "number": "+91 98207 42125" }
]
```

**Deliberately not in this file: your home address and your date of birth.** Your
old site published both. Together they are what someone needs to impersonate you,
and the address is a personal-safety exposure that brings in no work. If you want
either back, add it knowing that — and remember this file is public if your
repository is.

---

## The one rule

The punctuation matters. Change the words **between the quote marks** and leave
the quotes, commas and brackets exactly where they are.

Every line inside `{ }` needs a comma at the end **except the last one**. That
single missing or extra comma is the cause of nearly every problem.

```json
{
  "title": "My Song",        ← comma
  "kind": "original",        ← comma
  "summary": "Some words."   ← no comma, it is last
}
```

If you get it wrong, the site refuses to republish and tells you which line. Your
live site is untouched. Nothing is lost, and nothing broken reaches the public.
