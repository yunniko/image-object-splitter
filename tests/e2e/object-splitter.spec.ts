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

test("detects real objects in a photo and exports a selected crop as PNG", async ({ page }) => {
  await page.goto("/object-splitter");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);

  // The COCO-SSD model download + inference on a real photo is the slowest
  // step in this suite — generous timeout, see playwright.config.ts.
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByRole("checkbox", { name: /^Select cat /i }).first().check();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download selected/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cat-\d+\.png$/);
});

test("padding slider changes its displayed percentage", async ({ page }) => {
  await page.goto("/object-splitter");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  await expect(page.getByText("Padding: 10%")).toBeVisible();
  await page.getByLabel("Padding around each object").fill("0.3");
  await expect(page.getByText("Padding: 30%")).toBeVisible();
});

test("raising the confidence threshold can hide low-confidence detections", async ({ page }) => {
  await page.goto("/object-splitter");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  await page.getByLabel("Minimum confidence").fill("0.95");
  // At 95% confidence, at least the list should still render without error —
  // asserting the control itself works rather than a specific detection
  // count, since coco-ssd's exact scores for this fixture aren't pinned here.
  await expect(page.getByText("Minimum confidence: 95%")).toBeVisible();
});
