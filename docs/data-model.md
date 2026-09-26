# Data Model

The design decisions behind how guides are stored, related, and displayed.
This document is the source of truth for the *intent* behind the schema; the
guide files and the GitHub Action in `rndfunction/SideboardGuides` are the
implementation.

## The core idea

**The site is a corpus. Every guide is an independent data point.**

A decklist is not a fact, it is an opinion about how to build a deck. Two
players with the same archetype will almost never have identical lists, and
the differences are the interesting part. The system is designed so that more
contributions always make the site more useful, with no editorial bottleneck
and no contribution penalized for being derivative.

## What a guide is

A guide is a single, standalone JSON file. It has exactly one current state.
There is no version history in the application layer.

The file shape is the versioned `mtg-sideboard-guide` format already
defined in `/js/persistence.js`:

```json
{
  "format": "mtg-sideboard-guide",
  "version": 1,
  "generator": "Sideboard Guide Builder",
  "createdAt": "2026-09-24T00:00:00.000Z",
  "deck": {
    "name": "Mono Red Madness",
    "format": "Pauper",
    "archetype": "Mono Red Madness",
    "rawText": "3 Faithless Looting\n..."
  },
  "matchups": ["Mono U Faeries", "Tron", "Dimir Control"],
  "plan": {
    "Fireblast@main": { "Tron": { "dir": "out", "count": 3 } },
    "Pyroblast@side": { "Mono U Faeries": { "dir": "in", "count": 4 } }
  },
  "titleCard": { "color": "#8a2a1a", "fontKey": "cinzel", "...": "..." }
}
```

Plan keys are section-aware: `name@main` or `name@side`. See
`normalizePlanKeys` in `/js/store.js` for the legacy-to-current migration.

## What the manifest stores

The manifest (`manifest.json` in the guides repo) is the index of available
guides. Each entry is a lightweight projection of the guide file plus
attribution metadata.

```json
{
  "file": "mono-red-madness-pauper.json",
  "deckName": "Mono Red Madness",
  "format": "Pauper",
  "archetype": "Mono Red Madness",
  "archetypeKey": "mono-red-madness",
  "author": "rndfunction",
  "authorGithub": "rndfunction",
  "tags": ["budget", "beginner-friendly"],
  "verified": false,
  "createdAt": "2026-09-24",
  "lastEditedAt": "2026-09-24"
}
```

Field notes:

- **`archetypeKey`** is a stable slug derived from the deck name. It is what
  the archetype index groups by. Two guides with the same `format` and the
  same `archetypeKey` are in the same bucket.
- **`authorGithub`** is the GitHub login the Action recorded from the
  submitter's token at submission time. It is the *only* thing that gates
  in-place editing. It is set by the server, never trusted from the client.
- **`tags`** are user-provided, canonicalized on ingest (lowercase, trimmed).
  They are a secondary filter, orthogonal to archetype.
- **`verified`** is a staff-assigned boolean. The strongest single sort
  signal. Manual review of a small subset, not every submission.
- **`lastEditedAt`** is updated on every edit. The only freshness signal.

There is deliberately **no** `basedOn`, **no** `contributors`, **no**
`previousVersions`, and **no** `version` field at the manifest level. See
"Decisions and their reasons" below.

## What the archetype index stores

The archetype index (`archetypes.json` in the guides repo) is a derived
artifact, rebuilt on every manifest change. It is the primary Browse
experience.

```json
{
  "version": 1,
  "lastUpdated": "2026-09-25",
  "archetypes": [
    {
      "key": "mono-red-madness",
      "name": "Mono Red Madness",
      "format": "Pauper",
      "guideCount": 7,
      "cardFrequency": [
        { "name": "Lightning Bolt", "inclusion": 1.0, "avgCopies": 4.0 },
        { "name": "Lava Dart", "inclusion": 1.0, "avgCopies": 4.0 },
        { "name": "Searing Blaze", "inclusion": 0.71, "avgCopies": 2.8 }
      ],
      "tags": ["budget", "beginner-friendly"],
      "guides": [
        {
          "file": "mono-red-madness-pauper.json",
          "author": "rndfunction",
          "verified": false,
          "lastEditedAt": "2026-09-24",
          "overlapWithCore": 0.94
        }
      ]
    }
  ]
}
```

`overlapWithCore` is a computed similarity (weighted Jaccard on distinct card
names), not a stored relationship. It is symmetric and current: it reflects
the present state of both guides and updates whenever either changes.

