/* Service worker mínimo do Portal de Câmeras (PWA).
 * Existe sobretudo para tornar o app instalável (requisito do beforeinstallprompt).
 *
 * IMPORTANTE: NÃO intercepta as chamadas de API (/api/...) nem requisições de
 * vídeo (com header Range). Os vídeos das gravações precisam do streaming nativo
 * do navegador (Range/206); se o SW intermediar, ele bufferiza/clona arquivos
 * grandes e trava o carregamento. Só cacheia os assets estáticos do app. */
const CACHE = "cameras-pwa-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Deixa o navegador tratar nativamente: outros métodos, outra origem, a API
  // (gravações/stream) e qualquer requisição de mídia com Range. Isso é o que
  // garante o streaming de vídeo rápido (sem buffer/cache no meio do caminho).
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    req.headers.has("range")
  ) {
    return;
  }

  // Demais GETs de mesma origem (HTML/JS/CSS do app): network-first com cache leve.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
