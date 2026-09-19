// キャッシュ名を変えると、古いキャッシュは activate 時に破棄される
const CACHE_NAME = 'mtn-tv-guide-v2';

/*
 | サブパス（/outdoor-tv/）配信のため、絶対パスではなく sw.js からの相対パスで指定する。
 | 絶対パス '/' だと GitHub Pages のルートを指してしまい precache が全て失敗する。
 |
 | 天気ページは 1.5MB と大きいので precache には含めず、閲覧時にキャッシュさせる。
 */
const PRECACHE_URLS = [
    './',
    './youtube/',
    './favicon.svg',
    './manifest.json',
];

self.addEventListener('install', function (event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS.map(function (url) {
                return new Request(url, { credentials: 'same-origin' });
            })).catch(function () {
                // precache 失敗は無視（オフライン初回インストール対策）
            });
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) { return key !== CACHE_NAME; })
                    .map(function (key) { return caches.delete(key); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

// ページ側から更新を促されたら、待機中の Service Worker を即座に有効化する
self.addEventListener('message', function (event) {
    if (event.data === 'skip-waiting') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', function (event) {
    var request = event.request;

    if (request.method !== 'GET' || !request.url.startsWith('http')) {
        return;
    }

    var url = new URL(request.url);
    if (url.origin !== location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        // HTML: 常にネットワークを優先し、取得できたものをキャッシュに残す
        event.respondWith(
            fetch(request).then(function (response) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, clone);
                });
                return response;
            }).catch(function () {
                // オフライン時のみキャッシュを使う
                return caches.match(request).then(function (cached) {
                    return cached || caches.match('./');
                });
            })
        );
        return;
    }

    // 画像やアイコンなどはキャッシュ優先
    event.respondWith(
        caches.match(request).then(function (cached) {
            if (cached) return cached;
            return fetch(request).then(function (response) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, clone);
                });
                return response;
            });
        })
    );
});
