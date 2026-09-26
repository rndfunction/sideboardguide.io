# Schema Rationale (short form)

A one-page summary of *why* the guide schema looks the way it does. Read
this before proposing a schema change. If a proposed change conflicts with
one of these, the burden is on the change to explain what has changed about
the underlying reasoning.

## The four principles

1. **Contribution should be frictionless.** Anything that discourages a
   user from submitting or updating a decklist is probably wrong. The
   corpus benefits monotonically from more data.

2. **The corpus is the product, not any single guide.** No guide is
   canonical. No guide is privileged. Similarity between guides is
   computed, not stored.

3. **The reader's question is "how do these decks differ," not "which
   came first."** Schema choices should serve difference and currency, not
   provenance and hierarchy.

4. **Moderation is a floor, not a ceiling.** The validator rejects
   malformed guides and nothing else. Quality is surfaced by signals
   (verified, freshness, author reputation) and by the archetype index's
   card-frequency view, never by gatekeeping.

## The load-bearing decisions

- **One current state per guide.** No version history. `git revert` is the
  recovery path.
- **Fork-only, no suggest-edit.** If you want a variant, submit it as
  your own.
- **No `basedOn`.** Lineage is never stored or displayed.
- **Author-only in-place edit**, verified by server-derived `authorGithub`.
- **Derived signals only.** No stored scores, no stored reputation, no
  stored similarity. Everything is computed from the current manifest.
- **The archetype index is the primary Browse experience.** Card-frequency
  histogram plus UI clustering of near-duplicates. Nothing is hidden.

## What would justify revisiting

- If the guides repo consistently exceeds a few thousand files, the
  manifest may need a server-side search layer. The schema is compatible
  with that; only the retrieval mechanism would change.
- If tags proliferate into synonym soup despite canonicalization, the
  vocabulary may need to become closed (a fixed list). The schema is
  compatible with that; only the ingestion path would change.
- If abuse of author-only editing becomes common, `GUIDE_CHANGES.md` can
  grow into a fuller audit log. The schema is compatible with that; only
  the Action's logging step would change.