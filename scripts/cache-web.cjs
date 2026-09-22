// Cache only application assets. Ledger data stays in uni storage, never in the service worker.
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../unpackage/dist/build/web');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
const files = walk(root).filter(file => /\.(html|js|css|png|woff2?|ttf|svg|ico)$/.test(file) && !file.endsWith('sw.js'));
const version = crypto.createHash('sha256'); files.forEach(file => version.update(fs.readFileSync(file)));
const urls = files.map(file => './' + path.relative(root, file).split(path.sep).join('/'));
const cache = 'nice-tally-assets-' + version.digest('hex').slice(0, 12);
fs.writeFileSync(path.join(root, 'sw.js'), `const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nice-tally-assets-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.match('./index.html'))); return; }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
`);
const index = path.join(root, 'index.html');
fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('</body>', `<script>if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });</script></body>`));
console.log(`Offline app cache generated (${urls.length} local assets).`);
