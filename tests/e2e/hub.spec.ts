import { test, expect } from "@playwright/test";

test("hub page links to both tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Image Object Splitter" })).toBeVisible();
  await page.getByRole("link", { name: /Object splitter/ }).click();
  await expect(page).toHaveURL(/\/object-splitter$/);
  await page.goto("/");
  await page.getByRole("link", { name: /Background remover/ }).click();
  await expect(page).toHaveURL(/\/background-remover$/);
});
