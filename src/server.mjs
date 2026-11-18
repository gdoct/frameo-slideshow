// Photo service for the Frameo launcher.
//
// Reads the image assets of one Immich album and hands them out to the frame in
// random order: every photo once before any repeats. The frame never talks to
// Immich itself; images are proxied through /photo/<id>, so the API key stays here.
//
//   GET /api/next?count=12   -> { album, photos: [{ id, url }] }   (url is relative)
//   GET /photo/<id>          -> Immich "preview" rendition (~1440px JPEG/WebP)
//   GET /health              -> { album, images, refreshedAt, error }
//
// Settings come from the environment, see .env.example.
import http from 'node:http';
import { Readable } from 'node:stream';

const env = process.env;
const IMMICH_URL = (env.IMMICH_URL || '').replace(/\/+$/, '');
const API_KEY = env.IMMICH_API_KEY || '';
const ALBUM = (env.IMMICH_ALBUM || 'Guido').trim();
const LISTEN_PORT = Number(env.LISTEN_PORT) || 8080;
const REFRESH_MS = (Number(env.REFRESH_MINUTES) || 60) * 60_000;
const MAX_COUNT = 50;

if (!IMMICH_URL || !API_KEY) {
  console.error('IMMICH_URL and IMMICH_API_KEY must be set (see .env.example)');
  process.exit(1);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let albumName = null;
let ids = [];               // image asset ids in the album
let known = new Set(ids);   // only these may be fetched through /photo/
let deck = [];              // ids not yet handed out in this round
let refreshedAt = 0;
let lastError = null;
let refreshing = null;

// ---------- Immich ----------

async function immich(path, init = {}) {
  const res = await fetch(`${IMMICH_URL}/api${path}`, {
    ...init,
    headers: {
      'x-api-key': API_KEY,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Immich ${init.method || 'GET'} ${path}: HTTP ${res.status}`), { status: res.status });
  }
  return res;
}
const getJson = async (path, init) => (await immich(path, init)).json();

async function findAlbum() {
  if (UUID.test(ALBUM)) return { id: ALBUM, name: ALBUM };
  const albums = await getJson('/albums');
  const want = ALBUM.toLowerCase();
  const a = albums.find(x => x.albumName.trim().toLowerCase() === want);
  if (!a) throw new Error(`Album "${ALBUM}" not found. Albums: ${albums.map(x => x.albumName).join(', ')}`);
  return { id: a.id, name: a.albumName };
}

// Images only: no videos, nothing trashed, hidden (Live Photo parts) or in the locked folder.
const usable = a => a.type === 'IMAGE' && !a.isTrashed && !['hidden', 'locked'].includes(a.visibility);

async function albumImageIds(albumId) {
  // Most Immich versions return the assets with the album; fall back to a paged search if not.
  const full = await getJson(`/albums/${albumId}`);
  if (Array.isArray(full.assets) && full.assets.length > 0 && full.assets.length >= (full.assetCount || 0)) {
    return full.assets.filter(usable).map(a => a.id);
  }
  const out = [];
  for (let page = 1; page;) {
    const r = await getJson('/search/metadata', {
      method: 'POST',
      body: JSON.stringify({ albumIds: [albumId], type: 'IMAGE', size: 1000, page }),
    });
    out.push(...r.assets.items.filter(usable).map(a => a.id));
    page = r.assets.nextPage ? Number(r.assets.nextPage) : 0;
  }
  return out;
}

async function refresh() {
  const album = await findAlbum();
  const list = await albumImageIds(album.id);
  if (!list.length) throw new Error(`Album "${album.name}" has no images`);
  albumName = album.name;
  ids = list;
  known = new Set(list);
  deck = deck.filter(id => known.has(id));
  refreshedAt = Date.now();
  lastError = null;
  console.log(`album "${album.name}": ${list.length} images`);
}

/** Starts a refresh unless one is running; never rejects. */
function refreshInBackground() {
  refreshing ??= refresh()
    .catch(e => { lastError = e.message; console.error(`refresh failed: ${e.message}`); })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// ---------- selection ----------

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw(count) {
  const n = Math.min(count, ids.length);
  const out = [];
  while (out.length < n) {
    if (!deck.length) deck = shuffle([...ids]);
    const id = deck.pop();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// ---------- HTTP ----------

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function next(res, url) {
  if (!ids.length) await refreshInBackground();
  else if (Date.now() - refreshedAt > REFRESH_MS) refreshInBackground();
  if (!ids.length) return send(res, 503, { error: lastError || 'No photos available' });
  const count = Math.max(1, Math.min(MAX_COUNT, Number(url.searchParams.get('count')) || 12));
  send(res, 200, {
    album: albumName,
    photos: draw(count).map(id => ({ id, url: `photo/${id}` })),
  });
}

async function photo(res, id) {
  if (!known.has(id)) return send(res, 404, { error: 'Unknown photo' });
  let up;
  try {
    up = await immich(`/assets/${id}/thumbnail?size=preview`, { headers: { accept: 'image/*' } });
  } catch (e) {
    if (e.status !== 404) throw e;
    // Immich has no preview for it (e.g. a failed thumbnail job): stop handing it out until the next refresh.
    console.warn(`no preview for ${id}; skipping it`);
    known.delete(id);
    ids = ids.filter(x => x !== id);
    deck = deck.filter(x => x !== id);
    return send(res, 404, { error: 'No preview for this photo' });
  }
  const headers = {
    'content-type': up.headers.get('content-type') || 'image/jpeg',
    'cache-control': 'public, max-age=86400',
  };
  const len = up.headers.get('content-length');
  if (len) headers['content-length'] = len;
  res.writeHead(200, headers);
  Readable.fromWeb(up.body).on('error', () => res.destroy()).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
    if (url.pathname === '/api/next') return await next(res, url);
    const m = url.pathname.match(/^\/photo\/([^/]+)$/);
    if (m) return await photo(res, m[1]);
    if (url.pathname === '/health' || url.pathname === '/') {
      return send(res, ids.length ? 200 : 503, {
        album: albumName ?? ALBUM,
        images: ids.length,
        refreshedAt: refreshedAt ? new Date(refreshedAt).toISOString() : null,
        error: lastError,
      });
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(`${req.url}: ${e.message}`);
    if (res.headersSent) res.destroy();
    else send(res, 502, { error: e.message });
  }
});

server.listen(LISTEN_PORT, () => console.log(`listening on :${LISTEN_PORT}, album "${ALBUM}" at ${IMMICH_URL}`));
refreshInBackground();
setInterval(refreshInBackground, REFRESH_MS).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
