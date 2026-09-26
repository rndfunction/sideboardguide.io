// Community guides: fetch from the SideboardGuides GitHub repo, with an
// in-memory fallback that always works (even when the network or the
// FORGE preview sandbox blocks remote fetches).
//
// The guides live in a separate repo (rndfunction/SideboardGuides) served
// via raw.githubusercontent.com, which sets CORS-friendly headers so any
// HTTPS origin can fetch. Pages is not required.

const GUIDES_BASE_URL = "https://raw.githubusercontent.com/rndfunction/SideboardGuides/main";

// -----------------------------------------------------------------------
// Built-in fallback: a small in-memory mirror of the guides repo. Used
// when neither the remote nor the local file fetch succeeds. This is
// what makes the browse view work in sandboxed previews.
// -----------------------------------------------------------------------

const FALLBACK_MANIFEST = {
  version: 1,
  lastUpdated: "2026-09-24",
  guides: [
    {
      file: "mono-red-burn-modern.json",
      deckName: "Mono-Red Burn",
      format: "Modern",
      archetype: "Mono-Red Burn",
      author: "rndfunction",
      createdAt: "2026-09-24"
    }
  ]
};

const FALLBACK_GUIDE_BODIES = {
  "mono-red-burn-modern.json": (function () {
    const rawDeck = [
      "4 Monastery Swiftspear",
      "4 Soul-Scar Mage",
      "4 Lightning Bolt",
      "4 Lava Spike",
      "4 Rift Bolt",
      "4 Skewer the Critics",
      "4 Eidolon of the Great Revel",
      "4 Searing Blaze",
      "4 Mountain",
      "4 Arid Mesa",
      "4 Scalding Tarn",
      "4 Ramunap Ruins",
      "4 Fiery Islet",
      "8 Snow-Covered Mountain",
      "",
      "4 Roiling Vortex",
      "3 Skullcrack",
      "3 Blood Moon",
      "3 Anger of the Gods",
      "2 Deflecting Palm"
    ].join("\n");

    return {
      format: "mtg-sideboard-guide",
      version: 1,
      generator: "Sideboard Guide Builder",
      createdAt: "2026-09-24T00:00:00.000Z",
      deck: {
        name: "Mono-Red Burn",
        format: "Modern",
        archetype: "Mono-Red Burn",
        rawText: rawDeck
      },
      matchups: ["Murktide", "Amulet Titan", "Rhinos"],
      // Plan keys are section-aware: name + "@main" | name + "@side".
      // Matches what store.js writes and what DeckGrid/PrintView read.
      plan: {
        "Searing Blaze@main": {
          "Murktide": { dir: "out", count: 3 },
          "Amulet Titan": { dir: "out", count: 2 },
          "Rhinos": { dir: "out", count: 1 }
        },
        "Skewer the Critics@main": {
          "Murktide": { dir: "out", count: 2 }
        },
        "Monastery Swiftspear@main": {
          "Amulet Titan": { dir: "out", count: 4 }
        },
        "Eidolon of the Great Revel@main": {
          "Rhinos": { dir: "out", count: 3 }
        },
        "Roiling Vortex@side": {
          "Murktide": { dir: "in", count: 3 }
        },
        "Blood Moon@side": {
          "Murktide": { dir: "in", count: 2 },
          "Amulet Titan": { dir: "in", count: 3 }
        },
        "Deflecting Palm@side": {
          "Amulet Titan": { dir: "in", count: 3 }
        },
        "Anger of the Gods@side": {
          "Rhinos": { dir: "in", count: 3 }
        },
        "Skullcrack@side": {
          "Rhinos": { dir: "in", count: 1 }
        }
      },
      titleCard: {
        color: "#8a2a1a",
        fontKey: "cinzel",
        symbol: "auto",
        texture: "none",
        intensity: "medium"
      }
    };
  })()
};

