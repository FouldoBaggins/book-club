/* Book Club — saves book covers on each phone after they've loaded once,
   so they appear instantly (even on poor signal) next time.
   Only cover images are handled here; everything else goes to the internet as normal. */

const CACHE = "bookclub-covers-v1";
const MAX_COVERS = 400;   // keep at most this many saved covers per phone (oldest removed first)

// Where cover images come from (Open Library redirects to archive.org).
const COVER_HOSTS = ["covers.openlibrary.org", "archive.org", "books.google.com", "books.googleusercontent.com"];
const isCover = url => COVER_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url; try { url = new URL(req.url); } catch (e) { return; }
  if (!isCover(url)) return;   // not a cover: leave it alone

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(req);
    if (saved) return saved;                       // already on the phone
    const res = await fetch(req);                  // first time: download it
    if (res.ok || res.type === "opaque") {
      cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
    }
    return res;
  })());
});

async function trim(cache){
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_COVERS; i++) await cache.delete(keys[i]);
}
