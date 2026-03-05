import { expect, test } from "@playwright/test";

test("search and detail navigation are URL-driven", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("searchbox", { name: "Search companies" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search companies" }).fill("co");
  await expect(page).toHaveURL(/\?q=co/);

  await page.getByRole("button", { name: /open coles group details/i }).click();
  await expect(page).toHaveURL(/\/company\/coles-group\?q=co/);
  await expect(page.getByText("Coles Graduate Program", { exact: false })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Listing view tabs" })).toHaveCount(0);

  await page.getByRole("button", { name: /close company details|close detail panel/i }).first().click();
  await expect(page).toHaveURL(/\/?\?q=co/);
});

test("progress state moves between board columns", async ({ page }) => {
  await page.goto("/");

  const progressButton = page.getByRole("button", { name: /progress for coles group/i });
  await progressButton.click();
  await expect(progressButton).toContainText("Saved");

  await page.getByRole("tab", { name: /tracking view|board view/i }).click();
  await expect(page).toHaveURL(/view=board/);

  const savedColumn = page.locator('[data-progress-column="saved"]');
  const appliedColumn = page.locator('[data-progress-column="applied"]');
  const card = savedColumn.locator('[data-company-id="coles-group"]');

  await expect(card).toBeVisible();
  await card.dragTo(appliedColumn);

  await expect(appliedColumn.locator('[data-company-id="coles-group"]')).toBeVisible();
});

test("header logo is compact, flush-left, and progress expansion does not cause horizontal overflow", async ({ page }) => {
  await page.goto("/");

  const logo = page.locator(".app-header__logo");
  await expect(logo).toBeVisible();
  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    return;
  }
  expect(box.x).toBeLessThanOrEqual(1);

  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 600) {
    expect(box.width).toBeLessThan(170);
  } else {
    expect(box.width).toBeLessThan(220);
  }

  await page.getByRole("button", { name: /progress for coles group/i }).hover();
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasOverflow).toBeFalsy();
});
