// Reactive store for the sideboard guide builder.
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

// Cards that see play in decks of a color they aren't. These are excluded
// from the deck's color derivation because their printed colors don't
// reflect how the deck actually casts them. Comparison is case-insensitive
// on the card's name. See the docstring in enrich() for background.
const COLOR_AGNOSTIC_CARDS = new Set([
  "sneaky snacker" // Dimir card played via its Red madness cost in Mono-Red Madness
]);

export const store = Vue.reactive({
  rawText: "",
  parsed: null,       // { mainboard, sideboard, unparsed }
  enriched: null,     // { mainboard, sideboard, stats } with card metadata attached
  matchups: [],       // ["Jund", "Tron", ...]
  // Plan storage: section-aware keys. Each entry is:
  //   plan[cardName + "@main" | cardName + "@side"][matchupName] = { dir, count }
  // The section suffix is what lets a card that appears in both the main
  // and the side have independent plans for each copy.
  plan: {},
  deckName: "",       // user-editable title card name
  deckNameWasEdited: false, // true once the user manually sets a name
  loading: false,
  error: null,
  status: "",         // user-facing progress text
  // Hover preview state (driven by any component; rendered by CardPreview).
  hoveredCard: null,        // { image, name } | null
  hoveredCardPos: { x: 0, y: 0 },
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
  store.enriched = enrich(store.parsed, new Map());
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
    // Re-key any existing plan entries from the old (name-only) format
    // to the new section-aware format. This is a best-effort migration:
    // if a card is in the main, the old entry becomes name@main; if in
    // side, name@side; if both, we duplicate into both so the user can
    // adjust. Fresh data doesn't need this.
    migratePlanKeys();
    ensurePlanEntries(store.enriched);
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

  // Deck colors: union of the *colors* field on nonland mainboard cards,
  // EXCEPT cards on the COLOR_AGNOSTIC_CARDS list.
  //
  // Lands are excluded too: fetches, duals, and utility lands would
  // otherwise drag in off-color identities.
  const WUBRG = ["W", "U", "B", "R", "G"];
  const colorSet = new Set();
  for (const e of mainboard) {
    if (!e.card) continue;
    if (COLOR_AGNOSTIC_CARDS.has((e.name || "").toLowerCase())) continue;
    const tl = e.card.type_line || "";
    if (/(^|\s)land(\s|$)/i.test(tl)) continue;
    const src = (Array.isArray(e.card.colors) && e.card.colors.length)
      ? e.card.colors
      : (e.card.color_identity || []);
    for (const c of src) colorSet.add(c);
  }
  const sortedColors = WUBRG.filter((c) => colorSet.has(c));

  // Mana curve: buckets 0..7+ by cmc, counting maindeck only, non-lands.
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
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
      colors: sortedColors,
      curve,
      nonlandCount,
      landCount,
      missing: Array.from(new Set(missing))
    }
  };
}

/**
 * Ensure plan has a per-section entry object for every card.
 * Keys are cardName + "@main" or cardName + "@side".
 */
function ensurePlanEntries(enriched) {
  for (const e of enriched.mainboard) {
    const key = e.name + "@main";
    if (!store.plan[key]) store.plan[key] = {};
  }
  for (const e of enriched.sideboard) {
    const key = e.name + "@side";
    if (!store.plan[key]) store.plan[key] = {};
  }
}

/**
 * Pure helper: given a plan object (possibly with legacy name-only keys)
 * and an enriched deck, return a NEW plan object with section-aware keys.
 *
 * If a card exists in both sections, the legacy entry is duplicated into
 * both the "@main" and "@side" variants so each copy can be adjusted
 * independently after import. Keys already ending in "@main" or "@side"
 * are passed through untouched. Input is never mutated.
 *
 * This is the imported-share counterpart to migratePlanKeys(); the two
 * share the same key-shape contract but this one has no store side
 * effects, so it can be called from onImportShare without racing the
 * reactive state.
 */
export function normalizePlanKeys(plan, enriched) {
  const src = plan && typeof plan === "object" ? plan : {};
  if (!enriched) {
    // No deck context to disambiguate sections: pass through unchanged.
    return JSON.parse(JSON.stringify(src));
  }
  const inMain = new Set((enriched.mainboard || []).map((e) => e.name));
  const inSide = new Set((enriched.sideboard || []).map((e) => e.name));
  const out = {};
  for (const key of Object.keys(src)) {
    const data = src[key];
    if (/@(main|side)$/.test(key)) {
      out[key] = { ...data };
      continue;
    }
    let placed = false;
    if (inMain.has(key)) { out[key + "@main"] = { ...data }; placed = true; }
    if (inSide.has(key)) { out[key + "@side"] = { ...data }; placed = true; }
    // If the card isn't in either section (stale entry), drop it silently
    // rather than inventing a section for it.
    if (!placed) continue;
  }
  return out;
}

