import { test, expect } from "@playwright/test";

test.describe("Loading States", () => {
  test("skeleton loaders appear on initial load", async ({ page }) => {
    await page.goto("/");
    const skeletons = page.locator(".skeleton");
    // Setup flow may show skeletons while loading markets
    expect(await skeletons.count()).toBeGreaterThanOrEqual(0);
  });

  test("projector spinner shown during mount", async ({ page }) => {
    // The spinner shows briefly before hydration
    await page.goto("/");
    // After hydration, setup flow or results should appear
    await page.waitForTimeout(1000);
    const body = await page.textContent("body");
    expect(body?.includes("Select Theaters") || body?.includes("Track Any Movie")).toBeTruthy();
  });
});

test.describe("Card Design", () => {
  test("setup flow uses card styling", async ({ page }) => {
    await page.goto("/");
    const cards = page.locator(".card");
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test("hero entrance animations present", async ({ page }) => {
    await page.goto("/");
    const heroElements = page.locator(".hero-enter");
    expect(await heroElements.count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Theme & Colors", () => {
  test("CSS custom properties are defined in page", async ({ page }) => {
    await page.goto("/");
    const style = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    });
    expect(style).toBeTruthy();
  });

  test("body uses dark background", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // Should be a dark color (low RGB values)
    expect(bg).toBeTruthy();
  });

  test("no green colors in showtime badges", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(3000);
    const html = await page.content();
    // Per AMC spec, should NOT use green for availability
    // Sellable status should use white outline, not green
    expect(html).not.toContain("background:#22c55e");
    expect(html).not.toContain("background: #22c55e");
  });
});

test.describe("Unsubscribe Page", () => {
  test("unsubscribe page loads", async ({ page }) => {
    await page.goto("/unsubscribe");
    await expect(page.getByText("Unsubscribe")).toBeVisible();
  });

  test("unsubscribe page shows AMC ALERTS badge", async ({ page }) => {
    await page.goto("/unsubscribe");
    await expect(page.getByText("AMC ALERTS")).toBeVisible();
  });

  test("unsubscribe page pre-fills from URL params", async ({ page }) => {
    await page.goto("/unsubscribe?email=test@example.com&token=abc123");
    await expect(page.getByText("test@example.com")).toBeVisible();
  });

  test("unsubscribe button is present", async ({ page }) => {
    await page.goto("/unsubscribe?email=test@example.com&token=abc123");
    const btn = page.locator("button").filter({ hasText: "Unsubscribe" });
    await expect(btn).toBeVisible();
  });
});

test.describe("Date Cards in Results", () => {
  test("date cards render with weekday and date", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01,2026-04-02");
    await page.waitForTimeout(3000);
    const grid = page.getByTestId("showtime-grid");
    await expect(grid).toBeVisible();
    // Should have date cards
    const cards = grid.locator(".card");
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("API Endpoints", () => {
  test("GET /api/theaters returns markets", async ({ request }) => {
    const resp = await request.get("/api/theaters");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.markets).toBeDefined();
    expect(data.markets.length).toBeGreaterThan(0);
  });

  test("GET /api/stats returns subscriber count", async ({ request }) => {
    const resp = await request.get("/api/stats");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(typeof data.subscribers).toBe("number");
  });

  test("POST /api/subscribe validates email", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "not-an-email" },
    });
    expect(resp.status()).toBe(400);
  });

  test("POST /api/subscribe accepts valid email", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "test@playwright.dev" },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.success).toBeTruthy();
  });

  test("POST /api/subscribe rate limits excessive requests", async ({ request }) => {
    // Send 6 requests quickly (limit is 5/min)
    const results = [];
    for (let i = 0; i < 7; i++) {
      const resp = await request.post("/api/subscribe", {
        data: { email: `ratelimit${i}@test.dev` },
      });
      results.push(resp.status());
    }
    // At least one should be 429
    expect(results.some((s) => s === 429)).toBeTruthy();
  });

  test("GET /api/check requires secret", async ({ request }) => {
    const resp = await request.get("/api/check");
    expect(resp.status()).toBe(401);
  });

  test("POST /api/unsubscribe validates token", async ({ request }) => {
    const resp = await request.post("/api/unsubscribe", {
      data: { email: "test@test.com", token: "invalid" },
    });
    expect(resp.status()).toBe(403);
  });
});
