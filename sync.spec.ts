import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
// Deliberate API stubs: validates browser behavior, not live Supabase services.
test("online UI keeps failed form, retries once, refreshes a second device and survives page refresh", async ({
  browser,
}) => {
  const userId = randomUUID(),
    cat = randomUUID();
  let expenses: any[] = [];
  let fail = true;
  let saves = 0;
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = {
    access_token: "fake.access.token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "fake-refresh",
    user,
  };
  const setup = async (ctx: BrowserContext) => {
    await ctx.route("https://expense-tests.supabase.co/**", async (route) => {
      const url = new URL(route.request().url());
      const body = route.request().postDataJSON();
      let response: any = {};
      let status = 200;
      if (url.pathname.includes("/auth/v1/token")) response = token;
      else if (url.pathname.includes("/auth/v1/user")) response = user;
      else if (url.pathname.endsWith("/expense_snapshot"))
        response = {
          expenses,
          categories: [{ id: cat, name: "Groceries", archived: false }],
          budgets: [],
        };
      else if (url.pathname.endsWith("/save_expense")) {
        saves++;
        if (fail) {
          status = 503;
          response = { message: "Connection interrupted", code: "unavailable" };
        } else {
          if (!expenses.some((x) => x.id === body.item.id))
            expenses.push({ ...body.item, version: 1 });
        }
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    });
  };
  const a = await browser.newContext(),
    b = await browser.newContext();
  await setup(a);
  await setup(b);
  const first = await a.newPage(),
    second = await b.newPage();
  for (const p of [first, second]) {
    await p.goto("http://127.0.0.1:5173/");
    await p.getByLabel("Email", { exact: true }).fill("test@example.com");
    await p.getByLabel("Password", { exact: true }).fill("test-password");
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      p.getByRole("button", { name: "Add Expense", exact: true }),
    ).toBeEnabled();
  }
  await first.getByRole("button", { name: "Add Expense", exact: true }).click();
  await first.getByLabel("Amount (₹)", { exact: true }).fill("12.34");
  await first.getByLabel("Description / item name").fill("Network retry check");
  await first
    .getByRole("button", { name: "Save expense", exact: true })
    .click();
  await expect(first.getByRole("dialog")).toContainText(
    "Your input is still here",
  );
  await expect(first.getByLabel("Amount (₹)", { exact: true })).toHaveValue(
    "12.34",
  );
  fail = false;
  await first
    .getByRole("button", { name: "Retry save", exact: true })
    .dblclick();
  await expect(first.getByRole("dialog")).toHaveCount(0);
  expect(expenses).toHaveLength(1);
  expect(saves).toBe(2);
  await second
    .getByRole("button", { name: "Refresh expenses", exact: true })
    .click();
  await expect(
    second.getByText("Network retry check", { exact: true }),
  ).toBeVisible();
  await second
    .getByRole("navigation")
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  await second.reload();
  await expect(
    second.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  expect(expenses).toHaveLength(1);
  await a.close();
  await b.close();
});
