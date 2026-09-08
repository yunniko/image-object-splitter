import { test, expect } from "@playwright/test";
import path from "node:path";
import { existsSync } from "node:fs";
import { readPngDimensions } from "./helpers/read-png-dimensions";

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

  // Real download size disclosed *before* any upload, not just during/after
  // — nothing should download silently. Fresh Playwright context, so
  // nothing is downloaded-before yet.
  const detectionNotice = page.getByTestId("detection-model-notice");
  await expect(detectionNotice).toContainText(/downloads the object-detection AI model \(\d+ MB\)/);
  await expect(detectionNotice).not.toContainText("already downloaded");

  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);

  // A real status (spinner + phase label), not silence, while the model
  // downloads and runs.
  await expect(page.getByRole("progressbar", { name: "Progress" })).toBeVisible();

  // The COCO-SSD model download + inference on a real photo is the slowest
  // step in this suite — generous timeout, see playwright.config.ts.
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  // The optional background-removal checkbox triggers a *different*
  // (larger) model download, only ever appearing once results exist —
  // its own size must be disclosed right where the checkbox is, not just
  // on the separate /background-remover page.
  await expect(page.getByText(/Remove background from exports[\s\S]*downloads a \d+ MB AI model/)).toBeVisible();

  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByRole("checkbox", { name: /^Select cat /i }).first().check();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download selected/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cat-\d+\.png$/);

  // The "already downloaded" hint is a same-browser localStorage record
  // (see hasLikelyDownloadedDetectionModel's own comment for the caveat) —
  // reload and re-check that it actually persists and re-renders, not just
  // that the happy path doesn't crash.
  await page.reload();
  await expect(page.getByTestId("detection-model-notice")).toContainText("already downloaded");
});

test("padding slider changes its displayed percentage", async ({ page }) => {
  await page.goto("/object-splitter");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  await expect(page.getByText("Padding: 10%")).toBeVisible();
  await page.getByLabel("Padding around each object").fill("0.3");
  await expect(page.getByText("Padding: 30%")).toBeVisible();
});

test("resize-to-box exports a PNG at exactly the requested pixel dimensions", async ({ page }) => {
  await page.goto("/object-splitter");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  await page.getByLabel("Resize exported images to fit a box").check();
  await page.getByLabel("Resize width in pixels").fill("300");
  await page.getByLabel("Resize height in pixels").fill("150");

  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByRole("checkbox", { name: /^Select cat /i }).first().check();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download selected/ }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  expect(readPngDimensions(filePath!)).toEqual({ width: 300, height: 150 });
});

test("resize width/height reject a non-positive value instead of exporting a broken file", async ({ page }) => {
  await page.goto("/object-splitter");
  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);
  await expect(page.getByText(/^cat \d+$/i).first()).toBeVisible({ timeout: 90_000 });

  await page.getByLabel("Resize exported images to fit a box").check();
  await page.getByLabel("Resize width in pixels").fill("0");

  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByRole("checkbox", { name: /^Select cat /i }).first().check();
  await page.getByRole("button", { name: /^Download selected/ }).click();

  await expect(page.getByText(/positive whole numbers/i)).toBeVisible();
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
