const PREFIX='em-moloko:'+new URL('./',self.location).pathname+':';
const CACHE=PREFIX+'af3bd966f939';
const FILES=["./index.html","./styles.css","./app.js","./core.js","./storage.js","./recipes.js","./manifest.webmanifest","./assets/icon-192.png","./assets/icon-512.png","./assets/icon-180.png","./assets/author.jpg","./assets/taplink-qr.png"];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(FILES.map(file=>new Request(new URL(file,self.location),{cache:'reload'})));})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),base=new URL('./',self.location);
 if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const relative=url.pathname.slice(base.pathname.length);
 if(!FILES.includes('./'+relative)&&relative!=='')return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const key=new URL(relative===''?'./index.html':'./'+relative,self.location);const hit=await cache.match(key);return hit||fetch(event.request);})());
});
