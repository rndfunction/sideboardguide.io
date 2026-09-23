// Card lookup: Scryfall first, local DB fallback.
//
// FORGE's preview sandbox enforces a CSP that blocks api.scryfall.com, so
// in that environment every network call fails and we fall back to
// /js/carddb.js for the cards we know about. When the app runs on a
// normal origin, Scryfall returns full metadata (images, oracle text, etc.)
// and the local DB is only consulted for cards Scryfall doesn't know.
//
// Flow for lookupCards(names):
//   1. Check localStorage cache.
//   2. Try Scryfall in batches of 75 (with throttling).
//   3. For any name Scryfall didn't return (or if the whole fetch failed),
//      consult the local DB.
//   4. Cache whatever we found.

import { findLocal } from "./carddb.js";

const API_BASE = "https://api.scryfall.com";
const CACHE_PREFIX = "mtg-deck-guide:card:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const BATCH_SIZE = 75;
const THROTTLE_MS = 100;

function cacheKey(name) {
  return CACHE_PREFIX + name.trim().toLowerCase();
}

function readCache(name) {
  try {
    const raw = localStorage.getItem(cacheKey(name));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.t || Date.now() - entry.t > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(name));
      return null;
    }
    return entry.card || null;
  } catch (_) {
    return null;
  }
}

function writeCache(name, card) {
  try {
    localStorage.setItem(cacheKey(name), JSON.stringify({ t: Date.now(), card }));
  } catch (_) {
    // Storage full or disabled; ignore.
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCard(card) {
  if (!card) return null;
  return {
    id: card.id,
    name: card.name,
    mana_cost: card.mana_cost || "",
    cmc: typeof card.cmc === "number" ? card.cmc : 0,
    type_line: card.type_line || "",
    oracle_text: card.oracle_text || "",
    colors: card.colors || [],
    color_identity: card.color_identity || [],
    rarity: card.rarity || "",
    set: card.set || "",
    set_name: card.set_name || "",
    image_normal: (card.image_uris && card.image_uris.normal) || "",
    image_small: (card.image_uris && card.image_uris.small) || "",
    scryfall_uri: card.scryfall_uri || "",
    layout: card.layout || "normal",
    source: "scryfall"
  };
}

async function fetchBatch(names) {
  const body = { identifiers: names.map((n) => ({ name: n })) };
  const res = await fetch(API_BASE + "/cards/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error("Scryfall returned " + res.status + " " + res.statusText);
  }
  return res.json();
}

/**
 * Look up many card names. Returns Map<name, normalizedCard|null>.
 * Scryfall first, local DB fallback per-card.
 */
export async function lookupCards(names, onProgress) {
  const result = new Map();
  const misses = [];
  let cachedCount = 0;

  // 1. Cache pass.
  for (const name of names) {
    const hit = readCache(name);
    if (hit) {
      result.set(name, hit);
      cachedCount++;
    } else {
      misses.push(name);
    }
  }

  const total = names.length;
  let done = cachedCount;
  if (onProgress) onProgress({ phase: "cache", done, total });

  // 2. Batch Scryfall fetches, tolerating failure of any batch.
  const batches = [];
  for (let i = 0; i < misses.length; i += BATCH_SIZE) {
    batches.push(misses.slice(i, i + BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (bi > 0) await sleep(THROTTLE_MS);

    let payload = null;
    try {
      payload = await fetchBatch(batch);
    } catch (err) {
      // Mark batch as failed; local fallback will cover.
      payload = null;
      if (onProgress) onProgress({ phase: "fetch-error", done, total, error: String(err) });
    }

    if (payload && Array.isArray(payload.data)) {
      const foundByName = new Map();
      for (const raw of payload.data) {
        const card = normalizeCard(raw);
        if (card) foundByName.set(card.name.toLowerCase(), card);
      }
      for (const name of batch) {
        const card = foundByName.get(name.trim().toLowerCase()) || null;
        if (card) {
          result.set(name, card);
          writeCache(name, card);
        }
        // If not found here, leave it unresolved so the local DB pass picks it up.
      }
    }

    done += batch.length;
    if (onProgress) onProgress({ phase: "fetch", done, total, batch: bi + 1, batches: batches.length });
  }

  // 3. Local DB fallback for anything still unresolved.
  let localHits = 0;
  for (const name of names) {
    if (result.has(name)) continue;
    const card = findLocal(name);
    if (card) {
      result.set(name, card);
      localHits++;
      // Do NOT write local hits to the persistent cache; if network comes
      // back later we want to re-query Scryfall for richer data.
    } else {
      result.set(name, null);
    }
  }

  if (onProgress) onProgress({ phase: "local", done: total, total, localHits });
  return result;
}

export function clearCache() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}