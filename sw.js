const CACHE_NAME = "kikutan-my-v59";
const ASSETS = [
  "./",
  "./index.html",
  "./app-v2.webmanifest",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kikutan-my-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // 別サイト（Firebase など）への通信には関与しない
  if (new URL(req.url).origin !== self.location.origin) return;

  // ページ本体はネット優先（更新がすぐ届くように）。オフライン時はキャッシュ。
  // ただし電波が弱くて 4 秒たっても届かないときは、保存してある版をすぐ出す（真っ白のまま待たせない）
  if (req.mode === "navigate") {
    const cached = () => caches.match(req).then((c) => c || caches.match("./index.html"));
    const net = fetch(req, { cache: "no-cache" }).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)); }
      return res;
    });
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const fin = (r) => { if (!done && r) { done = true; resolve(r); } };
      const t = setTimeout(() => cached().then((c) => { if (c) fin(c); }), 4000);
      net.then((res) => {
        clearTimeout(t);
        if (res && res.ok) fin(res);
        else cached().then((c) => fin(c || res));   // 404 など（更新の途中）は保存してある版
      }).catch(() => { clearTimeout(t); cached().then((c) => fin(c || Response.error())); });
    }));
    return;
  }

  // アプリ情報（manifest）はネット優先：古い情報でインストールされないように
  if (new URL(req.url).pathname.endsWith(".webmanifest")) {
    event.respondWith(fetch(req, { cache: "no-cache" }).catch(() => caches.match(req)));
    return;
  }

  // アイコン等はキャッシュ優先
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
