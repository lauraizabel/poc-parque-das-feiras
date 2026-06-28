import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const appDir = __dirname;
const repoRoot = path.resolve(appDir, "..", "..");
const apiPort = "3101";
const dashboardPort = "3102";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${dashboardPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: [
    {
      command: "pnpm --filter @acme/api start",
      cwd: repoRoot,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      env: {
        ...process.env,
        PORT: apiPort,
        API_URL: `http://127.0.0.1:${apiPort}`,
        DASHBOARD_URL: `http://127.0.0.1:${dashboardPort}`
      },
      timeout: 120_000
    },
    {
      command: `pnpm build && pnpm exec next start --port ${dashboardPort}`,
      cwd: appDir,
      url: `http://127.0.0.1:${dashboardPort}`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...process.env,
        PORT: dashboardPort,
        API_URL: `http://127.0.0.1:${apiPort}`,
        DASHBOARD_URL: `http://127.0.0.1:${dashboardPort}`,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_PUBLIC_DASHBOARD_URL: `http://127.0.0.1:${dashboardPort}`
      }
    }
  ]
});
