const CACHE_NAME = 'mtn-tv-guide-v1';

const PRECACHE_URLS = [
    '/',
    '/programs',
    '/youtube',
    '/favicon.svg',
    '/favicon.ico',
    '/manifest.json',
];

// インストール: 基本ページをキャッシュ
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

// アクティベート: 古いキャッシュを削除
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

// フェッチ: HTML は Network First、その他は Cache First
self.addEventListener('fetch', function (event) {
    var request = event.request;

    // GET 以外・chrome-extension はスキップ
    if (request.method !== 'GET' || !request.url.startsWith('http')) {
        return;
    }

    // 外部リソース（YouTube サムネイルなど）はキャッシュしない
    var url = new URL(request.url);
    if (url.origin !== location.origin) {
        return;
    }

    var isNavigation = request.mode === 'navigate';

    if (isNavigation) {
        // HTML: Network First → 失敗時キャッシュ
        event.respondWith(
            fetch(request).then(function (response) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, clone);
                });
                return response;
            }).catch(function () {
                return caches.match(request).then(function (cached) {
                    return cached || caches.match('/');
                });
            })
        );
    } else {
        // 静的アセット: Cache First → 失敗時ネットワーク
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
    }
});
