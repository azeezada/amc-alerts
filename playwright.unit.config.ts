import { defineConfig } from "@playwright/test";

// Unit test config — no webServer needed.
// Runs pure-function tests that import directly from src files.
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*unit*.spec.ts",
  timeout: 10000,
  retries: 0,
  projects: [{ name: "unit" }],
});
