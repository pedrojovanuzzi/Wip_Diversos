/* Service worker mínimo do Portal de Câmeras (PWA).
 * Existe sobretudo para tornar o app instalável (requisito do beforeinstallprompt).
 * Estratégia "network-first" simples: tenta a rede e, se falhar, devolve o que
 * estiver em cache. Não força cache agressivo para não interferir nas demais
 * páginas do sistema. */
const CACHE = "cameras-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Só trata GET de mesma origem; o resto segue o fluxo normal do navegador.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }
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
