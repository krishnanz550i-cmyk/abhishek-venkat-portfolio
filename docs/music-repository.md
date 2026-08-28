# Turning this site into a music repository

A shared brief. Every persona in [`.claude/agents/`](../.claude/agents/) reads this
first, so they build the same thing.

---

## 1. What we are building

A **portfolio** is a curated shop window: a handful of finished pieces, chosen by
hand, arranged to impress. A **repository** is a catalog that grows: everything,
described well enough to be found again.

We are building the second **behind** the first. The portfolio stays exactly as it
is — the front door, hand-picked, fast, static. The repository is the engine
behind it, and the site becomes one view onto the catalog rather than the whole
of it.

Two audiences, one store:

| | Archive (private) | Catalog (public) |
|---|---|---|
| Who | Abhishek | visitors, hiring producers, licensees |
| Holds | masters, stems, sessions, rough bounces, unreleased | released and clearable work only |
| Found by | "the Tamil ballad with the flute, 2023-ish" | browse, filter, "sounds like this" |
| Gate | none | rights state must be `clear` |

Nothing reaches the public catalog that the rights persona has not cleared. That
is the one rule with no exceptions.

## 2. Where we are starting from

Be accurate about this — it is a good, small, working site, not a blank page.

- **Astro 7, fully static.** 29 pre-rendered pages. No server, no database, no
  runtime keys, nothing fetched from a third party at page load.
- **All content in one file**, `site/content/site.json` — 23 entries under `works`.
- **Audio is flat files** in `site/public/audio/`, with `peaks.json` (waveforms),
  `analysis.json` (measured A/B differences) and `manifest.json` alongside them.
  The shipped audio is synthesised placeholder, flagged by `demoAudio.isPlaceholder`.
- **Build gates already exist**: `scripts/check-content.mjs` and
  `check-contrast.mjs` run before the build, `check-build.mjs` after it,
  `test/smoke.mjs` drives a real browser over `dist/`.
- **Publishing is one workflow**, `.github/workflows/publish.yml` → GitHub Pages.

The current work entity is:

```
slug, title, kind, collection, artStyle, with, roles[], summary, featured, links[]
```

`kind` is one of `original | cover | screen`; `collection` is one of
`hindi | tamil | bhajan | instrumental | media`. Both are declared in
`workFilters` and drive the filtering on `/work`.

Two things on the site are deliberate and **must survive every change**:

1. **The player keeps playing across navigation** (`Player.astro`, `player.js`).
2. **The A/B comparison is loudness-matched on purpose** (`ABCompare.astro`,
   `ab.js`). A louder version always sounds better; matching the levels is what
   makes it an honest demonstration rather than a trick. The numbers beside it are
   measured from the real files by `scripts/analyse_audio.py`.

## 3. What has to change, and when

The honest constraint: **one JSON file in git is excellent at 23 tracks and
collapses somewhere around 200.** Not because JSON is bad, but because a human
editing it by hand is the publishing mechanism, and that stops scaling.

So the migration is staged, and each stage ships something usable:

- **Stage 1 — schema.** Grow the work entity into a real one (versions, stems,
  rights, measured audio facts). Still one JSON file, still hand-editable, still
  23 entries. Nothing about publishing changes.
- **Stage 2 — pipeline.** A file dropped in a folder gets transcoded, measured,
  peaked and turned into a catalog entry automatically. The JSON becomes
  generated rather than hand-written, with hand-written overrides.
- **Stage 3 — intelligence.** Auto-tagging, key/BPM/instrument detection,
  transcription, and embeddings. Every machine-written field is marked as such and
  is a *suggestion* until a human confirms it.
- **Stage 4 — retrieval.** Faceted filters plus similarity search plus
  natural-language query. This is where it stops being a list.
- **Stage 5 — store.** Move off the single file only when the file is actually
  hurting. Object storage for audio, SQLite or Postgres for metadata, with the
  curated front page still driven by something a human can edit.

**Do not skip to stage 3.** Tagging with no schema to tag into produces a few
thousand rows of inconsistent free text, which is worse than no tags.

## 4. Target entity model (starting point, not settled)

The `catalog-architect` persona owns this and will refine it. Everyone else codes
against whatever it currently says.

```
Work            the creative piece   — the song, the cue, the score
 └─ Version     a rendering of it    — rough bounce, final mix, radio edit, live
     └─ Asset   an actual file       — master WAV, MP3 preview, stem, session
Contributor     a person + their role on a Work
Rights          who owns what, what may be shown, what may be licensed
Tags            genre, mood, instrument, language — human or machine, always marked
```

Why three levels: the A/B comparison is already two Versions of one Work, and the
site currently has no way to say that. Anything modelling a track as a single flat
record cannot express it.

**Provenance is mandatory on every field the machine writes.** Store the value,
the model that produced it, the confidence, and whether a human has confirmed it.
A catalog that cannot tell you which facts it guessed is a catalog nobody trusts.

## 5. Non-negotiables

1. **Rights gate.** No asset reaches a public page without a resolved rights
   state. `CONTENT-NEEDED.md` already flags five screen-work entries as
   `NEEDS-CONFIRMATION` — that mechanism becomes structural, not a to-do note.
2. **Placeholder honesty.** Demonstration audio stays labelled as demonstration
   audio. `ALLOW_PLACEHOLDER=1` is a local convenience; the publish check refuses
   unfinished text on a public page, and that stays true.
3. **Measured, not asserted.** Every number shown to a visitor is computed from
   the real file. No hand-typed loudness figures.
4. **The static front door stays static.** Whatever grows behind it, the public
   site must remain pre-rendered, keyless and fast.
5. **AI suggests, humans confirm.** Machine tags are drafts until reviewed.
