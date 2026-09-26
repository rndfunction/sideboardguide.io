# deploy/

Files that belong to the **guides repository** (`rndfunction/SideboardGuides`),
kept here so the client and the producer stay version-controlled together.
Nothing in this directory runs in the client app; it is a deployment
staging area.

## What is here

- **`index_builder.py`** — the archetype index producer. Reads
  `manifest.json` and the guide files, writes `archetypes.json`. Pure
  Python standard library, no dependencies. The algorithm is specified in
  `../docs/archetype-index-spec.md`; that spec is the contract, this script
  is the implementation.
- **`submit-guide.yml`** — the updated submission workflow. Two changes
  from the previous version:
  1. New manifest entries carry `archetypeKey` (a slug of `archetype`),
     plus `tags`, `verified`, and `lastEditedAt`.
  2. A "Rebuild archetype index" step runs `index_builder.py` and the
     resulting `archetypes.json` is included in the commit.

## Deploying

Two files go into the guides repository. Here is the exact placement:

| This file                  | Goes to (guides repo)                |
| -------------------------- | ------------------------------------ |
| `deploy/index_builder.py`  | `index_builder.py` (repo root)       |
| `deploy/submit-guide.yml`  | `.github/workflows/submit-guide.yml` |

The workflow calls `python3 index_builder.py` from the repo root, so the
script must be at the root for the paths to line up. (If you would rather
put it elsewhere, update the `Rebuild archetype index` step's `run:` line
to match.)

### Step 1 — test the builder locally, first

The builder has never been run against real data. Before trusting it in
CI, run it against a local checkout of the guides repo:

    git clone https://github.com/rndfunction/SideboardGuides
    cd SideboardGuides
    cp /path/to/deploy/index_builder.py .
    python3 index_builder.py --manifest manifest.json --guides guides --out /tmp/test-index.json
    cat /tmp/test-index.json

Check the output:

- `"version": 2` at the top.
- One `archetypes` entry per `(format, archetypeKey)` group in the
  manifest.
- Each entry's `cardFrequency` lists the mainboard cards with sensible
  `inclusion` values, and `boardInMatrix` lists board-in cards per matchup.
- `guideCount` matches the number of guides in that archetype.

If it errors or the output looks wrong, that is the moment to fix it —
not after it is wired into CI. The script is standalone, so iterating on
it locally is just edit-and-rerun.

### Step 2 — commit both files

    cp /path/to/deploy/index_builder.py index_builder.py
    cp /path/to/deploy/submit-guide.yml .github/workflows/submit-guide.yml
    git add index_builder.py .github/workflows/submit-guide.yml
    git commit -m "Add archetype index producer"
    git push

## What to verify after the first real submission

- The PR contains three changed files: the guide, `manifest.json`, and
  `archetypes.json`.
- `archetypes.json` has `"version": 2` and entries matching the manifest's
  `archetypeKey` values.
- The client, once the PR is merged, shows the archetype view sourced from
  the real index rather than the demo fixture. (The client tries the remote
  index, then a local mirror, then the demo file. Once the real one exists,
  the demo is never reached, and the "index: demo" label disappears.)
- `validate-guide.yml` still passes. It validates the guide file only and
  is unaffected by the new manifest fields or by `archetypes.json`.

## Why these live here and not there

The producer is a contract between two repositories: the client consumes
`archetypes.json`, the Action produces it, and the spec describes it. The
spec lives in this repo's `docs/`. Keeping the implementation next to the
spec means a change to the algorithm and a change to the contract are one
commit apart, which is where they should be. These files are the source of
truth for what belongs in the guides repo; copy them over when deploying.