import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4321",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
  },
  webServer: {
    command: "npm run preview -- --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
  },
  reporter: "list",
});
