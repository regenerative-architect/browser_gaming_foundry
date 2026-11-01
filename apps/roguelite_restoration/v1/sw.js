/* Static shell cache only. No remote hosts, opaque third-party fetches, or background sync. */
const CACHE='pocket-restoration-shell-v1';
const SHELL=[
  './','./index.html','./style.css','./manifest.webmanifest',
  './assets/icon-192.png','./assets/icon-512.png',
  './src/main.js','./src/core/constants.js','./src/core/engine.js','./src/core/game.js',
  './src/world/seed.js','./src/world/generate.js','./src/gameplay/actions.js',
  './src/progress/quests.js','./src/persistence/storage.js','./src/persistence/schema.js',
  './src/render/canvas.js','./src/ui/input.js'
];
self.addEventListener('install',event=>{
  // Atomic precache; a failed resource rejects installation instead of claiming offline readiness.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pocket-restoration-shell-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try{return await fetch(req);}catch(error){
      if(req.mode==='navigate'){
        const shell=await cache.match('./index.html');
        if(shell)return shell;
      }
      throw error;
    }
  })());
});