async function fetchJson(url, timeoutMs) {
  // Guard against hanging fetches in sandboxed environments: race with a
  // short timeout so we fall through to the built-in fallback quickly.
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs || 4000);
  });
  const doFetch = fetch(url, { cache: "no-cache", signal: controller ? controller.signal : undefined });
  try {
    const res = await Promise.race([doFetch, timeout]);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * List all guides. Tries remote, then local file, then built-in fallback.
 * Returns { guides: [...], source: "remote"|"local"|"fallback" }.
 */
export async function listGuides() {
  try {
    const data = await fetchJson(GUIDES_BASE_URL + "/manifest.json", 4000);
    if (data && Array.isArray(data.guides) && data.guides.length) {
      return { guides: data.guides, source: "remote" };
    }
  } catch (_) { /* fall through */ }

  try {
    const data = await fetchJson("guides/manifest.json", 2000);
    if (data && Array.isArray(data.guides) && data.guides.length) {
      return { guides: data.guides, source: "local" };
    }
  } catch (_) { /* fall through */ }

  return { guides: FALLBACK_MANIFEST.guides.slice(), source: "fallback" };
}

/**
 * Load a single guide by filename. Tries remote, then local file, then
 * built-in fallback.
 */
export async function loadGuide(file) {
  if (!file || typeof file !== "string" || /[^a-z0-9._\-]/i.test(file)) {
    throw new Error("Invalid guide filename");
  }
  try {
    return await fetchJson(GUIDES_BASE_URL + "/guides/" + file, 4000);
  } catch (_) { /* fall through */ }

  try {
    return await fetchJson("guides/" + file, 2000);
  } catch (_) { /* fall through */ }

  const fallback = FALLBACK_GUIDE_BODIES[file];
  if (fallback) {
    // Deep clone so callers can't mutate the shared in-memory object.
    return JSON.parse(JSON.stringify(fallback));
  }
  throw new Error("Guide not found: " + file);
}

// -----------------------------------------------------------------------
// Submit a guide to the community repository via GitHub's
// repository_dispatch API. A GitHub Action in the guides repo handles
// the payload and opens a PR for review.
// -----------------------------------------------------------------------

const DISPATCH_URL = "https://api.github.com/repos/rndfunction/SideboardGuides/dispatches";
const SUBMIT_THROTTLE_KEY = "mtg-deck-guide:last-submit";
const SUBMIT_THROTTLE_MS = 30 * 1000; // client-side politeness, not security

/**
 * Turn a deckName into a safe filename slug. Always ends with .json.
 *
 * Includes a UTC timestamp down to the second AND a short random suffix
 * so two submissions of the same deck within the same second do not
 * collide on the server side.
 */
export function suggestFilename(deckName) {
  const base = String(deckName || "untitled-guide")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled-guide";
  const now = new Date();
  const stamp =
    now.getUTCFullYear() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") + "-" +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0");
  // 4 hex chars from crypto.randomUUID when available, else Math.random.
  let rand;
  try {
    rand = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 4)
                              : Math.random().toString(16).slice(2, 6));
  } catch (_) {
    rand = Math.random().toString(16).slice(2, 6);
  }
  return base + "-" + stamp + "-" + rand + ".json";
}

/**
 * Submit a guide payload to the community repo using an OAuth token
 * obtained from the device flow. Returns { ok, filename } on success
 * or throws on failure.
 *
 * @param {object} payload   the shared guide object (buildSharePayload output)
 * @param {string} filename  suggested filename (see suggestFilename)
 * @param {object} meta      optional metadata: { deckName, format, archetype, author }
 * @param {string} token     OAuth access token from githubauth.js
 */
export async function submitGuide(payload, filename, meta, token) {
  if (!token) throw new Error("Not authorized. Please sign in with GitHub.");

  // Client-side throttle to prevent accidental double-clicks. Real
  // anti-abuse lives server-side in the GitHub Action.
  //
  // Read the last-submit timestamp in a try/catch because localStorage
  // can throw in some privacy modes. Then enforce the throttle OUTSIDE
  // the try so a genuine "Please wait" error is not accidentally
  // swallowed by the storage guard.
  let lastSubmit = 0;
  try {
    lastSubmit = parseInt(localStorage.getItem(SUBMIT_THROTTLE_KEY) || "0", 10) || 0;
  } catch (_) {
    lastSubmit = 0;
  }
  if (lastSubmit && Date.now() - lastSubmit < SUBMIT_THROTTLE_MS) {
    const wait = Math.ceil((SUBMIT_THROTTLE_MS - (Date.now() - lastSubmit)) / 1000);
    throw new Error("Please wait " + wait + " second" + (wait === 1 ? "" : "s") + " before submitting again.");
  }

  const body = {
    event_type: "submit-guide",
    client_payload: {
      filename: filename,
      guide: payload,
      meta: meta || {}
    }
  };

  const res = await fetch(DISPATCH_URL, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j && j.message ? ": " + j.message : "";
    } catch (_) {}
    throw new Error("Submission failed (HTTP " + res.status + ")" + detail);
  }

  try { localStorage.setItem(SUBMIT_THROTTLE_KEY, String(Date.now())); } catch (_) {}

  return { ok: true, filename: filename };
}

// -----------------------------------------------------------------------
// Archetype index (derived artifact, see /docs/archetype-index-spec.md)
// -----------------------------------------------------------------------
//
// Fetched with the same three-tier fallback as the manifest: remote
// archetypes.json, then a local copy, then no index at all (null). The
// index is optional -- a missing or malformed file just means the Browse
// view shows the flat guide list.

