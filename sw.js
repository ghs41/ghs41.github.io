'use strict';

const CACHE_PREFIX = 'ghs41-';
const CACHE_VERSION = 'static-2026-08-04-v4';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const OFFLINE_FALLBACK = './404.html';

const PRECACHE_URLS = Object.freeze([
  './',
  './index.html',
  './paket.html',
  './layanan.html',
  './booking.html',
  './tentang.html',
  './kontak.html',
  './404.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/packages.js',
  './assets/js/booking.js',
  './assets/js/motion.js',
  './data/packages.json',
  './data/services.json',
  './data/testimonials.json',
  './assets/images/favicon.png',
  './assets/images/logo-ghs41-optimized.png',
  './assets/images/hero-workshop-premium.jpg',
  './assets/images/booking-workshop-premium.jpg',
  './assets/images/og-cover.jpg'
]);

function isCacheable(response) {
  if (!response || !response.ok) return false;
  if (!['basic', 'default'].includes(response.type)) return false;
  return !/\bno-store\b/i.test(response.headers.get('Cache-Control') || '');
}

function normalisedUrl(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return url.href;
}

async function putWhenPublic(request, response) {
  const url = new URL(request.url);
  if (url.search || !isCacheable(response)) return;

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await putWhenPublic(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(normalisedUrl(request));
    if (cached) return cached;

    if (request.mode === 'navigate') {
      return (await caches.match(OFFLINE_FALLBACK))
        || (await caches.match('./index.html'))
        || Response.error();
    }

    return Response.error();
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const update = fetch(request)
    .then(async (response) => {
      await putWhenPublic(request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(update);
    return cached;
  }

  return (await update) || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const requests = PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }));
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate' || request.destination === 'document';
  const isJson = url.pathname.endsWith('.json');
  const isStaticAsset = ['style', 'script', 'image', 'font', 'manifest'].includes(request.destination);

  if (isNavigation || isJson) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset && !url.search) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
