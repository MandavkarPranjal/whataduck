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
