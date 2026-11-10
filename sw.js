/* Book Club — saves book covers on each phone after they've loaded once,
   so they appear instantly (even on poor signal) next time.
   Only cover images are handled here; everything else goes to the internet as normal.
   Only images that downloaded properly are saved — a failed download is never kept. */

const CACHE = "bookclub-covers-v2";
const MAX_COVERS = 400;   // keep at most this many saved covers per phone (oldest removed first)

// Where covers come from: the club's own Supabase storage, plus the book databases.
const COVER_HOSTS = ["covers.openlibrary.org", "archive.org", "books.google.com", "books.googleusercontent.com"];
const isCover = url =>
  (url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/public/covers/")) ||
  COVER_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  // remove older saved-cover stores (v1 could hold failed downloads)
  for (const k of await caches.keys()) if (k.startsWith("bookclub-covers-") && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url; try { url = new URL(req.url); } catch (e) { return; }
  if (!isCover(url)) return;   // not a cover: leave it alone

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(req.url);
    if (saved) return saved;                                  // already on the phone
    try {
      // Ask for a readable copy so we can check it really is an image before saving it
      const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
      const type = res.headers.get("content-type") || "";
      if (res.ok && type.startsWith("image/")) {
        cache.put(req.url, res.clone()).then(() => trim(cache)).catch(() => {});
      }
      return res;
    } catch (e) {
      return fetch(req);   // that source doesn't allow a readable copy: just show it, don't save
    }
  })());
});

async function trim(cache){
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_COVERS; i++) await cache.delete(keys[i]);
}
