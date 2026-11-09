import { defineConfig } from "vitest/config";

// Test-only environment values (no real secrets).
export default defineConfig({
  test: {
    // Starting the in-memory MongoDB (and downloading it on first run) can be slow.
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:5173",
      MONGODB_URI: "mongodb://127.0.0.1:27017/nexora-test",
      JWT_ACCESS_SECRET: "test-secret-that-is-at-least-32-characters-long",
    },
  },
});
