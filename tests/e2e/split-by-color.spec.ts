import { test, expect } from "@playwright/test";
import { makeSyntheticPng } from "./helpers/synthetic-png";
import { readPngDimensions } from "./helpers/read-png-dimensions";

const WHITE = { r: 255, g: 255, b: 255 };
const RED = { r: 220, g: 30, b: 30 };
const GREEN = { r: 30, g: 180, b: 30 };
const BLUE = { r: 30, g: 30, b: 220 };

// Three well-separated, perfectly-sharp-edged squares on a white
// background — deterministic ground truth for the segmentation algorithm,
// no photo/JPEG noise to account for. Regenerated per test (not a committed
// fixture) since the whole point of makeSyntheticPng is that it's cheap and
// exact, unlike sourcing a real photo (see two-cats.jpg's own licensing
// rationale in HANDOVER.md D1 for why that one IS fetched-not-committed).
function iconSheetPng(): Buffer {
  return makeSyntheticPng(300, 100, WHITE, [
    { x: 20, y: 20, width: 40, height: 40, color: RED },
    { x: 130, y: 30, width: 40, height: 40, color: GREEN },
    { x: 240, y: 10, width: 40, height: 40, color: BLUE },
  ]);
}

test("detects three separate regions on a synthetic icon sheet", async ({ page }) => {
  await page.goto("/split-by-color");
  await page.getByLabel("Choose an image").setInputFiles({ name: "icons.png", mimeType: "image/png", buffer: iconSheetPng() });

  await expect(page.getByLabel("Select region 1")).toBeVisible();
  await expect(page.getByLabel("Select region 2")).toBeVisible();
  await expect(page.getByLabel("Select region 3")).toBeVisible();
  await expect(page.getByLabel(/Select region 4/)).toHaveCount(0);
  await expect(page.getByTestId("status")).not.toContainText("No separate regions");
});

test("exports a selected region cropped with padding applied", async ({ page }) => {
  await page.goto("/split-by-color");
  await page.getByLabel("Choose an image").setInputFiles({ name: "icons.png", mimeType: "image/png", buffer: iconSheetPng() });
  await expect(page.getByLabel("Select region 1")).toBeVisible();

  // Default padding is 10%: a 40x40 region pads by 4px on every side -> 48x48.
  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByLabel("Select region 1").check();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download selected/ }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  expect(download.suggestedFilename()).toBe("region-1.png");
  expect(readPngDimensions(filePath!)).toEqual({ width: 48, height: 48 });
});

test("composes with resize-to-box: exported region matches the requested box exactly", async ({ page }) => {
  await page.goto("/split-by-color");
  await page.getByLabel("Choose an image").setInputFiles({ name: "icons.png", mimeType: "image/png", buffer: iconSheetPng() });
  await expect(page.getByLabel("Select region 1")).toBeVisible();

  await page.getByRole("button", { name: "Deselect all" }).click();
  await page.getByLabel("Select region 1").check();

  await page.getByLabel("Resize exported images to fit a box").check();
  await page.getByLabel("Resize width in pixels").fill("200");
  await page.getByLabel("Resize height in pixels").fill("100");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download selected/ }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(readPngDimensions(filePath!)).toEqual({ width: 200, height: 100 });
});

test("raising the tolerance enough can make a near-background-color region disappear", async ({ page }) => {
  // A single square whose color is close-but-not-too-close to white: RGB
  // distance from {255,255,255} is sqrt(25^2+45^2+45^2) ≈ 68.4, i.e. ~15.5%
  // of the max possible distance (441.67) — outside the default 12%
  // tolerance (~53) so it starts out as its own region, but well within
  // reach of the slider's 0-40% range once raised.
  const NEAR_WHITE = { r: 230, g: 210, b: 210 };
  const png = makeSyntheticPng(200, 100, WHITE, [{ x: 20, y: 20, width: 40, height: 40, color: NEAR_WHITE }]);

  await page.goto("/split-by-color");
  await page.getByLabel("Choose an image").setInputFiles({ name: "near-white.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel("Select region 1")).toBeVisible();

  await page.getByLabel("Color match tolerance").fill("20"); // -> distance ~88.3, above the 68.4 threshold
  await expect(page.getByTestId("status")).toContainText("No separate regions");
  await expect(page.getByLabel("Select region 1")).toHaveCount(0);
});

test("overriding the background color picker changes what counts as a region", async ({ page }) => {
  // A single red square, well clear of every edge, on a white canvas: the
  // white background surrounds it on all sides and touches every edge, so
  // "everything that isn't background" is exactly the square — one region,
  // 40x40.
  const png = makeSyntheticPng(200, 100, WHITE, [{ x: 20, y: 20, width: 40, height: 40, color: RED }]);
  await page.goto("/split-by-color");
  await page.getByLabel("Choose an image").setInputFiles({ name: "square.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Region 1 (40×40px)")).toBeVisible();

  // Override the background color to the square's own color (220,30,30 ->
  // #dc1e1e) instead of the correctly auto-detected white. Now the *white*
  // canvas is what's far from "background," so the single detected region
  // flips to the white area's own bounding box — the full 200x100 canvas,
  // since white touches every edge. A clean, deterministic way to prove the
  // override actually feeds into segmentation, not just cosmetically changes
  // the swatch.
  //
  // input[type=color] doesn't behave like a text input under Playwright's
  // fill(). Setting `.value` directly and dispatching a plain "input" event
  // isn't enough either — React wraps the native value setter to track
  // "did this actually change," and a raw property assignment bypasses that
  // tracking, so React never sees the change. Going through the *native*
  // setter (bypassing React's wrapped one) before dispatching the event is
  // the standard workaround for driving a React-controlled input from
  // outside simulated user typing.
  await page.getByLabel("Background color to split around").evaluate((el: HTMLInputElement) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    nativeSetter.call(el, "#dc1e1e");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByText("Region 1 (200×100px)")).toBeVisible();
});
