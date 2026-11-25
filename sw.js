// 앱 껍데기만 저장해 둔다 (설치형 웹앱 조건 + 느린 데서 빨리 뜨게).
// 깃허브 API(피드 내용·열쇠가 오가는 곳)는 절대 저장하지 않는다.
const CACHE = 'kikyu-feed-v11';
const SHELL = ['./', 'index.html', 'app.js?v=11', 'style.css?v=11', 'manifest.webmanifest', 'icon-192.png', 'favicon.png'];

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
    fetch(e.request, { cache: 'no-cache' }) // 깃허브 페이지의 10분 붙잡기를 건너뛰고 늘 새 판 확인
      .then((r) => {
        if (r.ok && !url.searchParams.has('text') && !url.searchParams.has('url')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