## Decisions and their reasons

### Edit, don't version

Editing a guide overwrites it. There is no version history in the
application. The reasons:

- MTG content has a half-life measured in sets, not years. A 2024 Pauper
  guide is not a historical artifact in 2030, it is a snapshot of a meta
  that no longer exists.
- A `version` counter exists only as a concurrency token, never displayed.
- Recovery from a bad edit is `git revert` (maintainer-only, not a feature).
- Audit is a one-line append to `GUIDE_CHANGES.md` per edit, informational
  only, no content.

### Fork is the primary action, not "suggest an edit"

There is no flow for proposing changes to someone else's guide. If you want
a variant, you submit it as your own new guide. The reasons:

- A decklist is an opinion, and opinions do not merge.
- Suggesting edits creates an accept/reject UX and a moderation queue, and
  routes contribution energy through someone else's judgment.
- Making fork the primary action means the thing that improves the site
  (more submissions) is exactly what the UI encourages.

### No lineage, no `basedOn`

There is no recorded derivation relationship between guides. The reasons:

- Any visible lineage marker becomes a social signal and a status game.
  "Original" vs "derived" is a hierarchy nobody should be ranked by.
- A stored edge goes stale when either guide is edited. A computed
  similarity score is always current and always symmetric.
- The reader wants to know *how* two decks differ, not *which came first*.

### Only the author can edit in place

A user may edit a guide they submitted; they may not edit anyone else's.
Ownership is verified server-side by matching the submitter's token
`login` against the entry's `authorGithub`. The reasons:

- It removes friction for the person who owns the decklist, which is the
  person most likely to keep it current.
- It bounds the trust model to "authors do not deface their own guides,"
  which is a much smaller surface than "anyone can edit anything."
- It is the GitHub-issues model, not the Wikipedia model.

### Author reputation is derived, never stored

Per-author stats (`guideCount`, `verifiedCount`, formats represented) are
computed from the manifest. The reasons:

- They cannot drift out of sync with reality.
- They are the signal a reader uses to decide which of N similar guides to
  open, and that signal should always be current.
- No upvotes, ever. Votes create gameable incentive gradients. A "verified"
  checkmark and a "last edited" timestamp are harder to game and more
  honest.

### Near-duplicates are clustered in the UI, never hidden

Within an archetype, guides are grouped by overlap with the archetype core
(`>= 0.9` = canonical build variants, `0.7-0.9` = close variants, below =
distinct builds). The reasons:

- A corpus of 200 near-identical elf decks is a strength, not a problem,
  because 200 data points describe the meta more accurately than one.
- The clustering is a *view*, not a gate. Any guide is one click away.
- The archetype index is what makes the corpus legible; nothing is
  suppressed to make the list shorter.

## Open questions

These are not decided and should be revisited when there is enough data to
make the answer obvious:

- **The archetype index producer.** `archetypes.json` is specified in
  `docs/archetype-index-spec.md` and has a reference Python implementation,
  but it is not yet wired into the guides repository's GitHub Action. Until
  it is, the Browse view runs on a hand-computed fixture
  (`guides/archetypes.demo.json`). Wiring the producer is the next
  server-side milestone; see that spec for the contract.
- **Overlap thresholds.** 0.8 for "core", 0.9 / 0.7 for UI clustering. All
  three are initial guesses. They should be revisited once there are dozens
  of guides per archetype to test against.
- **Sideboard OUT analysis.** The index's `boardInMatrix` covers cards
  brought IN per matchup. The OUT side (what is cut) is not aggregated, on
  the view that "card X is boarded in here" is more actionable as aggregate
  data than "card Y is cut here." Worth revisiting if readers ask for it.
- **Mana curve.** An aggregate curve per archetype would be interesting but
  requires the index to carry per-card mana value, which is a card-metadata
  dependency the current index avoids. Deferred.

Resolved since this document was first written:

- **Tag vocabulary.** Canonicalized on ingest (lowercase, trim). Good enough
  at current scale; the manifest carries tags directly.
- **`verified` criteria.** Staff judgment, applied to a small subset rather
  than every submission. Documented in `schema-rationale.md`.
- **History of edits.** No version history by decision. `git revert` is the
  recovery path and an optional `GUIDE_CHANGES.md` is the audit path. See
  "Edit, don't version" above.