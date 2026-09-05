import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Derive __dirname in an ES module context.
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: "autoUpdate",
            manifest: {
                name: 'whataduck',
                short_name: 'whataduck',
                start_url: '/',
                display: 'standalone',
                background_color: '#0d0d0d',
                theme_color: '#0d0d0d',
                lang: 'en',
                scope: '/',
                icons: [
                    // Add icons if available in future
                ],
            },
            workbox: {
                // index.html only handles the redirect/landing route. Search
                // and blocklist are separate precached pages — don't serve
                // the redirect shell for their navigations offline.
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/search/, /^\/blocklist/],
                // The 1.6MB bang dataset must NOT be precached: it is
                // versioned separately (data/bangs-version.json is tiny and
                // precached) and fetched on demand. Clients re-download it
                // only when the version actually changes, not per deploy.
                globIgnores: ['**/data/bangs.min.json', '**/data/bangs-patch-*.json'],
                runtimeCaching: [
                    {
                        // Versioned dataset + differential patches.
                        urlPattern: /\/data\/bangs.*\.json$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'whataduck-bangs-data',
                            expiration: {
                                maxEntries: 4,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days; version file gates freshness
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            }
        }),
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                search: resolve(__dirname, "search.html"),
                blocklist: resolve(__dirname, "blocklist.html"),
            },
        },
    },
});
