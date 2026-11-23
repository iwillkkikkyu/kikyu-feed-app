// 앱 껍데기만 저장해 둔다 (설치형 웹앱 조건 + 느린 데서 빨리 뜨게).
// 깃허브 API(피드 내용·열쇠가 오가는 곳)는 절대 저장하지 않는다.
const CACHE = 'kikyu-feed-v3';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'favicon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // 새 판을 먼저 받고, 안 되면 저장본. 공유로 들어온 주소(?text=…)도 같은 화면을 돌려준다.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && !url.search) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
