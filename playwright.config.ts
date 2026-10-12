import { defineConfig } from "@playwright/test";
const remote = process.env.PULSETOOLS_TEST_URL;
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  use: {
    baseURL: remote || "http://127.0.0.1:4321",
    browserName: "chromium",
    channel: "msedge",
    headless: true,
  },
  webServer: remote
    ? undefined
    : {
        command: "npm run preview -- --port 4321",
        url: "http://127.0.0.1:4321",
        reuseExistingServer: false,
      },
  reporter: "list",
});
