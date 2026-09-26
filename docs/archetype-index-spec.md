# Archetype Index Spec

The schema, the algorithm, and the reference implementation for
`archetypes.json`, the derived artifact that powers the Browse view.

This spec is the contract between two halves:

- **Producer**: a script run by the GitHub Action in the guides repo
  (`rndfunction/SideboardGuides`) on every manifest change. This spec
  includes a reference Python implementation that can be lifted directly.
- **Consumer**: the client (`listArchetypes()` in `/js/guides.js` and the
  archetype view in the app). This spec defines the exact shape the
  client expects and can trust.

If the producer and the consumer disagree about shape, the client is the
one that has to degrade — it validates the file and falls back to the flat
list if anything is malformed.

## Why this exists

The guides corpus grows with every submission, and submissions are
encouraged to be derivative (see `/docs/data-model.md`). A flat list of
guides becomes unreadable well before a thousand entries. The archetype
index turns the corpus into a legible one: for any archetype, what do its
guides look like in aggregate, and which guides are canonical variants of
each other?

The index is a **derived artifact**. It contains nothing that cannot be
recomputed from the current manifest and the current guide files. If it is
missing, stale, or malformed, the client falls back to the flat guide list
with no loss of data.

## The archetypeKey field

Every manifest entry gains a required field, `archetypeKey`, a stable slug
derived from `archetype`. The derivation is:

```python
def slugify(s):
    # Lowercase, replace runs of non-alphanumeric characters with a single
    # hyphen, strip leading/trailing hyphens.
    import re
    s = (s or "").strip().lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')
```

Examples:

| Input                  | archetypeKey        |
| ---------------------- | ------------------- |
| `Mono Red Madness`     | `mono-red-madness`  |
| `mono-red madness`     | `mono-red-madness`  |
| `Mono-Red Madness `    | `mono-red-madness`  |
| `Mono  Red  Madness`   | `mono-red-madness`  |
| `8-Cast`               | `8-cast`            |
| `Sneak and Show`       | `sneak-and-show`    |

**Derived server-side.** The client never sends `archetypeKey`. It sends
`meta.archetype` as free text; the Action slugifies it. This is deliberate:
a buggy or out-of-date client must not be able to fragment the index by
producing a key that differs from every other guide's key for the same
archetype.

**Empty case.** If `meta.archetype` is empty, the key is empty string. The
index builder excludes entries with an empty key from all buckets (they
have no archetype to be bucketed into). Such guides remain reachable via
the flat guide list.

## The archetypes.json file

Location: at the root of the guides repo, alongside `manifest.json`.

**Current version: 2.** Version 2 adds `boardInMatrix`, per-matchup
board-in statistics derived from each guide's `plan`. Version 1 (the
original shape) is still accepted by the client, which renders it without
the board-in section. A producer should emit v2.

Shape (v2):

