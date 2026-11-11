// Service worker MINIMO e seguro para dados financeiros:
// - cacheia somente arquivos estaticos publicos (icones, /_next/static) e a pagina offline;
// - NUNCA cacheia /api/*, paginas autenticadas nem respostas do Supabase.
const VERSION = 'v1';
const STATIC = `static-${VERSION}`;
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // Supabase/OpenAI passam direto
  if (url.pathname.startsWith('/api/')) return;                              // nunca cachear API
  if (req.mode === 'navigate') {                                             // paginas: rede; offline => aviso generico
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); return res;
    })));
  }
});
