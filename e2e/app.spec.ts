import { expect, test } from "@playwright/test";

test("search and detail navigation are URL-driven", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("searchbox", { name: "Search companies" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search companies" }).fill("co");
  await expect(page).toHaveURL(/\?q=co/);

  await page.getByRole("button", { name: /open coles group details/i }).click();
  await expect(page).toHaveURL(/\/company\/coles-group\?q=co/);
  await expect(page.getByText("Coles Graduate Program", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: /close company details|close detail panel/i }).first().click();
  await expect(page).toHaveURL(/\/?\?q=co/);
});

test("progress state moves between board columns", async ({ page }) => {
  await page.goto("/");

  const progressButton = page.getByRole("button", { name: /progress for coles group/i });
  await progressButton.click();
  await expect(progressButton).toContainText("Saved");

  await page.getByRole("tab", { name: /board view/i }).click();
  await expect(page).toHaveURL(/view=board/);

  const savedColumn = page.locator('[data-progress-column="saved"]');
  const appliedColumn = page.locator('[data-progress-column="applied"]');
  const card = savedColumn.locator('[data-company-id="coles-group"]');

  await expect(card).toBeVisible();
  await card.dragTo(appliedColumn);

  await expect(appliedColumn.locator('[data-company-id="coles-group"]')).toBeVisible();
});
