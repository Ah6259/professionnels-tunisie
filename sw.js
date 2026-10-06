// Service worker PRUDENT du moteur d'annuaire (installation sur le téléphone + secours hors connexion).
// Pages et données : RÉSEAU D'ABORD (le cache ne sert que si le réseau échoue).
// CSS / JS / images versionnés (?v=) : cache puis mise à jour en arrière-plan.
// Jamais en cache : requêtes non-GET, autres sites, autres sites d'Ahmed (même origine ah6259.github.io).
// Changer CACHE_VERSION pour vider le cache de tous les téléphones.
const CACHE_VERSION = "1";
const PORTEE = new URL("./", self.location.href).pathname;
const PREFIXE = PORTEE.replace(/\//g, "") + "-";
const CACHE = PREFIXE + CACHE_VERSION;
const STATIQUE = /\.(css|js|png|jpe?g|svg|webp|ico|woff2?)$/i;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(n => Promise.all(n.filter(x => x.startsWith(PREFIXE) && x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PORTEE) || req.headers.has("range")) return;
  e.respondWith(url.searchParams.has("v") && STATIQUE.test(url.pathname) ? cachePuisMaj(e, req, url) : reseauDabord(e, req));
});
async function reseauDabord(e, req) {
  try {
    const rep = await fetch(req);
    if (rep.ok && rep.type === "basic") { const c = rep.clone(); e.waitUntil(caches.open(CACHE).then(x => x.put(req, c)).catch(() => {})); }
    return rep;
  } catch (err) {
    const garde = await (await caches.open(CACHE)).match(req, { ignoreSearch: req.mode === "navigate" });
    if (garde) return garde;
    if (req.mode === "navigate") return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion</title><body style="font-family:sans-serif;text-align:center;padding:3rem 1rem"><h1>Hors connexion</h1><p>Vérifiez votre connexion Internet puis réessayez.</p><p dir="rtl">لا يوجد اتصال بالإنترنت.</p>', { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    return Response.error();
  }
}
async function cachePuisMaj(e, req, url) {
  const cache = await caches.open(CACHE), garde = await cache.match(req);
  const maj = fetch(req).then(async rep => {
    if (rep.ok && rep.type === "basic") {
      for (const r of await cache.keys()) { const u = new URL(r.url); if (u.pathname === url.pathname && u.search !== url.search) await cache.delete(r); }
      await cache.put(req, rep.clone());
    }
    return rep;
  }).catch(() => garde);
  if (garde) { e.waitUntil(maj.then(() => {}, () => {})); return garde; }
  return maj;
}
