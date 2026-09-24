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
      plan: {
        "Searing Blaze": {
          "Murktide": { dir: "out", count: 3 },
          "Amulet Titan": { dir: "out", count: 2 },
          "Rhinos": { dir: "out", count: 1 }
        },
        "Skewer the Critics": {
          "Murktide": { dir: "out", count: 2 }
        },
        "Monastery Swiftspear": {
          "Amulet Titan": { dir: "out", count: 4 }
        },
        "Eidolon of the Great Revel": {
          "Rhinos": { dir: "out", count: 3 }
        },
        "Roiling Vortex": {
          "Murktide": { dir: "in", count: 3 }
        },
        "Blood Moon": {
          "Murktide": { dir: "in", count: 2 },
          "Amulet Titan": { dir: "in", count: 3 }
        },
        "Deflecting Palm": {
          "Amulet Titan": { dir: "in", count: 3 }
        },
        "Anger of the Gods": {
          "Rhinos": { dir: "in", count: 3 }
        },
        "Skullcrack": {
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

/**
 * Build a GitHub URL that opens the "new file" editor pre-filled with
 * the given JSON payload, targeting the SideboardGuides repo.
 */
export function guideSubmissionUrl(payload, suggestedFilename) {
  const filename = suggestedFilename || "new-guide.json";
  const json = JSON.stringify(payload, null, 2);
  const base = "https://github.com/rndfunction/SideboardGuides/new/main/guides";
  return base + "?filename=" + encodeURIComponent(filename) + "&value=" + encodeURIComponent(json);
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
 */
export function suggestFilename(deckName) {
  const base = String(deckName || "untitled-guide")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled-guide";
  // Add a short timestamp suffix so files don't collide when multiple
  // submissions of the same deck arrive.
  const now = new Date();
  const stamp =
    now.getUTCFullYear() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") + "-" +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0");
  return base + "-" + stamp + ".json";
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
  try {
    const last = parseInt(localStorage.getItem(SUBMIT_THROTTLE_KEY) || "0", 10);
    if (last && Date.now() - last < SUBMIT_THROTTLE_MS) {
      const wait = Math.ceil((SUBMIT_THROTTLE_MS - (Date.now() - last)) / 1000);
      throw new Error("Please wait " + wait + " second" + (wait === 1 ? "" : "s") + " before submitting again.");
    }
  } catch (e) {
    if (e && e.message && e.message.indexOf("Please wait") === 0) throw e;
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

export { GUIDES_BASE_URL };