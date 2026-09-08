import { test, expect } from "@playwright/test";
import path from "node:path";
import { existsSync } from "node:fs";

const FIXTURE = path.join(__dirname, "fixtures", "two-cats.jpg");

test.beforeAll(() => {
  if (!existsSync(FIXTURE)) {
    throw new Error(
      `Missing test fixture ${FIXTURE} — run "npm run fetch-test-fixtures" first (see scripts/fetch-test-fixtures.mjs).`,
    );
  }
});

test("removes the background from a real photo and downloads a PNG", async ({ page }) => {
  await page.goto("/background-remover");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);

  // The segmentation model download + inference is the slowest step in
  // this whole suite — generous timeout, see playwright.config.ts and
  // HANDOVER.md's testing-strategy entry.
  await expect(page.getByTestId("result-image")).toBeVisible({ timeout: 150_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("two-cats-no-bg.png");
});
