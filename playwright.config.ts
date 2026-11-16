import { defineConfig, devices } from "@playwright/test";

// End-to-end journeys (NFR-TEST, Sprint 7): the real client and API against an in-memory
// database. `npm run e2e` starts both; each test resets to the demo data first.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // one shared database
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx e2e/stack.ts",
      url: "http://localhost:4100/api/v1/health",
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command: "npm run dev -w client -- --port 5180 --strictPort",
      url: "http://localhost:5180",
      timeout: 120_000,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: "http://localhost:4100" },
    },
  ],
});