```json
{
  "version": 2,
  "lastUpdated": "2026-09-25",
  "archetypes": [
    {
      "key": "mono-red-madness",
      "name": "Mono Red Madness",
      "format": "Pauper",
      "guideCount": 7,
      "cardFrequency": [
        { "name": "Lightning Bolt", "inclusion": 1.0, "avgCopies": 4.0 },
        { "name": "Lava Dart",     "inclusion": 1.0, "avgCopies": 4.0 },
        { "name": "Searing Blaze", "inclusion": 0.71, "avgCopies": 2.8 }
      ],
      "boardInMatrix": {
        "Mono U Faeries": [
          { "name": "Pyroblast", "inclusion": 1.0, "avgCopies": 4.0 },
          { "name": "Red Elemental Blast", "inclusion": 0.71, "avgCopies": 1.0 }
        ],
        "Tron": [
          { "name": "Cleansing Wildfire", "inclusion": 1.0, "avgCopies": 3.0 }
        ]
      },
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

### Field reference

Top level:

| Field         | Type   | Notes                                                   |
| ------------- | ------ | ------------------------------------------------------- |
| `version`     | number | Bumped when the schema changes. Currently `1`.          |
| `lastUpdated` | string | ISO `YYYY-MM-DD`. Same day as the manifest's last edit. |
| `archetypes`  | array  | One entry per bucket. See below.                        |

Archetype entry:

| Field           | Type   | Notes                                                                 |
| --------------- | ------ | --------------------------------------------------------------------- |
| `key`           | string | The `archetypeKey`. Unique within the file.                           |
| `name`          | string | The most common `archetype` string in the bucket, verbatim.           |
| `format`        | string | The format. Since `key` doesn't include format, format is part of the identity; see "Buckets" below. |
| `guideCount`    | number | Number of guides in the bucket.                                       |
| `cardFrequency` | array  | See below. Sorted by `inclusion` desc, then `name` asc.               |
| `boardInMatrix` | object | v2 only. Keyed by matchup name. See below. Optional for v1 files.    |
| `tags`          | array  | Union of all `tags` across the bucket's guides. Sorted asc, deduped.  |
| `guides`        | array  | See below. Sorted by `overlapWithCore` desc, then `lastEditedAt` desc, then `file` asc. |

Card frequency entry:

| Field       | Type   | Notes                                                       |
| ----------- | ------ | ----------------------------------------------------------- |
| `name`      | string | Card name, exactly as it appears in the guide files.        |
| `inclusion` | number | Fraction of guides containing at least one copy. Range 0–1. |
| `avgCopies` | number | Mean copies across all guides in the bucket. Range 0–4-ish. |

### boardInMatrix (v2)

`boardInMatrix` answers a different question than `cardFrequency`.
`cardFrequency` describes the maindeck — what the archetype *is*.
`boardInMatrix` describes the sideboard plan — how the archetype is
*piloted*, specifically which cards come IN against which matchups.

Shape: an object keyed by matchup name. Each value is an array of card
entries, sorted by `inclusion` desc, then `avgCopies` desc, then `name`
asc. Cards that no guide boards in against that matchup are **omitted**
(absence is the zero — an empty list means "nobody brings anything in
here", which is itself information).

Board-in card entry:

| Field       | Type   | Notes                                                                 |
| ----------- | ------ | --------------------------------------------------------------------- |
| `name`      | string | Card name.                                                            |
| `inclusion` | number | Fraction of guides that board this card IN against this matchup. 0–1. |
| `avgCopies` | number | Mean copies boarded in, across the guides that board it in.           |

Two numbers, two questions. `inclusion` answers "do people bring this in
at all?" (a *should I* signal). `avgCopies` answers "how many copies?"
(a *how many* signal). They are complementary: a card at inclusion 1.0 /
avgCopies 4.0 is a full playset everyone runs; a card at inclusion 1.0 /
avgCopies 1.0 is a singleton hedge everyone agrees on; a card at 0.5 / 3.0
is a contested three-of. Collapsing them into one number loses the
distinction.

The client displays `inclusion` as the visual weight (bar length) and
`avgCopies` as a compact label, mirroring how `cardFrequency` is shown.

**Derivation.** For each matchup, walk every guide in the bucket's
`plan`. A card is "boarded in" if `plan[card + "@side"][matchup].dir ===
"in"`. `inclusion` is the fraction of guides in the bucket (all of them,
including those with no entry for this matchup) that board it in.
`avgCopies` is the mean `count` across the guides that board it in — not
across all guides.

**Scope note.** v2 covers board-IN only, not board-OUT. The OUT side of
a sideboard plan is derived from what's cut, and a card being cut against
a matchup is less actionable as aggregate data than a card being brought
in. OUT analysis is a possible future direction.

Guide entry:

| Field            | Type    | Notes                                                       |
| ---------------- | ------- | ----------------------------------------------------------- |
| `file`           | string  | The guide filename. Matches a manifest entry's `file`.      |
| `author`         | string  | Copied from the manifest entry.                             |
| `verified`       | boolean | Copied from the manifest entry.                             |
| `lastEditedAt`   | string  | Copied from the manifest entry.                             |
| `overlapWithCore`| number  | Weighted Jaccard between this guide's card set and the core. Range 0–1. |

## Buckets

A bucket is identified by the tuple `(format, key)`. Two guides in the
same format with the same `archetypeKey` are in the same bucket. Two guides
with the same `archetypeKey` in different formats are in different buckets.
This is why `format` is a field on the archetype entry but not part of
`key` — it's part of the bucket identity, but it's not a slug-worthy
distinction.

Guides with an empty `archetypeKey` are not bucketed anywhere and do not
appear in the index.

## The algorithm

For each bucket:

1. **Collect inputs.** Find every manifest entry with this `(format, key)`.
   For each, read the guide file and extract the mainboard cards from
   `deck.rawText` using the parser grammar (see "Parser grammar" below).
   Cards are deduplicated by name; a guide "contains" a card if it has at
   least one copy.

2. **Compute card frequency.** For every distinct card name across the
   bucket, compute:
   - `inclusion = count(guides containing the card) / guideCount`
   - `avgCopies = sum(copies across all guides) / guideCount`

   Sort by `inclusion` desc, then `name` asc. The whole array is emitted;
   there is no truncation in the file. (The UI decides how many to show.)

3. **Compute the core.** The core is the set of card names with
   `inclusion >= 0.8`. This threshold is provisional; see "Provisional
   thresholds" below.

4. **Compute per-guide overlap with the core.** For each guide, its
   `overlapWithCore` is the weighted Jaccard similarity between the guide's
   card set and the core set:

   ```
   weightedJaccard(A, B) = sum over c in (A ∪ B) of min(copies_A(c), copies_B(c))
                         / sum over c in (A ∪ B) of max(copies_A(c), copies_B(c))
   ```

   where `copies_A(c)` is the number of copies of card `c` in guide A (0 if
   absent). This produces a value in `[0, 1]` where 1 means "identical
   maindeck composition" and 0 means "no overlap at all." Empty-vs-empty is
   defined as 1.0 (two empty decks are identical); empty-vs-nonempty is 0.

5. **Assemble.** Emit `{ key, name, format, guideCount, cardFrequency,
   tags, guides }` with the sort orders specified in the field reference.
   `name` is the most common `archetype` string in the bucket (ties broken
   by lexicographic order). `tags` is the union of the bucket's tags.

6. **Sort the archetypes.** Emit them sorted by `format` asc, then
   `guideCount` desc, then `key` asc. This means within a format, the
   largest archetypes come first.

## Parser grammar (mainboard extraction)

The Python implementation must match the client parser's grammar so that
the index reflects what the app actually displays. The grammar, matching
`/js/parser.js`:

```
line       := comment | sideboard-header | section-header | blank | card
comment    := /\s*(\/\/|#|$)/
sideboard  := /^(sideboard|sb|side board)\s*:?\s*$/i
section    := /^(maindeck|main deck|main|deck)\s*:?\s*$/i
card       := /^(\d+)\s*[xX]?\s+(.+?)\s*$/   (count, name)
```

Cards below the first `sideboard`/`section`-matching line (or the last
blank-line-separated block, if it sums to ≤ 20 and the first block sums to
≥ 40) are sideboard and are excluded from the index.

**Scope note for v1:** the index uses mainboard only. Sideboard analysis
(which cards are boarded in against which matchups, aggregated across
guides) is a meaningful future direction but is deliberately out of scope
until the corpus is large enough to be meaningful.

## Provisional thresholds

Two numeric choices are provisional and expected to be revised once there
are dozens of guides per archetype:

- **`inclusion >= 0.8` for "core."** Chosen so that a card in 4 of 5
  guides counts as core but a card in 3 of 5 does not. This may be too
  strict for small buckets (2 guides → either both have the card, or it's
  not core) and too loose for large ones.
- **UI clustering thresholds `0.9 / 0.7`.** Used by the client to group
  near-duplicates within an archetype. The index itself does not cluster;
  it emits `overlapWithCore` and the client decides how to present it.

Neither threshold affects the *shape* of the file. Changing them is a
producer change with no client-side migration.

## Reference implementation

The canonical implementation lives in the client repository at
`deploy/index_builder.py`. It is a standalone, standard-library-only
Python script that reads `manifest.json` and the guide files and writes
`archetypes.json`. That file is the source of truth for the algorithm;
this spec describes the contract it must satisfy.

It is kept next to this spec (in `deploy/`) rather than duplicated here so
that a change to the algorithm and a change to this contract are one
commit apart. To deploy, copy `deploy/index_builder.py` and
`deploy/submit-guide.yml` into the guides repository — see
`deploy/README.md` for the exact steps.

The two properties worth stating here, because they are easy to get wrong
when reimplementing:

1. **The parser grammar must match `js/parser.js`.** Mainboard cards are
   extracted with the same count/name grammar and the same
   maindeck/sideboard heuristic the client uses. If they drift, the index
   describes a deck the app does not show.

2. **`boardInMatrix` counts board-IN only.** A card is "boarded in"
   against a matchup when a guide's plan has `dir === "in"` for that card
   and matchup. `inclusion` is the fraction of all guides in the bucket
   that board it in; `avgCopies` is the mean across the guides that do,
   not across all of them.
```

## Worked example

Given the two bundled guides in `/guides/`:

- `mono-red-burn-modern.json` — format `Modern`, archetype `Mono-Red Burn`
- `mono-red-madness-pauper.json` — format `Pauper`, archetype `Mono Red Madness`

These are in **different buckets** (different formats AND different keys),
so the index would produce two archetypes, each with `guideCount: 1`.

For a `guideCount: 1` bucket:

- Every card has `inclusion = 1.0` (there's one guide and it either has the
  card or doesn't), so the whole mainboard is the core.
- `overlapWithCore = 1.0` for the single guide (it is its own core).
- `cardFrequency` is the guide's mainboard with `avgCopies = copies`.

This is the correct and expected result for a single-guide bucket. The
index becomes interesting at `guideCount >= 3`, which is where `inclusion`
starts taking on fractional values and the core becomes a real abstraction.

To see a meaningful index, a real test would need three or more guides in
the same bucket. The client's archetype view therefore **defaults to
showing the flat guide list when no bucket has `guideCount >= 2`**, and
switches to the archetype view once any bucket crosses that threshold.

## Client contract

The client (`/js/guides.js` and the archetype view) will:

- Fetch `archetypes.json` via the same three-tier fallback as the manifest
  (remote → local → in-memory). If the file is missing entirely, the
  archetype view is not shown and the flat guide list is.
- Validate the shape before rendering. Any of the following causes a
  graceful fallback to the flat guide list:
  - `version` is not `1` (future schema)
  - `archetypes` is missing or not an array
  - any entry is missing `key`, `name`, `format`, `guideCount`,
    `cardFrequency`, or `guides`
  - any `cardFrequency` entry is missing `name`, `inclusion`, or
    `avgCopies`
- Never mutate the fetched object. The client treats it as read-only.

## What this spec does not cover

- **The Action's integration.** This spec describes the producer script;
  wiring it into `submit-guide.yml` (and into an eventual `edit-guide.yml`)
  is a separate change in the guides repo.
- **Sideboard analysis.** Mainboard only in v1. Aggregating plan
  differences across guides is a future direction.
- **The archetype view's visual design.** The client contract above
  describes what the client trusts; how it draws it is a design decision
  made in the client, not here.
- **Tag canonicalization.** The manifest carries tags already; this spec
  says the index unions them. Canonicalization happens at write time in
  the Action, not here.