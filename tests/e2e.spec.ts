import { test, expect } from "@playwright/test";

test.describe("Setup Flow", () => {
  test("1. Landing page shows setup flow", async ({ page }) => {
    await page.goto("/");
    // Should show setup flow (not results)
    await expect(page.getByTestId("setup-flow")).toBeVisible();
    await expect(page.getByTestId("theater-setup")).toBeVisible();
    // Should show "Select Theaters" heading
    await expect(page.getByRole("heading", { name: /select theaters/i })).toBeVisible();
  });

  test("2. Curated theater list is immediately visible", async ({ page }) => {
    await page.goto("/");
    // Theater options should be immediately visible (no market selector needed)
    await expect(page.getByTestId("theater-options")).toBeVisible();
    // Should see all three curated NYC theaters
    await expect(page.getByTestId("theater-amc-lincoln-square-13")).toBeVisible();
    await expect(page.getByTestId("theater-amc-empire-25")).toBeVisible();
    await expect(page.getByTestId("theater-amc-kips-bay-15")).toBeVisible();
  });

  test("3. Select a theater — next button becomes enabled", async ({ page }) => {
    await page.goto("/");
    // Next button should be disabled initially
    const nextBtn = page.getByTestId("theater-next");
    await expect(nextBtn).toBeDisabled();

    // Select a theater from the curated list
    await page.getByTestId("theater-amc-lincoln-square-13").click();

    // Next button should be enabled now
    await expect(nextBtn).toBeEnabled();
  });

  test("4. Navigate to movie step — movies load", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("theater-amc-lincoln-square-13").click();
    await page.getByTestId("theater-next").click();

    // Should now be on movie step
    await expect(page.getByTestId("movie-setup")).toBeVisible();
    await expect(page.getByRole("heading", { name: /select a movie/i })).toBeVisible();

    // Wait for movies to load (either movie list or "no movies found")
    await page.waitForTimeout(3000);
    // The movie list or empty state should be visible
    const movieList = page.getByTestId("movie-list");
    const emptyCard = page.locator(".card:has-text('No movies found')");
    const visible = await movieList.isVisible().catch(() => false) || await emptyCard.isVisible().catch(() => false);
    expect(visible).toBeTruthy();
  });

  test("5. Full flow through to results", async ({ page }) => {
    // Navigate with URL params to skip setup (simulates completing setup)
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03");
    await page.waitForLoadState("networkidle");

    // Should show results view directly
    await expect(page.getByTestId("results-view")).toBeVisible({ timeout: 15000 });
    // Should show the showtime grid
    await expect(page.getByTestId("showtime-grid")).toBeVisible();
  });

  test("6. Theater tabs work in results view", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13,amc-empire-25&movie=project-hail-mary-76779&dates=2026-04-03");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("results-view")).toBeVisible({ timeout: 15000 });

    // Should have theater tabs
    const tabs = page.getByRole("tablist", { name: "Theater selector" });
    await expect(tabs).toBeVisible();

    // Should have tab buttons for both theaters
    const tabButtons = tabs.getByRole("tab");
    expect(await tabButtons.count()).toBeGreaterThanOrEqual(2);

    // Click second theater tab
    await tabButtons.nth(1).click();
  });

  test("7. Format pills work in results view", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("results-view")).toBeVisible({ timeout: 15000 });

    // Should have format selector
    const formatGroup = page.getByRole("group", { name: "Format selector" });
    await expect(formatGroup).toBeVisible();

    // Click Dolby Cinema format
    await formatGroup.getByText("Dolby Cinema").click();

    // Should still show results
    await expect(page.getByTestId("showtime-grid")).toBeVisible();
  });

  test("8. URL param loading skips setup", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03,2026-04-04");
    await page.waitForLoadState("networkidle");

    // Should NOT show setup flow
    await expect(page.getByTestId("setup-flow")).not.toBeVisible({ timeout: 5000 });
    // Should show results
    await expect(page.getByTestId("results-view")).toBeVisible({ timeout: 15000 });
  });

  test("9. Mobile responsive layout of setup flow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await expect(page.getByTestId("setup-flow")).toBeVisible();
    await expect(page.getByTestId("theater-setup")).toBeVisible();

    // Theater options should be immediately visible (no market step needed)
    await expect(page.getByTestId("theater-options")).toBeVisible();
    await expect(page.getByTestId("theater-amc-lincoln-square-13")).toBeVisible();
  });
});

test.describe("API Endpoints", () => {
  test("10a. GET /api/theaters returns markets", async ({ request }) => {
    const resp = await request.get("/api/theaters");
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.markets).toBeDefined();
    expect(data.markets.length).toBeGreaterThan(0);
    // Each market should have slug, name, state, theaterCount
    const nyc = data.markets.find((m: { slug: string }) => m.slug === "new-york-city");
    expect(nyc).toBeDefined();
    expect(nyc.theaterCount).toBeGreaterThan(0);
  });

  test("10b. GET /api/theaters?market=new-york-city returns theaters", async ({ request }) => {
    const resp = await request.get("/api/theaters?market=new-york-city");
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.theaters).toBeDefined();
    expect(data.theaters.length).toBeGreaterThan(0);
    expect(data.theaters[0].slug).toBeDefined();
    expect(data.theaters[0].name).toBeDefined();
  });

  test("10c. GET /api/theaters?q=lincoln returns matching theaters", async ({ request }) => {
    const resp = await request.get("/api/theaters?q=lincoln");
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.theaters).toBeDefined();
    expect(data.theaters.some((t: { slug: string }) => t.slug.includes("lincoln"))).toBeTruthy();
  });

  test("10d. GET /api/movies requires theater param", async ({ request }) => {
    const resp = await request.get("/api/movies");
    expect(resp.status()).toBe(400);
    const data = await resp.json();
    expect(data.error).toBeDefined();
  });

  test("10e. GET /api/movies?theater=amc-lincoln-square-13 returns movies or error", async ({ request }) => {
    const resp = await request.get("/api/movies?theater=amc-lincoln-square-13&date=2026-04-03");
    // Could be 200 (with movies) or 502 (if AMC is unreachable)
    const data = await resp.json();
    if (resp.ok()) {
      expect(data.movies).toBeDefined();
      expect(Array.isArray(data.movies)).toBeTruthy();
    } else {
      // API should still return a structured error
      expect(data.error || data.movies).toBeDefined();
    }
  });

  test("10f. GET /api/status with params returns structured response", async ({ request }) => {
    const resp = await request.get(
      "/api/status?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    // Could be 200 or 500 depending on AMC availability, but should be structured
    const data = await resp.json();
    if (resp.ok()) {
      expect(data.theaters).toBeDefined();
      expect(data.checkedAt).toBeDefined();
    } else {
      expect(data.error).toBeDefined();
    }
  });
});
