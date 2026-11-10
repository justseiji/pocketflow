import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`a real account can plan, recover, undo and persist at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const accessibilityIssues: unknown[] = [];
    async function checkAccessibility(screen: string) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      accessibilityIssues.push(
        ...result.violations.map((v) => ({
          screen,
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      );
    }
    await page.goto("/");
    await expect(page.getByLabel("Your name")).toBeVisible();
    await checkAccessibility("registration");
    await page.getByLabel("Your name").fill("Sam");
    await page
      .getByLabel("Email address")
      .fill(`sam-${viewport.width}-${Date.now()}@example.test`);
    await page
      .getByLabel("Password", { exact: true })
      .fill("This is my test passphrase");
    await page.getByRole("button", { name: "Create your account" }).click();
    await expect(
      page.getByRole("heading", { name: "Hello, Sam." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add your first wallet" }).click();
    await page.getByLabel("Wallet name").fill("Cash");
    await page.getByLabel("Opening balance").fill("10000");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const nav = page.getByRole("navigation", {
      name: viewport.width < 700 ? "Mobile navigation" : "Main navigation",
      exact: true,
    });
    await nav.getByRole("button", { name: "Goals", exact: true }).click();
    await page.getByRole("button", { name: "New goal" }).click();
    await page.getByLabel("Goal name").fill("Rainy-day fund");
    await page.getByLabel("Target amount").fill("20000");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await nav.getByRole("button", { name: "Your plan", exact: true }).click();
    for (const row of [
      { name: "Everyday spending", limit: "4000", kind: "category" },
      { name: "New laptop", limit: "3000", kind: "purchase" },
      { name: "Rainy-day contribution", limit: "2000", kind: "savings" },
      {
        name: "Essential groceries",
        limit: "1000",
        kind: "category",
        essential: true,
      },
    ]) {
      await page
        .getByRole("button", { name: "Add allocation", exact: true })
        .click();
      await page.getByLabel("Name", { exact: true }).fill(row.name);
      await page.getByLabel("Allocation type").selectOption(row.kind);
      await page.getByLabel("Period allocation").fill(row.limit);
      if (row.kind === "savings")
        await page
          .getByLabel("Savings goal")
          .selectOption({ label: "Rainy-day fund" });
      if (row.essential) await page.getByLabel("This is essential").check();
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await nav.getByRole("button", { name: "Money GPS" }).click();
    await page
      .getByRole("button", { name: "Explore an unexpected expense" })
      .click();
    await page.getByLabel("Unexpected amount").fill("1200");
    await page.getByLabel("What happened?").fill("Urgent repair");
    await page.getByRole("button", { name: "Find my routes" }).click();
    await expect(
      page.getByRole("heading", { name: "3 ways to find your balance" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/routes-${viewport.width}.png`,
      fullPage: true,
    });
    await checkAccessibility("routes");
    await page
      .getByRole("button", { name: "Review this route" })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Take this route?" }),
    ).toBeVisible();
    await checkAccessibility("confirmation");
    await page.getByRole("button", { name: "Confirm and apply route" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page
      .getByRole("button", { name: "Undo recovery", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(/· Undone/)).toBeVisible();
    await page
      .getByRole("button", { name: "Add transaction", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Amount", exact: true })
      .fill("250");
    await page
      .getByLabel("Category", { exact: true })
      .selectOption({ label: "Everyday spending" });
    await page.getByLabel("Note (optional)").fill("Lunch with friends");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Hello, Sam." }),
    ).toBeVisible();
    await expect(page.getByText("Lunch with friends")).toBeVisible();
    await expect(page.locator(".hero-money")).toHaveText("₱9,750.00");
    await page.screenshot({
      path: `test-results/overview-${viewport.width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await checkAccessibility("overview");
    expect(accessibilityIssues).toEqual([]);
    await nav
      .getByRole("button", { name: "Transactions", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search transactions" })
      .fill("Lunch");
    await page.getByRole("button", { name: /Lunch with friends/ }).click();
    await page
      .getByRole("textbox", { name: "Amount", exact: true })
      .fill("300");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: /Lunch with friends/ }).click();
    await page
      .getByRole("button", { name: "Delete record", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Delete record", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /Lunch with friends/ }),
    ).toHaveCount(0);
    await nav.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page.locator(".hero-money")).toHaveText("₱10,000.00");
  });
}
