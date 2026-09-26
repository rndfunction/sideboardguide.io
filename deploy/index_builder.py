#!/usr/bin/env python3
"""
Build archetypes.json from manifest.json and the guide files.

This is the canonical implementation of the archetype index producer
described in docs/archetype-index-spec.md. It is meant to be copied into
the guides repository (rndfunction/SideboardGuides) and run by the
submit-guide GitHub Action after a new guide is written and the manifest
is updated. It has no dependencies beyond the Python standard library.

Usage:
    python3 index_builder.py [--manifest manifest.json] [--guides guides]

Reads the manifest, reads every referenced guide file, and writes
archetypes.json next to the manifest.
"""

import argparse
import collections
import datetime
import json
import pathlib
import re
import sys


# --- Parser grammar (must match js/parser.js) ------------------------------

CARD_LINE = re.compile(r'^(\d+)\s*[xX]?\s+(.+?)\s*$')
SIDEBOARD_HDR = re.compile(r'^(sideboard|sb|side board)\s*:?\s*$', re.I)
SECTION_HDR = re.compile(r'^(maindeck|main deck|main|deck)\s*:?\s*$', re.I)
COMMENT_LINE = re.compile(r'^\s*(//|#|$)')

# Set code + collector number suffix, e.g. " (thb) 253" or " (2X2) 117".
# Case-insensitive so lowercase Arena/Moxfield set codes are stripped too.
SET_SUFFIX = re.compile(r'\s+\([A-Za-z0-9]{2,6}\)(?:\s+\S+)?\s*$')
FOIL_MARKER = re.compile(r'\s*\*F\*|\s*\bFOIL\b', re.I)


def slugify(s):
    s = (s or "").strip().lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def mainboard_cards(raw_text):
    """Return {card_name: copies} for the mainboard only.

    Mirrors the maindeck/sideboard heuristic in js/parser.js: an explicit
    sideboard header wins; otherwise a trailing blank-line-separated block
    is sideboard only if it sums to <= 20 and the first block sums to >= 40.
    """
    lines = (raw_text or "").split("\n")
    runs = []
    current = []
    explicit_side = False
    for line in lines:
        t = line.strip()
        if not t:
            if current:
                runs.append(current)
                current = []
            continue
        if COMMENT_LINE.match(t):
            continue
        if SIDEBOARD_HDR.match(t):
            explicit_side = True
            if current:
                runs.append(current)
                current = []
            continue
        if SECTION_HDR.match(t):
            if current:
                runs.append(current)
                current = []
            continue
        current.append(t)
    if current:
        runs.append(current)

    def total(run):
        n = 0
        for l in run:
            m = CARD_LINE.match(l)
            if m:
                n += int(m.group(1))
        return n

    if explicit_side and len(runs) >= 1:
        main_runs = runs[:-1] if len(runs) > 1 else runs[:1]
    elif len(runs) == 2:
        if total(runs[1]) <= 20 and total(runs[0]) >= 40:
            main_runs = [runs[0]]
        else:
            main_runs = runs
    else:
        main_runs = runs

    cards = collections.Counter()
    for run in main_runs:
        for line in run:
            m = CARD_LINE.match(line)
            if not m:
                continue
            count = int(m.group(1))
            name = SET_SUFFIX.sub('', m.group(2))
            name = FOIL_MARKER.sub('', name).strip()
            if not name:
                continue
            cards[name] += count
    return dict(cards)


def board_in_by_matchup(plan):
    """Return {matchup: {card_name: [counts]}} for cards boarded IN.

    `plan` is a guide's plan object: plan[cardKey][matchup] = {dir, count}.
    cardKey is "name@side" for sideboard cards. Only dir == "in" is
    counted (v2 covers board-IN only; board-OUT is not aggregated).
    """
    out = collections.defaultdict(lambda: collections.defaultdict(list))
    if not isinstance(plan, dict):
        return out
    for key, by_matchup in plan.items():
        if not isinstance(by_matchup, dict):
            continue
        # Only sideboard cards board in; main cards board out. We key on
        # the "@side" suffix but also accept a bare name defensively.
        if "@main" in key:
            continue
        name = key.split("@")[0]
        for matchup, entry in by_matchup.items():
            if not entry:
                continue
            if isinstance(entry, dict) and entry.get("dir") != "in":
                continue
            count = entry.get("count") if isinstance(entry, dict) else 0
            out[matchup][name].append(int(count) if count else 0)
    return out


def weighted_jaccard(a_cards, b_cards):
    keys = set(a_cards) | set(b_cards)
    if not keys:
        return 1.0
    num = sum(min(a_cards.get(k, 0), b_cards.get(k, 0)) for k in keys)
    den = sum(max(a_cards.get(k, 0), b_cards.get(k, 0)) for k in keys)
    return num / den if den else 1.0


