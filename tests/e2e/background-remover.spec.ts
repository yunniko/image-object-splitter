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

  // Quality picker: real download sizes shown, "Balanced" selected by
  // default, nothing marked as previously downloaded yet (fresh browser
  // context per Playwright test). Scoped to the fieldset itself, not the
  // whole page — the FAQ section below also discusses the "downloaded
  // before in this browser" hint in prose, and Playwright's text matching
  // is case-insensitive by default, so an unscoped match would find that
  // too.
  const qualityPicker = page.locator("fieldset");
  await expect(qualityPicker.getByText(/42 MB download/)).toBeVisible();
  await expect(qualityPicker.getByText(/84 MB download/)).toBeVisible();
  await expect(qualityPicker.getByText(/168 MB download/)).toBeVisible();
  await expect(page.getByLabel("Balanced (recommended)")).toBeChecked();
  await expect(qualityPicker.getByText("downloaded before in this browser")).toHaveCount(0);

  await page.getByLabel("Choose a photo").setInputFiles(FIXTURE);

  // A real, byte-accurate progress bar should appear while the model
  // downloads/runs, not just a static "please wait" string.
  await expect(page.getByRole("progressbar", { name: "Progress" })).toBeVisible();

  // The segmentation model download + inference is the slowest step in
  // this whole suite — generous timeout, see playwright.config.ts and
  // HANDOVER.md's testing-strategy entry.
  await expect(page.getByTestId("result-image")).toBeVisible({ timeout: 150_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("two-cats-no-bg.png");

  // The "downloaded before" hint is a same-browser-context localStorage
  // record, not a live cache check (see hasLikelyDownloadedModel's own
  // comment) — reloading and re-checking the picker confirms the hint
  // actually persists and re-renders correctly, not just that it doesn't
  // crash the happy path.
  await page.reload();
  const qualityPickerAfterReload = page.locator("fieldset");
  await expect(qualityPickerAfterReload.getByText(/Balanced \(recommended\)[\s\S]*downloaded before in this browser/)).toBeVisible();
});
