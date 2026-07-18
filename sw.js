const CACHE_NAME = "michael-qr-v3";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

const POLYFILL = `<script>
if (typeof TextEncoder === "undefined") {
  window.TextEncoder = class {
    encode(str) {
      const utf8 = unescape(encodeURIComponent(str));
      const out = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) out[i] = utf8.charCodeAt(i);
      return out;
    }
  };
}
</script>`;

function patchHtml(html) {
  if (html.includes('typeof TextEncoder === "undefined"')) return html;
  return html.replace("<script>(()=>", `${POLYFILL}<script>(()=>`);
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          const html = await response.text();
          return new Response(patchHtml(html), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          const html = cached ? await cached.text() : "Offline";
          return new Response(patchHtml(html), { headers: { "Content-Type": "text/html; charset=utf-8" } });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});