// GitHub OAuth device flow.
//
// The device flow lets a browser app authenticate a user without a
// client secret and without a redirect URI. Flow:
//
//   1. POST /login/device/code          -> { device_code, user_code, verification_uri, interval, expires_in }
//   2. Show user_code + verification_uri to the user.
//   3. Poll /login/oauth/access_token   until the user approves.
//   4. Receive { access_token }.
//
// Reference: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow

// GitHub's device-flow endpoints don't send CORS headers, so browsers
// can't call them directly. We proxy through a small Cloudflare Worker
// that forwards the two POST requests and adds the CORS headers.
const WORKER_BASE = "https://sideboardguide-auth.rndfunction.workers.dev";
const CLIENT_ID = "Ov23liO6o1nKggvOuI4R";
const DEVICE_CODE_URL = WORKER_BASE + "/device/code";
const TOKEN_URL = WORKER_BASE + "/oauth/access_token";
const SCOPES = "public_repo";
const TOKEN_STORAGE_KEY = "mtg-deck-guide:gh-token";

/**
 * Step 1: request a device code and user code.
 * Returns { device_code, user_code, verification_uri, expires_in, interval }.
 */
export async function requestDeviceCode() {
  const body = new URLSearchParams({ client_id: CLIENT_ID, scope: SCOPES });
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) throw new Error("Device code request failed: HTTP " + res.status);
  const data = await res.json();
  if (!data.device_code || !data.user_code) {
    throw new Error("Device code request returned no code: " + JSON.stringify(data));
  }
  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri || "https://github.com/login/device",
    expires_in: data.expires_in || 900,
    interval: data.interval || 5
  };
}

/**
 * Step 2: poll for the token. Returns the access token string.
 * Throws on error or timeout.
 *
 * `onStatus` is an optional callback(status) where status is one of:
 *   "polling"  — still waiting
 *   "ready"    — token acquired (just before resolution)
 */
export async function pollForToken(device_code, interval, expires_in, onStatus) {
  const startedAt = Date.now();
  const expiresMs = (expires_in || 900) * 1000;
  let wait = (interval || 5) * 1000;

  while (Date.now() - startedAt < expiresMs) {
    await sleep(wait);
    if (onStatus) onStatus("polling");

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      device_code: device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    });

    let res;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
    } catch (err) {
      // Network hiccup; back off and retry.
      continue;
    }
    if (!res.ok) throw new Error("Token request failed: HTTP " + res.status);
    const data = await res.json();

    if (data.access_token) {
      if (onStatus) onStatus("ready");
      return data.access_token;
    }

    // Expected errors while waiting: authorization_pending, slow_down.
    const err = data.error;
    if (err === "authorization_pending") {
      // keep polling at the same interval
      continue;
    }
    if (err === "slow_down") {
      // GitHub wants a longer interval
      wait += 5000;
      continue;
    }
    if (err === "expired_token") {
      throw new Error("The device code expired before you authorized. Please try again.");
    }
    if (err === "access_denied") {
      throw new Error("Authorization was denied.");
    }
    // Any other error is fatal.
    throw new Error("Authorization failed: " + (data.error_description || err || "unknown"));
  }
  throw new Error("Timed out waiting for authorization.");
}

// ---------------------------------------------------------------------------
// Token persistence (session-scoped by default; the user can clear it)
// ---------------------------------------------------------------------------

export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch (_) {
    return null;
  }
}

export function storeToken(token) {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (_) {}
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Authenticated user lookup (for attribution on submissions)
// ---------------------------------------------------------------------------

const USER_STORAGE_KEY = "mtg-deck-guide:gh-user";

/**
 * Fetch the authenticated user from GitHub. Caches the result in
 * sessionStorage so we don't hit the API on every submit.
 * Returns { login, name } or null.
 */
export async function fetchUser(token) {
  if (!token) return null;

  // Cached?
  try {
    const raw = sessionStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.login) return parsed;
    }
  } catch (_) {}

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = { login: data.login || "", name: data.name || "" };
    if (user.login) {
      try { sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)); } catch (_) {}
    }
    return user;
  } catch (_) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}