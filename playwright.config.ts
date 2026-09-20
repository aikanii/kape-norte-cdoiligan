import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    launchOptions: {
      ...(process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"]
        ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] }
        : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: [
    { command: "node tests/fixtures/backend.mjs", port: 4100 },
    {
      command: "npm run dev -- --host 0.0.0.0 --port 3100",
      port: 3100,
      env: {
        SUPABASE_URL: "http://localhost:4100",
        SUPABASE_PUBLISHABLE_KEY: "test-public-key",
        VITE_SUPABASE_URL: "http://localhost:4100",
        VITE_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      },
    },
  ],
});
