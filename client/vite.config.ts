import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Same-origin API in development, mirroring the Vercel rewrite in production (AU-12).
    proxy: {
      // API_PROXY_TARGET lets a second copy (e.g. a test API) run beside the usual one.
      "/api": process.env.API_PROXY_TARGET ?? "http://localhost:4000",
    },
  },
});
