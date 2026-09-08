import { defineConfig } from "@playwright/test";

const PORT = 30111;

export default defineConfig({
  testDir: "./tests/e2e",
  // Model downloads (coco-ssd, @imgly/background-removal) make the ML-backed
  // tests slower than a typical svc-lab service's e2e suite — see
  // HANDOVER.md's testing-strategy decision record entry.
  timeout: 180_000,
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
