// ═══════════════════════════════════════════════
// لایتنر PWA — Service Worker v1
// ═══════════════════════════════════════════════

const CACHE_NAME = 'litreader-v3.8.3';
const RUNTIME_CACHE = 'litreader-runtime-v1';

// فایل‌هایی که موقع نصب کش میشن (فایل‌های اصلی اپ)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ─── نصب (Install) ───
// فایل‌های اصلی رو از قبل کش کن
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] ✅ Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting()) // فعال‌سازی فوری
  );
});

// ─── فعال‌سازی (Activate) ───
// کش‌های قدیمی رو پاک کن
self.addEventListener('activate', (event) => {
  console.log('[SW] 🔄 Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] 🗑️ Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // کنترل فوری همه تب‌ها
  );
});

// ─── رهگیری درخواست‌ها (Fetch) ───
// استراتژی: Network First برای APIها، Cache First برای فایل‌های محلی
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // فقط درخواست‌های GET رو مدیریت کن
  if (request.method !== 'GET') return;

  // درخواست‌های خارجی (CDN، API) → Network First + Runtime Cache
  if (url.origin !== location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // فایل‌های محلی → Cache First
  event.respondWith(cacheFirst(request));
});

// ─── استراتژی Cache First ───
// اول از کش بخون، اگه نبود از شبکه بگیر و کش کن
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    // فقط پاسخ‌های موفق رو کش کن
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // اگه آفلاین بود و کش هم نبود، صفحه اصلی رو برگردون
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return new Response('آفلاین هستید 😕', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// ─── استراتژی Network First ───
// اول شبکه، اگه نشد از کش
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // نتایج موفق رو در Runtime Cache ذخیره کن
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // آفلاین → از کش بخون
    const cached = await caches.match(request);
    if (cached) return cached;

    // اگه هیچی نبود
    return new Response('آفلاین هستید 😕', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}
