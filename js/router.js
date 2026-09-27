// Hash-based client-side routing.
//
// The app is a static site, so routes are hashes, not paths:
//   (empty)            -> Build, no deck loaded
//   #browse            -> Browse (the guide library)
//   #guide/<filename>  -> load that guide into Build
//
// The guide identity in a URL is the FILENAME (the manifest key, the git
// path), never the deck name -- two guides can share a display name but
// never a filename. The ".json" extension is omitted in the URL for
// readability and re-appended when resolving.
//
// This module is pure: it parses/builds hashes and wraps the hashchange
// event. It does not know about the app; the caller supplies a handler.

const GUIDE_PREFIX = "#guide/";

/**
 * Parse a location hash into a route descriptor.
 *   ""                      -> { mode: "build", guideFile: null }
 *   "#browse"               -> { mode: "browse", guideFile: null }
 *   "#guide/<filename>"     -> { mode: "build", guideFile: "<filename>.json" }
 * Anything unrecognized falls back to the build route.
 */
export function parseHash(hash) {
  const h = (hash || "").replace(/^#/, "");
  if (h === "browse") {
    return { mode: "browse", guideFile: null };
  }
  if (h.indexOf("guide/") === 0) {
    let file = h.slice("guide/".length);
    // Guard: filenames are alphanumeric plus . _ -
    if (!/^[a-z0-9._-]+$/i.test(file)) {
      return { mode: "build", guideFile: null };
    }
    // Re-append the extension if the URL omitted it.
    if (!file.endsWith(".json")) file += ".json";
    return { mode: "build", guideFile: file };
  }
  return { mode: "build", guideFile: null };
}

/**
 * Build a hash string for a route.
 *   { mode: "build" }                    -> ""
 *   { mode: "browse" }                   -> "#browse"
 *   { mode: "build", guideFile: "x.json" } -> "#guide/x"  (extension trimmed)
 */
export function buildHash(route) {
  const r = route || {};
  if (r.mode === "browse") return "#browse";
  if (r.guideFile) {
    let file = String(r.guideFile);
    if (file.endsWith(".json")) file = file.slice(0, -".json".length);
    return GUIDE_PREFIX + file;
  }
  return "";
}

/**
 * Read the current route from the browser.
 */
export function currentRoute() {
  if (typeof window === "undefined") return { mode: "build", guideFile: null };
  return parseHash(window.location.hash);
}

/**
 * Write a route to the URL. `push` (default) adds a history entry so
 * back/forward traverse it; pass { replace: true } to overwrite instead.
 * No-ops when the resulting hash already matches, to avoid redundant
 * history entries and hashchange churn.
 */
export function writeRoute(route, opts) {
  if (typeof window === "undefined" || !window.history) return;
  const hash = buildHash(route);
  if (window.location.hash === hash) return;
  const url = window.location.pathname + window.location.search + hash;
  if (opts && opts.replace) {
    window.history.replaceState(null, "", url);
  } else {
    // Setting location.hash pushes a history entry and fires hashchange.
    window.location.hash = hash;
  }
}

/**
 * Subscribe to hashchange. Returns an unsubscribe function.
 * The handler receives the parsed route. The app is responsible for
 * ignoring events it caused itself (writeRoute no-ops on identical
 * hashes, which covers most cases; the app also compares to its state).
 */
export function onRouteChange(handler) {
  if (typeof window === "undefined") return function () {};
  const listener = () => handler(parseHash(window.location.hash));
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}