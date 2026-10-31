'use strict';

// The Pages workflow replaces "dev" with the commit SHA so every deploy installs a fresh cache.
const VERSION = 'koshi-dev';
const DEV = VERSION === 'koshi-dev';
const ASSETS = [
  './',
  './index.html',
  './editor.html',
  './style.css',
  './editor.css',
  './src/game.js',
  './src/cutscene.js',
  './src/learning.js',
  './src/saves.js',
  './src/app.js',
  './src/editor.js',
  './src/pwa.js',
  './manifest.webmanifest',
  './fonts/dm-sans-latin.woff2',
  './fonts/space-grotesk-latin.woff2',
  './fonts/pixelify-sans.ttf',
  './icons/koshi.svg',
  './icons/title-scene.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('koshi-') && key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

async function fromCache(request) {
  const cache = await caches.open(VERSION);
  return await cache.match(request, { ignoreSearch: true })
    ?? (request.mode === 'navigate' ? cache.match('./index.html') : undefined);
}

async function fromNetwork(request) {
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Deployed builds are cache-first so the installed game opens instantly offline.
  // Local development is network-first so edits show up without bumping the version.
  event.respondWith(DEV
    ? fromNetwork(request).catch(async () => (await fromCache(request)) ?? Response.error())
    : fromCache(request).then(cached => cached ?? fromNetwork(request)));
});
