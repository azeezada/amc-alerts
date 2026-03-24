import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3007",
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "PORT=3007 npm run dev",
    port: 3007,
    timeout: 30000,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
