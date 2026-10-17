import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "npm run build && npm start -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/workspace",
    reuseExistingServer: false,
    timeout: 120_000,
    // Defense in depth: even an accidentally unmocked API call cannot use quota.
    env: { AI_PROVIDER: "", GROQ_API_KEY: "", GEMINI_API_KEY: "", NEXT_PUBLIC_BLUEPRINT_DAILY_LIMIT: "12" },
  },
});
