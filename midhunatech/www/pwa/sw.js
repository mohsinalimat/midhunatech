/* Copyright (c) 2024, Midhunatech — GPL-3.0
   Service worker for the /pwa app. Cache assets on install; stale-while-
   revalidate for app shell, assets and PWA API; offline fallback. */
var CACHE = "mt-pwa-v1";
var SHELL = [
  "/pwa",
  "/pwa/manifest.json",
  "/assets/midhunatech/js/pwa_app.js",
  "/assets/midhunatech/images/icon-192.png",
  "/assets/midhunatech/images/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var swr = url.pathname === "/pwa" ||
    url.pathname.indexOf("/pwa/") === 0 ||
    url.pathname.indexOf("/assets/midhunatech") === 0 ||
    url.pathname.indexOf("/api/method/midhunatech") === 0;
  if (!swr) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          return cached || (req.mode === "navigate" ? cache.match("/pwa") : undefined);
        });
        return cached || network;
      });
    })
  );
});
