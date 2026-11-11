// Numi — service worker
// IMPORTANTE: incrementar o nome do cache a cada versão publicada (numi-vN).
const CACHE = 'numi-v1';
const SHELL = ['/', '/index.html', '/manifest.json',
               '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // Supabase, Anthropic e CDNs: sempre direto na rede (nunca interceptar dados)
  if (url.origin !== self.location.origin) return;

  // HTML (navegação): NETWORK-FIRST — evita o app ficar preso numa versão antiga
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() =>
        caches.match(e.request).then(r => r || caches.match('/index.html'))
      )
    );
    return;
  }

  // Demais assets do próprio site: cache-first com preenchimento
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
