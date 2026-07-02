import { defineConfig } from "@playwright/test";

// E2E smoke against the unified (production-like) mode: the Worker serves the
// built SPA from dashboard/dist. Requires `.dev.vars` with JWT_SECRET, same as
// normal local dev (README → Setup).
export default defineConfig({
  testDir: "e2e",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  use: { baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command: "pnpm dashboard:build && pnpm db:migrate:local && pnpm dev",
    url: "http://127.0.0.1:8787/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