// The client accepts both v1 and v2 of the archetype index. A v2 index
// adds boardInMatrix (per-matchup board-in statistics); a v1 index has
// only cardFrequency. Both render; the archetype view simply omits the
// board-in section when boardInMatrix is absent. This is deliberately
// more forgiving than a strict version match, so that an index produced
// by an older Action still works.
const ARCHETYPES_VERSION_MIN = 1;
const ARCHETYPES_VERSION_MAX = 2;

/**
 * Validate a parsed archetypes.json against the client contract from the
 * spec. Returns true if the object is well-formed enough to render, false
 * otherwise. Silent on failure -- callers decide what to do with a bad
 * index (in practice: fall back to the flat guide list).
 */
export function isValidArchetypeIndex(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.version !== "number") return false;
  if (data.version < ARCHETYPES_VERSION_MIN) return false;
  if (data.version > ARCHETYPES_VERSION_MAX) return false;
  if (!Array.isArray(data.archetypes)) return false;

  for (const a of data.archetypes) {
    if (!a || typeof a !== "object") return false;
    if (typeof a.key !== "string" || !a.key) return false;
    if (typeof a.name !== "string") return false;
    if (typeof a.format !== "string") return false;
    if (typeof a.guideCount !== "number") return false;
    if (!Array.isArray(a.cardFrequency)) return false;
    if (!Array.isArray(a.guides)) return false;
    // tags is optional in the spec's producer but always emitted; accept
    // either an array or missing so a slightly older file still loads.
    if (a.tags !== undefined && !Array.isArray(a.tags)) return false;

    // boardInMatrix is v2-only and optional. When present, validate its
    // shape: an object keyed by matchup, each value an array of card
    // entries with name/inclusion/avgCopies.
    if (a.boardInMatrix !== undefined) {
      if (!a.boardInMatrix || typeof a.boardInMatrix !== "object") return false;
      for (const matchup of Object.keys(a.boardInMatrix)) {
        const list = a.boardInMatrix[matchup];
        if (!Array.isArray(list)) return false;
        for (const entry of list) {
          if (!entry || typeof entry !== "object") return false;
          if (typeof entry.name !== "string") return false;
          if (typeof entry.inclusion !== "number") return false;
          if (typeof entry.avgCopies !== "number") return false;
        }
      }
    }

    for (const f of a.cardFrequency) {
      if (!f || typeof f !== "object") return false;
      if (typeof f.name !== "string") return false;
      if (typeof f.inclusion !== "number") return false;
      if (typeof f.avgCopies !== "number") return false;
    }
    for (const g of a.guides) {
      if (!g || typeof g !== "object") return false;
      if (typeof g.file !== "string") return false;
      if (typeof g.overlapWithCore !== "number") return false;
    }
  }
  return true;
}

/**
 * True if the index contains at least one archetype worth showing as a
 * bucket. Per the spec, a bucket needs guideCount >= 2 to be meaningful
 * (a single-guide bucket is just that guide, and its cardFrequency is the
 * guide's own mainboard). The view uses this to decide between the
 * archetype view and the flat guide list.
 */
export function hasUsableArchetypes(data) {
  if (!isValidArchetypeIndex(data)) return false;
  return data.archetypes.some((a) => (a.guideCount || 0) >= 2);
}

/**
 * Fetch the archetype index. Returns { index, source } where index is the
 * parsed object (validated) or null, and source is "remote" | "local" |
 * "none". Never throws.
 */
export async function listArchetypes() {
  // Remote first.
  try {
    const data = await fetchJson(GUIDES_BASE_URL + "/archetypes.json", 4000);
    if (isValidArchetypeIndex(data)) {
      return { index: data, source: "remote" };
    }
  } catch (_) { /* fall through */ }

  // Local mirror second.
  try {
    const data = await fetchJson("guides/archetypes.json", 2000);
    if (isValidArchetypeIndex(data)) {
      return { index: data, source: "local" };
    }
  } catch (_) { /* fall through */ }

  // Development fallback third. This file is a hand-computed index
  // describing the repo's own bundled guides, so the archetype view has
  // something real to render before the GitHub Action produces a proper
  // archetypes.json. It is labeled "demo" in the UI and is shadowed the
  // moment either the remote or local real index exists.
  try {
    const data = await fetchJson("guides/archetypes.demo.json", 2000);
    if (isValidArchetypeIndex(data)) {
      return { index: data, source: "demo" };
    }
  } catch (_) { /* fall through */ }

  // No other fallback: unlike the manifest, a hard-coded index would
  // describe archetypes that may not match whatever guides the user can
  // actually reach. The flat guide list is the correct degradation.
  return { index: null, source: "none" };
}

export { GUIDES_BASE_URL };