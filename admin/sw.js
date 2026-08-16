/*
  SERVICE WORKER — Lee's Soles and Tasks Admin
  -----------------------------------------------
  Strategy:
    • App shell (HTML/CSS/JS/icons/manifest): Cache-first + network update in background.
    • API calls (/api/*): Network-only — never serve stale data.
    • Offline fallback: If a nav request fails and nothing is in cache, show a friendly offline page.
*/

const CACHE_VERSION = "lees-soles-tasks-v4";
const SHELL_FILES = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./offline.html"
];

// ── Install: pre-cache app shell ───────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
});

// ── Activate: purge old caches + reload all open tabs ─────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => {
      // Tell every open tab to reload so they get fresh files immediately
      return self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    })
  );
  self.clients.claim();
});

// ── Fetch: route-based strategy ────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API calls — always go to network, never cache
  if (url.pathname.startsWith("/api/") || url.hostname.includes("sole-stock-api")) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Cloudinary / Google Fonts / external — network, no cache
  if (!url.origin.startsWith(self.location.origin) && !url.pathname.startsWith("./")) {
    event.respondWith(fetch(request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // 3. App shell — cache-first, fall back to network, fall back to offline page
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cache immediately, fetch update in background
        const networkFetch = fetch(request).then((fresh) => {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, fresh.clone()));
          return fresh;
        }).catch(() => {});
        return cached;
      }
      // Not in cache — try network
      return fetch(request).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === "navigate") {
          return caches.match("./offline.html");
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
});