def build_index(manifest, guides_dir):
    buckets = collections.defaultdict(list)
    for entry in manifest.get("guides", []):
        key = entry.get("archetypeKey") or slugify(entry.get("archetype"))
        fmt = entry.get("format") or ""
        if not key:
            continue
        buckets[(fmt, key)].append(entry)

    archetypes = []
    for (fmt, key), entries in buckets.items():
        loaded = []
        for e in entries:
            p = pathlib.Path(guides_dir) / e["file"]
            if not p.exists():
                continue
            try:
                guide = json.loads(p.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            raw = (guide.get("deck") or {}).get("rawText") or ""
            loaded.append({
                "entry": e,
                "guide": guide,
                "cards": mainboard_cards(raw),
                "plan": guide.get("plan") or {},
            })
        if not loaded:
            continue

        n = len(loaded)

        # --- cardFrequency ---
        names = set()
        for g in loaded:
            names.update(g["cards"].keys())
        freq = []
        for name in names:
            containing = sum(1 for g in loaded if name in g["cards"])
            total_copies = sum(g["cards"].get(name, 0) for g in loaded)
            freq.append({
                "name": name,
                "inclusion": round(containing / n, 4),
                "avgCopies": round(total_copies / n, 4),
            })
        freq.sort(key=lambda x: (-x["inclusion"], x["name"]))

        # --- core + per-guide overlap ---
        core_names = {f["name"] for f in freq if f["inclusion"] >= 0.8}
        core_ideal = {}
        for name in core_names:
            core_ideal[name] = max(g["cards"].get(name, 0) for g in loaded)

        guides_out = []
        for g in loaded:
            guides_out.append({
                "file": g["entry"]["file"],
                "author": g["entry"].get("author") or "",
                "verified": bool(g["entry"].get("verified")),
                "lastEditedAt": g["entry"].get("lastEditedAt")
                    or g["entry"].get("createdAt") or "",
                "overlapWithCore": round(weighted_jaccard(g["cards"], core_ideal), 4),
            })
        guides_out.sort(key=lambda x: (-x["overlapWithCore"],
                                       _desc_str(x["lastEditedAt"]),
                                       x["file"]))

        # --- boardInMatrix (v2) ---
        # Aggregate across guides: per matchup, per card, inclusion is the
        # fraction of guides (all of them) that board it in; avgCopies is
        # the mean across the guides that do.
        per_matchup = collections.defaultdict(lambda: collections.defaultdict(list))
        matchup_names = set()
        for g in loaded:
            matrix = board_in_by_matchup(g["plan"])
            for matchup, cards in matrix.items():
                matchup_names.add(matchup)
                for card, counts in cards.items():
                    per_matchup[matchup][card].extend(counts)

        board_in = {}
        for matchup in sorted(matchup_names):
            card_entries = []
            for card, counts in per_matchup[matchup].items():
                appearing = len(counts)
                card_entries.append({
                    "name": card,
                    "inclusion": round(appearing / n, 4),
                    "avgCopies": round(sum(counts) / appearing, 4) if appearing else 0.0,
                })
            card_entries.sort(key=lambda x: (-x["inclusion"], -x["avgCopies"], x["name"]))
            if card_entries:
                board_in[matchup] = card_entries

        # --- name: most common archetype string in the bucket ---
        name_counts = collections.Counter(
            (g["entry"].get("archetype") or "") for g in loaded
        )
        common_name = sorted(name_counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] or key

        tag_set = set()
        for g in loaded:
            for t in (g["entry"].get("tags") or []):
                tag_set.add(t)

        archetypes.append({
            "key": key,
            "name": common_name,
            "format": fmt,
            "guideCount": n,
            "cardFrequency": freq,
            "boardInMatrix": board_in,
            "tags": sorted(tag_set),
            "guides": guides_out,
        })

    archetypes.sort(key=lambda a: (a["format"], -a["guideCount"], a["key"]))
    return {
        "version": 2,
        "lastUpdated": datetime.date.today().isoformat(),
        "archetypes": archetypes,
    }


def _desc_str(s):
    # Sort ISO date strings descending without reversing the string.
    return tuple(-ord(c) for c in (s or ""))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build archetypes.json.")
    ap.add_argument("--manifest", default="manifest.json")
    ap.add_argument("--guides", default="guides")
    ap.add_argument("--out", default="archetypes.json")
    args = ap.parse_args(argv)

    manifest_path = pathlib.Path(args.manifest)
    if not manifest_path.exists():
        print("manifest not found: " + args.manifest, file=sys.stderr)
        return 1

    try:
        manifest = json.loads(manifest_path.read_text())
    except json.JSONDecodeError as e:
        print("manifest is not valid JSON: " + str(e), file=sys.stderr)
        return 1

    index = build_index(manifest, args.guides)
    pathlib.Path(args.out).write_text(json.dumps(index, indent=2) + "\n")
    print("wrote " + args.out + " with " + str(len(index["archetypes"])) + " archetype(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())