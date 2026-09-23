// Reactive store for the deck guide builder.
// Wires parser + Scryfall lookups into a shape the components consume.
//
// NOTE: FORGE's preview sandbox resolves bare-URL ESM imports relative to the
// importing file's directory (via its VFS), which breaks `import ... from "https://..."`.
// So we load Vue as a global via a <script> tag in index.html and pull `reactive`
// off `window.Vue` here. See /js/app.js for the matching pattern.

import { parseDecklist, sumCounts, uniqueNames } from "./parser.js";
import { lookupCards } from "./scryfall.js";
import { identifyDeck } from "./archetype.js";
import { titleCase } from "./persistence.js";

const Vue = window.Vue;
if (!Vue || typeof Vue.reactive !== "function") {
  throw new Error("Vue global not found. Ensure /index.html loads vue.global.prod.js before /js/app.js.");
}

export const store = Vue.reactive({
  rawText: "",
  parsed: null,       // { mainboard, sideboard, unparsed }
  enriched: null,     // { mainboard, sideboard, stats } with card metadata attached
  matchups: [],       // ["Jund", "Tron", ...]
  plan: {},           // plan[cardName][matchupName] = { dir, count } | null
  deckName: "",       // user-editable title card name
  deckNameWasEdited: false, // true once the user manually sets a name
  loading: false,
  error: null,
  status: "",         // user-facing progress text
  _lastMatchupId: 0
});

export async function loadDecklist(text) {
  store.error = null;
  store.status = "";
  store.rawText = text;
  store.parsed = parseDecklist(text);
  store.enriched = null;

  if (store.parsed.unparsed.length && !store.parsed.mainboard.length) {
    store.error = "Couldn't parse any cards. Try lines like: 4 Lightning Bolt";
    return;
  }

  const names = uniqueNames(store.parsed);
  if (!names.length) {
    store.error = "No cards found in decklist.";
    return;
  }

  store.loading = true;
  store.status = "Looking up " + names.length + " cards...";
  try {
    const map = await lookupCards(names, ({ phase, done, total }) => {
      if (phase === "cache") {
        store.status = "Checking cache... " + done + "/" + total;
      } else {
        store.status = "Fetching from Scryfall... " + done + "/" + total;
      }
    });
    store.enriched = enrich(store.parsed, map);
    const missing = store.enriched.stats.missing;
    if (missing.length) {
      store.status = "Loaded. " + missing.length + " card(s) not found on Scryfall.";
    } else {
      store.status = "Loaded " + names.length + " cards.";
    }
    // Ensure plan has entries for new cards.
    ensurePlanEntries(store.enriched);
    // Auto-derive a default deck name if the user hasn't set one.
    if (!store.deckName || !store.deckNameWasEdited) {
      store.deckName = identifyDeck(store.enriched);
      store.deckNameWasEdited = false;
    }
  } catch (err) {
    store.error = "Lookup failed: " + (err && err.message ? err.message : String(err));
  } finally {
    store.loading = false;
  }
}

function attachCard(entry, map) {
  const card = map.get(entry.name) || null;
  return { ...entry, card };
}

function enrich(parsed, map) {
  const mainboard = parsed.mainboard.map((e) => attachCard(e, map));
  const sideboard = parsed.sideboard.map((e) => attachCard(e, map));
  const missing = [];
  for (const e of [...mainboard, ...sideboard]) {
    if (!e.card) missing.push(e.name);
  }

  // Color identity across the deck (union of color_identity on main cards).
  const colorSet = new Set();
  for (const e of mainboard) {
    if (e.card && e.card.color_identity) {
      for (const c of e.card.color_identity) colorSet.add(c);
    }
  }

  // Mana curve: buckets 0..7+ by cmc, counting maindeck only, non-lands.
  const curve = [0, 0, 0, 0, 0, 0, 0, 0]; // index 0..6, 7 = 7+
  let nonlandCount = 0;
  let landCount = 0;
  for (const e of mainboard) {
    if (!e.card) continue;
    const isLand = /(^|\s)land(\s|$)/i.test(e.card.type_line);
    if (isLand) { landCount += e.count; continue; }
    nonlandCount += e.count;
    const cmc = Math.min(7, Math.max(0, Math.round(e.card.cmc || 0)));
    curve[cmc] += e.count;
  }

  const totalMain = sumCounts(mainboard);
  const totalSide = sumCounts(sideboard);

  return {
    mainboard,
    sideboard,
    stats: {
      totalMain,
      totalSide,
      colors: Array.from(colorSet).sort(),
      curve,
      nonlandCount,
      landCount,
      missing: Array.from(new Set(missing))
    }
  };
}

function ensurePlanEntries(enriched) {
  const allCards = [...enriched.mainboard, ...enriched.sideboard];
  for (const e of allCards) {
    if (!store.plan[e.name]) store.plan[e.name] = {};
  }
}

