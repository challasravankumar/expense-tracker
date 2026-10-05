import { test, expect } from "@playwright/test";
test("expense create, edit, delete, filters, reports, budgets and theme", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo" }).click();
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-light-dashboard.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("123.45");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-expense-form.png`,
  });
  await page
    .getByLabel("Description / item name")
    .fill("Verification purchase");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  await page.getByLabel("Search expenses").fill("Verification purchase");
  await expect(page.locator(".expense-row")).toHaveCount(1);
  await expect(page.locator(".expense-row")).toContainText("₹123.45");
  await page
    .getByRole("button", { name: "Edit Verification purchase", exact: true })
    .click();
  await page.getByLabel("Amount (₹)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your input is still here",
  );
  await page.getByLabel("Amount (₹)", { exact: true }).fill("150.75");
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.locator(".expense-row")).toContainText("₹150.75");
  await page
    .getByRole("button", { name: "Delete Verification purchase", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".expense-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Delete Verification purchase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete expense", exact: true })
    .click();
  await expect(page.locator(".expense-row")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  await page.getByRole("button", { name: "Yearly", exact: true }).click();
  await expect(
    page.getByText("Average monthly spending", { exact: true }),
  ).toBeVisible();
  await page.locator(".chart button").first().click();
  await expect(
    page.getByRole("button", { name: "Monthly", exact: true }),
  ).toHaveClass(/selected/);
  await page.locator(".chart button").first().click();
  await expect(
    page.getByRole("button", { name: "Daily", exact: true }),
  ).toHaveClass(/selected/);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Budgets", exact: true })
    .click();
  await page.getByLabel("Budget month", { exact: true }).fill(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .slice(0, 7),
  );
  await page.getByLabel("Overall budget (₹)", { exact: true }).fill("1");
  await page
    .locator(".budget")
    .first()
    .getByRole("button", { name: "Save budget" })
    .click();
  await expect(page.locator(".budget").first()).toContainText("over budget");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page.screenshot({
    path: `test-results/${info.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Explore demo" }),
  ).toBeVisible();
});
test("JSON validation and category editing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore demo" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("New category", { exact: true }).fill("Pet care");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(page.getByText("Pet care", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Rename Pet care", exact: true })
    .click();
  await page.getByLabel("Rename category", { exact: true }).fill("Pets");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByText("Pets", { exact: true })).toBeVisible();
  await page.getByLabel("Import JSON backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schema_version":9}'),
  });
  await expect(page.getByRole("alert")).toContainText("version 1");
});
