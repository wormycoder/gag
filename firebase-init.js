// firebase-init.js  –  Grow-a-Garden
// Firebase REST API wrapper — no WebSockets, no SDK, pure fetch() over HTTPS.
// Routes all Firebase calls through a Cloudflare Worker proxy to bypass
// Neocities' Content Security Policy restrictions.

const DB_URL  = 'https://snaptube-c38b2-default-rtdb.firebaseio.com';
const API_KEY = 'AIzaSyDL4KerKsx1UZfA--gV2YLY92ptVyFg25I';
const PROXY   = 'https://restless-leaf-ef07.elithiessen5.workers.dev';

// ── AUTH TOKEN ────────────────────────────────────────────────────────────────
let _authToken = null;

async function getAuthToken() {
  if (_authToken) return _authToken;
  try {
    const authUrl = `${PROXY}?url=${encodeURIComponent(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`
    )}`;
    const r = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const d = await r.json();
    if (d.idToken) {
      _authToken = d.idToken;
      // Refresh before it expires (Firebase tokens last 1 hour)
      setTimeout(() => { _authToken = null; }, 55 * 60 * 1000);
    }
  } catch(e) {
    console.warn('[DB] Auth token fetch failed, trying unauthenticated', e);
  }
  return _authToken;
}

// ── REST HELPERS ──────────────────────────────────────────────────────────────
function pathToUrl(path) {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const target = `${DB_URL}/${clean}.json`;
  return `${PROXY}?url=${encodeURIComponent(target)}`;
}

async function restGet(path) {
  const token = await getAuthToken();
  let url = pathToUrl(path);
  if (token) url += `&auth=${encodeURIComponent(token)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`DB get failed: ${r.status}`);
  const val = await r.json();
  return makeSnap(val, path);
}

async function restSet(path, value) {
  const token = await getAuthToken();
  let url = pathToUrl(path);
  if (token) url += `&auth=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(value)
  });
  if (!r.ok) throw new Error(`DB set failed: ${r.status}`);
  return await r.json();
}

async function restUpdate(path, value) {
  const token = await getAuthToken();
  let url = pathToUrl(path);
  if (token) url += `&auth=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(value)
  });
  if (!r.ok) throw new Error(`DB update failed: ${r.status}`);
  return await r.json();
}

async function restPush(path, value) {
  const token = await getAuthToken();
  let url = pathToUrl(path);
  if (token) url += `&auth=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(value)
  });
  if (!r.ok) throw new Error(`DB push failed: ${r.status}`);
  const d = await r.json();
  return { key: d.name };
}

async function restRemove(path) {
  const token = await getAuthToken();
  let url = pathToUrl(path);
  if (token) url += `&auth=${encodeURIComponent(token)}`;
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) throw new Error(`DB remove failed: ${r.status}`);
}

// ── SNAPSHOT EMULATION ────────────────────────────────────────────────────────
function makeSnap(val, path) {
  return {
    exists:   () => val !== null && val !== undefined,
    val:      () => val,
    key:      path.split('/').pop(),
    forEach:  (cb) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [k, v] of Object.entries(val)) {
          const child = makeSnap(v, path + '/' + k);
          child._key = k;
          Object.defineProperty(child, 'key', { get: () => k });
          if (cb(child) === true) break;
        }
      }
    }
  };
}

// ── onValue EMULATION (polling) ───────────────────────────────────────────────
const _listeners = new Map();

function restOnValue(refObj, callback, errorCb) {
  const path = refObj._path;
  const id   = Math.random().toString(36).slice(2);

  async function poll() {
    try {
      const snap = await restGet(path);
      callback(snap);
    } catch(e) {
      if (errorCb) errorCb(e);
    }
  }

  poll();
  const interval = setInterval(poll, 8000);
  _listeners.set(id, interval);

  return () => {
    clearInterval(interval);
    _listeners.delete(id);
  };
}

function restOff(refObj) {
  // No-op for REST polling
}

// ── REF OBJECT ────────────────────────────────────────────────────────────────
function makeRef(path) {
  return { _path: path, _isRef: true };
}

// ── GLOBAL DB OBJECT ──────────────────────────────────────────────────────────
window.DB = {
  ref:             (path) => makeRef(path),
  get:             (ref)         => restGet(ref._path),
  set:             (ref, val)    => restSet(ref._path, val),
  update:          (ref, val)    => restUpdate(ref._path, val),
  push:            (ref, val)    => restPush(ref._path, val),
  remove:          (ref)         => restRemove(ref._path),
  onValue:         (ref, cb, errCb) => restOnValue(ref, cb, errCb),
  off:             (ref)         => restOff(ref),
  serverTimestamp: () => ({ '.sv': 'timestamp' }),
  query:           (ref) => ref,
  orderByChild:    () => null,
  limitToLast:     () => null,
  equalTo:         () => null,
};

window.GAG_ROOT = 'gag';
window.gRef = (path) => makeRef('gag/' + path);

// Pre-fetch auth token silently on load
getAuthToken().catch(() => {});

console.log('[DB] REST API mode via Cloudflare Worker proxy — CSP-safe');

export { };