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
                navigateFallback: '/index.html',
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