/**
 * One-shot migration: rewrite any old (name-only) plan keys into the new
 * section-aware format, IN PLACE on store.plan.
 *
 * Delegates to normalizePlanKeys() for the actual rewrite so the two
 * paths can never drift. Runs on every deck load. Cheap (a few object
 * key traversals) and idempotent — keys already ending in "@main" or
 * "@side" are skipped.
 */
function migratePlanKeys() {
  if (!store.enriched) return;
  store.plan = normalizePlanKeys(store.plan, store.enriched);
}

/**
 * Build the storage key for a card in a given section.
 * section is "main" or "side". Internal helper.
 */
function planKey(cardName, section) {
  return cardName + "@" + section;
}

/**
 * Return copies of a card in the given section only. If section is
 * omitted, returns the total across both sections (legacy behavior).
 */
export function copiesFor(cardName, section) {
  if (!store.enriched) return 0;
  let total = 0;
  const visit = (list, s) => {
    if (section && s !== section) return;
    for (const e of list) {
      if (e.name === cardName) total += e.count;
    }
  };
  visit(store.enriched.mainboard, "main");
  visit(store.enriched.sideboard, "side");
  return total;
}

/**
 * Read the current plan entry for a cell. Section is "main" or "side".
 * Returns { dir, count } | null. Internal helper used by cycleCard.
 */
function getCardPlan(cardName, matchupName, section) {
  const key = planKey(cardName, section);
  const entry = store.plan[key] && store.plan[key][matchupName];
  if (!entry) return null;
  if (typeof entry === "string") {
    // Very old format: { "in" | "out" }. We don't auto-migrate these;
    // they only appear in ancient localStorage saves and would need
    // manual cleanup. Return a normalized shape for display.
    const copies = copiesFor(cardName, section) || 1;
    return { dir: entry, count: copies };
  }
  return entry;
}

/**
 * Cycle a cell. Direction is fixed by section:
 *   main section:   null -> OUT(all) -> null
 *   side section:   null -> IN(all)  -> null
 */
export function cycleCard(cardName, matchupName, section) {
  const s = section === "side" ? "side" : "main";
  const key = planKey(cardName, s);
  if (!store.plan[key]) store.plan[key] = {};
  const cur = getCardPlan(cardName, matchupName, s);
  const copies = copiesFor(cardName, s) || 1;
  const dir = s === "main" ? "out" : "in";

  let next = null;
  if (cur === null) next = { dir, count: copies };
  else if (cur.dir === dir) next = null;
  else next = { dir, count: copies };

  if (next === null) delete store.plan[key][matchupName];
  else store.plan[key][matchupName] = next;
}

/**
 * Set an explicit plan for a cell. Pass dir=null to clear.
 * count is clamped to 1..copies in that section.
 * Direction is coerced to the section's valid one (main=out, side=in).
 */
export function setCardPlan(cardName, matchupName, dir, count, section) {
  const s = section === "side" ? "side" : "main";
  const key = planKey(cardName, s);
  if (!store.plan[key]) store.plan[key] = {};
  if (!dir) {
    delete store.plan[key][matchupName];
    return;
  }
  const correctDir = s === "main" ? "out" : "in";
  const max = copiesFor(cardName, s) || 1;
  const c = Math.max(1, Math.min(max, count || max));
  store.plan[key][matchupName] = { dir: correctDir, count: c };
}

export function addMatchup(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const cased = titleCase(trimmed);
  if (store.matchups.includes(cased)) return;
  store.matchups.push(cased);
}

/**
 * Rename a matchup, migrating all plan entries from the old name to the new.
 */
export function renameMatchup(oldName, newName) {
  const cased = titleCase(newName);
  if (!cased) return;
  if (oldName === cased) return;
  if (store.matchups.includes(cased)) return;
  const idx = store.matchups.indexOf(oldName);
  if (idx < 0) return;
  store.matchups.splice(idx, 1, cased);
  for (const key of Object.keys(store.plan)) {
    const cardPlan = store.plan[key];
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

export function removeMatchup(name) {
  const i = store.matchups.indexOf(name);
  if (i >= 0) store.matchups.splice(i, 1);
  for (const key of Object.keys(store.plan)) {
    if (store.plan[key]) delete store.plan[key][name];
  }
}

