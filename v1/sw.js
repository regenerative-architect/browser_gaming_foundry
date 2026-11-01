/* Offline shell for HTTPS/localhost only; no external requests cached. */
const CACHE='browser_game_fusion_v1_0_0';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install', event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('browser_game_fusion_')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;event.respondWith(caches.match(req).then(saved=>saved||fetch(req)));});
