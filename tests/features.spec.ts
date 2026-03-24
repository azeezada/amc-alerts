import { test, expect } from "@playwright/test";

test.describe("Countdown Timer", () => {
  test("shows countdown skeleton then hydrates with numbers", async ({ page }) => {
    await page.goto("/");
    // After hydration, should show actual numbers
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    // Should have Days/Hrs/Min/Sec labels
    expect(body).toContain("Days");
    expect(body).toContain("Hrs");
    expect(body).toContain("Min");
    expect(body).toContain("Sec");
  });
});

test.describe("Loading States", () => {
  test("skeleton loaders appear for showtime cards", async ({ page }) => {
    await page.goto("/");
    // Skeleton divs should be present before API loads
    const skeletons = page.locator(".skeleton");
    expect(await skeletons.count()).toBeGreaterThan(0);
  });

  test("projector spinner shown while checking", async ({ page }) => {
    await page.goto("/");
    const spinner = page.locator(".projector-spinner");
    // Should exist in initial render
    expect(await spinner.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Film Strip Design Elements", () => {
  test("film strip borders are present", async ({ page }) => {
    await page.goto("/");
    const filmStrips = page.locator(".film-strip-border");
    expect(await filmStrips.count()).toBeGreaterThanOrEqual(1);
  });

  test("hero has film-grain class", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("header.film-grain");
    await expect(hero).toBeVisible();
  });

  test("hero has light-leak class", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator("header.light-leak");
    await expect(hero).toBeVisible();
  });
});

test.describe("Card Design", () => {
  test("date cards use .card class", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".card");
    expect(await cards.count()).toBeGreaterThanOrEqual(5); // 5 dates + signup
  });

  test("cards have staggered entrance animation", async ({ page }) => {
    await page.goto("/");
    const animatedCards = page.locator(".card-enter");
    expect(await animatedCards.count()).toBeGreaterThanOrEqual(5);
  });

  test("cards have dashed ticket-style divider", async ({ page }) => {
    await page.goto("/");
    // The dashed border creates the "tear here" ticket feel
    const dashed = page.locator('[style*="border-top:1px dashed"]');
    expect(await dashed.count()).toBeGreaterThanOrEqual(5);
  });
});

test.describe("Hero Section", () => {
  test("movie poster placeholder with rocket emoji", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("🚀").first()).toBeVisible();
  });

  test("hero uses OKLCH color system", async ({ page }) => {
    await page.goto("/");
    // Check that CSS custom properties are using oklch
    const html = await page.content();
    expect(html).toContain("oklch");
  });

  test("hero entrance animations present", async ({ page }) => {
    await page.goto("/");
    const heroElements = page.locator(".hero-enter");
    expect(await heroElements.count()).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Theme & Colors", () => {
  test("CSS custom properties are defined", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).toContain("--accent");
    expect(html).toContain("--bg-base");
    expect(html).toContain("--text-primary");
  });

  test("page uses custom font classes", async ({ page }) => {
    await page.goto("/");
    const htmlEl = page.locator("html");
    const classes = await htmlEl.getAttribute("class");
    // Should have font variable classes from next/font
    expect(classes).toBeTruthy();
    expect(classes!.length).toBeGreaterThan(0);
  });
});

test.describe("Accessibility", () => {
  test("page has exactly one h1", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("h1").count()).toBe(1);
  });

  test("theater selector has proper ARIA role=tablist", async ({ page }) => {
    await page.goto("/");
    const tablist = page.locator('[role="tablist"][aria-label="Theater selector"]');
    await expect(tablist).toBeVisible();
  });

  test("format selector has proper ARIA role=group", async ({ page }) => {
    await page.goto("/");
    const group = page.locator('[role="group"][aria-label="Format selector"]');
    await expect(group).toBeVisible();
  });

  test("email input has label", async ({ page }) => {
    await page.goto("/");
    const label = page.locator('label[for="email-input"]');
    await expect(label).toBeVisible();
  });

  test("form uses fieldset + legend for date checkboxes", async ({ page }) => {
    await page.goto("/");
    const fieldset = page.locator("fieldset");
    await expect(fieldset).toBeVisible();
    const legend = page.locator("legend");
    await expect(legend).toContainText("Notify me for");
  });
});
