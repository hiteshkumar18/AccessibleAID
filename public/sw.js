/* AccessibleAID service worker.
 *
 * Strategy:
 *   • App shell (HTML / JS / CSS / icons) → cache-first with network refresh.
 *   • Hugging Face model files → cache-first with very long TTL — these are
 *     immutable model weights so they're safe to keep forever.
 *   • Everything else → network-first, fall back to cache.
 *
 * The transformers.js library *also* caches via IndexedDB, so models cache
 * twice. That's intentional — the SW layer makes installs feel instant on
 * subsequent loads while the IDB layer handles the actual model bytes.
 */
// Bumping VERSION evicts every cached app-shell asset and HF model file on
// the next service-worker activation. We bump it whenever the model registry
// in src/config/models.js changes so a stale / broken model id (e.g. a
// previous 404 response from a non-existent repo) cannot stick around.
const VERSION = 'v2-vlm';
const SHELL_CACHE = `aaid-shell-${VERSION}`;
const MODEL_CACHE = `aaid-models-${VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

const isModelHost = (url) =>
  url.hostname === 'huggingface.co' ||
  url.hostname.endsWith('.hf.co') ||
  url.hostname.endsWith('huggingface.co');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isModelHost(url)) {
    event.respondWith(cacheFirst(req, MODEL_CACHE));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp && resp.status === 200) cache.put(req, resp.clone()).catch(() => {});
    return resp;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((resp) => {
      if (resp && resp.status === 200) cache.put(req, resp.clone()).catch(() => {});
      return resp;
    })
    .catch(() => cached);
  return cached || network;
}
