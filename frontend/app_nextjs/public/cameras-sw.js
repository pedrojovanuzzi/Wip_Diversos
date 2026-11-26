/* Service worker mínimo do Portal de Câmeras (PWA).
 * Existe sobretudo para tornar o app instalável (requisito do beforeinstallprompt).
 *
 * IMPORTANTE: NÃO intercepta as chamadas de API (/api/...) nem requisições de
 * vídeo (com header Range). Os vídeos das gravações precisam do streaming nativo
 * do navegador (Range/206); se o SW intermediar, ele bufferiza/clona arquivos
 * grandes e trava o carregamento. Só cacheia os assets estáticos do app. */
const CACHE = "cameras-pwa-v3";

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
  // (gravações/stream) e qualquer mídia (vídeo/áudio). Isso é o que garante o
  // streaming de vídeo rápido (sem buffer/cache no meio do caminho).
  //
  // ATENÇÃO: a 1ª requisição de um <video> costuma sair SEM header Range (o
  // navegador só passa a mandar Range depois do servidor anunciar Accept-Ranges).
  // Por isso NÃO dá para confiar só em `has("range")`: usamos `req.destination`,
  // que já vem como "video"/"audio" inclusive nessa primeira requisição. Se o SW
  // intermediar o vídeo, o `res.clone()` bufferiza o arquivo inteiro e trava o
  // carregamento.
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    req.destination === "video" ||
    req.destination === "audio" ||
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
