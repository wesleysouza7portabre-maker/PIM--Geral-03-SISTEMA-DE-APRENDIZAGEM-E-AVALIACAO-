import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export default defineConfig({
  testDir: fileURLToPath(new URL("../tests/web", import.meta.url)),
  outputDir: fileURLToPath(
    new URL("../../.local/test-results", import.meta.url),
  ),
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:5087",
    headless: true,
    launchOptions: existsSync(edge) ? { executablePath: edge } : {},
    screenshot: "only-on-failure",
  },
});
