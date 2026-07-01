import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      // Browser-safe API contract shared with the Worker (src/contract.ts).
      "@shared": path.resolve(rootDir, "../src"),
    },
  },
  server: {
    proxy: {
      // Forward API calls to the local Worker (wrangler dev) during development.
      "/api": "http://localhost:8787",
    },
  },
});
