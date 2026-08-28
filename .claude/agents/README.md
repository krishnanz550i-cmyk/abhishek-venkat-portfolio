# The personas

Six Claude Code subagents that build this repository out from a portfolio site
into a music repository. They all read [`docs/music-repository.md`](../../docs/music-repository.md)
first — that is the shared brief, and it is what stops six agents building six
different things.

## Roster

| Persona | Owns | Reach for it when |
|---|---|---|
| **`catalog-architect`** | The data model and vocabulary — entities, fields, controlled tag lists, migrations of `site.json` | Anything changes the *shape* of catalog data |
| **`audio-pipeline`** | The bytes — transcoding, loudness, waveform peaks, the ingest conveyor belt | Anything touches an audio file or the scripts that measure one |
| **`music-ml`** | The AI layer — tagging, key/BPM, stems, transcription, embeddings | A model listens to a file and writes metadata |
| **`catalog-search`** | Finding things — facets, text, similarity, natural-language query | A feature is phrased "I want to find the track that…" |
| **`music-frontend`** | What a visitor sees and hears — pages, player, A/B, browse, accessibility | Anything in `site/src/` |
| **`rights-and-qa`** | The gate — rights state on every asset, build checks, and *evaluating* the AI | Before anything becomes public |

## How they fit together

```
        catalog-architect  ── defines the shape everyone else fills
                 │
    ┌────────────┼────────────┐
    │            │            │
audio-pipeline → music-ml → catalog-search
  (measures)   (describes)   (retrieves)
    │            │            │
    └────────────┼────────────┘
                 │
         music-frontend  ── presents it
                 │
          rights-and-qa  ── gate: nothing public passes without clearing it
```

The order matters. Tagging with no schema to tag into produces inconsistent free
text at scale, which is worse than no tags — so `catalog-architect` goes first,
and `rights-and-qa` goes last on everything.

## Using them

```
Ask catalog-architect to add rights and duration fields to the work schema
Ask audio-pipeline to make npm run assets incremental
Ask rights-and-qa to review the screen-work entries before publishing
```

Or invoke one directly with the Agent tool by its `name`. They are ordinary
subagent definitions — each is a markdown file with YAML frontmatter, editable by
hand.

## The rules they all inherit

Repeated here because they are the ones most easily lost:

1. **Rights gate.** Nothing reaches a public page without a resolved rights state.
2. **AI suggests, humans confirm.** Machine-written fields carry provenance
   (model, confidence, `confirmedBy`) and are drafts until reviewed.
3. **Measured, not asserted.** Every number shown to a visitor is computed from
   the real file.
4. **The public site stays static and keyless.** Models run at ingest time. The
   site consumes their output as data.
5. **The player survives navigation, and the A/B stays loudness-matched.** These
   are the two deliberate things about this site. Don't break them.