export function addMatchup(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const cased = titleCase(trimmed);
  if (store.matchups.includes(cased)) return;
  store.matchups.push(cased);
}

/**
 * Rename a matchup, migrating all plan entries from the old name to the new one.
 */
export function renameMatchup(oldName, newName) {
  const cased = titleCase(newName);
  if (!cased) return;
  if (oldName === cased) return;
  if (store.matchups.includes(cased)) return;
  const idx = store.matchups.indexOf(oldName);
  if (idx < 0) return;
  store.matchups.splice(idx, 1, cased);
  for (const card of Object.keys(store.plan)) {
    const cardPlan = store.plan[card];
    if (cardPlan && Object.prototype.hasOwnProperty.call(cardPlan, oldName)) {
      cardPlan[cased] = cardPlan[oldName];
      delete cardPlan[oldName];
    }
  }
}

/**
 * Set the deck name with titlecase applied.
 * Marks the name as user-edited so future auto-naming won't clobber it.
 */
export function setDeckName(name) {
  const cased = titleCase(name);
  store.deckName = cased;
  store.deckNameWasEdited = true;
}

/**
 * Clear the "user edited" flag so the next parse re-derives the name.
 */
export function resetDeckName() {
  store.deckNameWasEdited = false;
}

export function removeMatchup(name) {
  const i = store.matchups.indexOf(name);
  if (i >= 0) store.matchups.splice(i, 1);
  for (const card of Object.keys(store.plan)) {
    if (store.plan[card]) delete store.plan[card][name];
  }
}

/**
 * Look up the deck count for a card (main + side, summed across duplicates).
 * Returns 0 if unknown.
 */
export function copiesFor(cardName) {
  if (!store.enriched) return 0;
  let total = 0;
  for (const e of store.enriched.mainboard) {
    if (e.name === cardName) total += e.count;
  }
  for (const e of store.enriched.sideboard) {
    if (e.name === cardName) total += e.count;
  }
  return total;
}

/**
 * Read the current plan entry for a cell, normalized to { dir, count } | null.
 */
export function getCardPlan(cardName, matchupName) {
  const entry = store.plan[cardName] && store.plan[cardName][matchupName];
  if (!entry) return null;
  if (typeof entry === "string") {
    // Legacy format from earlier versions: just "in" or "out".
    const copies = copiesFor(cardName) || 1;
    return { dir: entry, count: copies };
  }
  return entry;
}

/**
 * Determine whether a card is in the maindeck (true) or sideboard (false).
 * Falls back to maindeck if unknown.
 */
export function isMaindeckCard(cardName) {
  if (!store.enriched) return true;
  for (const e of store.enriched.mainboard) {
    if (e.name === cardName) return true;
  }
  return false;
}

/**
 * Cycle a cell. Direction is fixed by which half of the deck the card
 * belongs to:
 *   Maindeck card:   null -> OUT(all) -> null
 *   Sideboard card:  null -> IN(all)  -> null
 *
 * Maindeck cards are always boarded OUT (never IN), and sideboard cards are
 * always boarded IN (never OUT). The only variable is how many copies, which
 * the user sets via the popover (right-click / pencil chip).
 *
 * `section` is optional ("main" | "side"). If omitted, we look it up.
 */
export function cycleCard(cardName, matchupName, section) {
  if (!store.plan[cardName]) store.plan[cardName] = {};
  const cur = getCardPlan(cardName, matchupName);
  const copies = copiesFor(cardName) || 1;

  const isMain = section === "main" ? true
              : section === "side" ? false
              : isMaindeckCard(cardName);

  const dir = isMain ? "out" : "in";

  let next = null;
  if (cur === null) next = { dir, count: copies };
  else if (cur.dir === dir) next = null; // second click clears
  else next = { dir, count: copies }; // wrong dir stored? coerce to correct.

  if (next === null) delete store.plan[cardName][matchupName];
  else store.plan[cardName][matchupName] = next;
}

/**
 * Set an explicit plan for a cell. Pass dir=null to clear.
 * count is clamped to 1..copies.
 *
 * The direction is coerced to the correct one for the card's section:
 * maindeck cards can only be OUT, sideboard cards can only be IN. This
 * keeps the data model honest even if a caller passes the wrong dir.
 */
export function setCardPlan(cardName, matchupName, dir, count) {
  if (!store.plan[cardName]) store.plan[cardName] = {};
  if (!dir) {
    delete store.plan[cardName][matchupName];
    return;
  }
  const isMain = isMaindeckCard(cardName);
  const correctDir = isMain ? "out" : "in";
  const max = copiesFor(cardName) || 1;
  const c = Math.max(1, Math.min(max, count || max));
  store.plan[cardName][matchupName] = { dir: correctDir, count: c };
}

/**
 * Backwards-compatible alias for older callers.
 * @deprecated Use cycleCard instead.
 */
export function toggleCard(cardName, matchupName) {
  cycleCard(cardName, matchupName);
}