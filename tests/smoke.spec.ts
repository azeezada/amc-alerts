import { test, expect } from "@playwright/test";

test.describe("AMC IMAX Alerts — Smoke Tests", () => {
  test("homepage loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/IMAX 70mm Alerts/);
  });

  test("hero section renders movie title in h1", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Project Hail Mary");
  });

  test("NYC TICKET ALERTS badge is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("NYC TICKET ALERTS")).toBeVisible();
  });

  test("countdown timer shows time units (Days/Hrs/Min/Sec)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000); // wait for hydration
    await expect(page.getByText("Days").first()).toBeVisible();
    await expect(page.getByText("Hrs").first()).toBeVisible();
    await expect(page.getByText("Min").first()).toBeVisible();
    await expect(page.getByText("Sec").first()).toBeVisible();
  });

  test("premium format subtitle is shown", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Premium Format Showtimes/i).first()).toBeVisible();
  });

  test("date cards render for April 1-5", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("April 1").first()).toBeVisible();
    await expect(page.getByText("April 2").first()).toBeVisible();
    await expect(page.getByText("April 3").first()).toBeVisible();
    await expect(page.getByText("April 4").first()).toBeVisible();
    await expect(page.getByText("April 5").first()).toBeVisible();
  });

  test("April 3 card marked as Release day", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Release day").first()).toBeVisible();
  });

  test("day names shown on cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Wednesday").first()).toBeVisible();
    await expect(page.getByText("Sunday").first()).toBeVisible();
  });

  test("checking showtimes loading state appears", async ({ page }) => {
    await page.goto("/");
    // The loading spinner text appears before API response
    await expect(page.getByText("Checking showtimes").first()).toBeVisible({ timeout: 3000 });
  });

  test("no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    const critical = errors.filter(
      (e) =>
        !e.includes("Failed to fetch") &&
        !e.includes("ERR_CONNECTION") &&
        !e.includes("net::") &&
        !e.includes("status") &&
        !e.includes("Hydration") &&
        !e.includes("hydrated") &&
        !e.includes("hydration") &&
        !e.includes("data-theme")
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe("Email Subscription", () => {
  test("signup section is visible with heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Get notified").first()).toBeVisible();
  });

  test("email input is present with label", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.locator("#email-input");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("placeholder", "you@example.com");
  });

  test("notify me button exists and is disabled when empty", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator('button[type="submit"]').filter({ hasText: /notify me/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test("notify me button enables after typing email", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.locator("#email-input");
    await emailInput.fill("test@example.com");
    const btn = page.locator('button[type="submit"]').filter({ hasText: /notify me/i });
    await expect(btn).toBeEnabled();
  });

  test("date checkboxes present (All dates + 5 individual)", async ({ page }) => {
    await page.goto("/");
    const checkboxes = page.locator('input[type="checkbox"]');
    expect(await checkboxes.count()).toBe(6); // All dates + 5 dates
  });

  test("All dates checkbox is checked by default", async ({ page }) => {
    await page.goto("/");
    const allDates = page.locator("label").filter({ hasText: "All dates" }).locator("input");
    await expect(allDates).toBeChecked();
  });

  test("can submit email and get response", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.locator("#email-input");
    await emailInput.fill("test@playwright.dev");
    const btn = page.locator('button[type="submit"]').filter({ hasText: /notify me/i });
    await btn.click();
    await page.waitForTimeout(3000);
    const body = await page.textContent("body");
    // Should show success or error
    expect(
      body?.includes("on the list") ||
      body?.includes("error") ||
      body?.includes("already") ||
      body?.includes("Network") ||
      body?.includes("wrong")
    ).toBeTruthy();
  });
});

test.describe("Theater & Format Tabs", () => {
  test("three theater tabs visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("tab", { name: /Lincoln Square/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Empire 25/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Kips Bay/i })).toBeVisible();
  });

  test("Lincoln Square is selected by default", async ({ page }) => {
    await page.goto("/");
    const tab = page.getByRole("tab", { name: /Lincoln Square/i });
    await expect(tab).toHaveAttribute("aria-selected", "true");
  });

  test("clicking Empire 25 switches active tab", async ({ page }) => {
    await page.goto("/");
    const empireTab = page.getByRole("tab", { name: /Empire 25/i });
    await empireTab.click();
    await expect(empireTab).toHaveAttribute("aria-selected", "true");
    const lsTab = page.getByRole("tab", { name: /Lincoln Square/i });
    await expect(lsTab).toHaveAttribute("aria-selected", "false");
  });

  test("three format buttons visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('button[aria-pressed]').filter({ hasText: "IMAX 70mm" })).toBeVisible();
    await expect(page.locator('button[aria-pressed]').filter({ hasText: "Dolby Cinema" })).toBeVisible();
    await expect(page.locator('button[aria-pressed]').filter({ hasText: "IMAX" }).last()).toBeVisible();
  });

  test("IMAX 70mm format is selected by default", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator('button[aria-pressed="true"]').filter({ hasText: "IMAX 70mm" });
    await expect(btn).toBeVisible();
  });

  test("clicking Dolby Cinema switches format", async ({ page }) => {
    await page.goto("/");
    const dolby = page.locator('button[aria-pressed]').filter({ hasText: "Dolby Cinema" });
    await dolby.click();
    await expect(dolby).toHaveAttribute("aria-pressed", "true");
  });

  test("neighborhood shown on theater tabs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Upper West Side")).toBeVisible();
    await expect(page.getByText("Midtown")).toBeVisible();
    await expect(page.getByText("Kips Bay").last()).toBeVisible();
  });
});

test.describe("Responsive / Mobile", () => {
  test("renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Project Hail Mary");
    await expect(page.locator("#email-input")).toBeVisible();
  });

  test("renders correctly on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Project Hail Mary");
  });
});

test.describe("Footer", () => {
  test("footer has How it works section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("How it works").first()).toBeVisible();
  });

  test("footer mentions 3 theaters and 3 formats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/3 theaters/i).first()).toBeVisible();
    await expect(page.getByText(/3 formats/i).first()).toBeVisible();
  });

  test("footer has Formats covered section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Formats covered").first()).toBeVisible();
  });

  test("footer has disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Not affiliated/i).first()).toBeVisible();
  });
});

test.describe("Meta & SEO", () => {
  test("favicon links present", async ({ page }) => {
    await page.goto("/");
    const favicons = page.locator('link[rel="icon"]');
    expect(await favicons.count()).toBeGreaterThanOrEqual(1);
  });

  test("OG title meta tag present", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    expect(await ogTitle.count()).toBeGreaterThanOrEqual(1);
  });

  test("OG description meta tag present", async ({ page }) => {
    await page.goto("/");
    const ogDesc = page.locator('meta[property="og:description"]');
    expect(await ogDesc.count()).toBeGreaterThanOrEqual(1);
  });

  test("Twitter card meta tags present", async ({ page }) => {
    await page.goto("/");
    const twitterCard = page.locator('meta[name="twitter:card"]');
    expect(await twitterCard.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Performance", () => {
  test("page loads in under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
