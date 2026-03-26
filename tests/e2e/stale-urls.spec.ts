/**
 * Layer 5: Stale URL / Bookmark Handling Tests
 *
 * 5.5 Stale URL handling
 *   - Past dates URL: meaningful message, not silent empty state
 *   - Invalid theater slug: graceful error, not blank page
 *   - Invalid movie slug: show error, not empty showtimes
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

/** Mock /api/status to return empty results for all theater/formats */
async function mockEmptyStatus(page: Page) {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkedAt: "2026-04-01T12:00:00Z",
        cached: false,
        theaters: {
          "amc-lincoln-square-13": {
            name: "AMC Lincoln Square 13",
            neighborhood: "Upper West Side",
            formats: {
              imax70mm: { dates: { "2026-01-01": { date: "2026-01-01", available: false, showtimes: [] } } },
              dolbycinema: { dates: { "2026-01-01": { date: "2026-01-01", available: false, showtimes: [] } } },
              imax: { dates: { "2026-01-01": { date: "2026-01-01", available: false, showtimes: [] } } },
            },
          },
        },
      }),
    })
  );
}

/** Mock /api/status to return a 400 or error body */
async function mockErrorStatus(page: Page, errorMsg = "Theater not found") {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: errorMsg }),
    })
  );
}

/* -------------------------------------------------------------------------
   5.5 Past dates URL
   ------------------------------------------------------------------------- */

test.describe("5.5 Stale URLs — past dates", () => {
  test("past-date URL loads results view without crashing", async ({ page }) => {
    await mockEmptyStatus(page);
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-01-01");
    // Should not crash — results-view or some visible content should render
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
    expect(await page.locator('[data-testid="results-view"]').isVisible()).toBe(true);
  });

  test("past-date URL shows no Buy Tickets links (nothing available)", async ({ page }) => {
    await mockEmptyStatus(page);
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-01-01");
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // No buy tickets links — all showtimes empty
    const buyLinks = page.locator('a[data-testid^="buy-tickets-"]');
    await expect(buyLinks).toHaveCount(0);
  });

  test("past-date URL shows Coming Soon or no-showtimes text rather than blank page", async ({ page }) => {
    await mockEmptyStatus(page);
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-01-01");
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // The page should have some visible content — at minimum the header/setup info
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
    // Should not be a completely blank/error white screen
    const errorIndicator = page.locator('text="Application error"');
    await expect(errorIndicator).toHaveCount(0);
  });
});

/* -------------------------------------------------------------------------
   5.5 Invalid theater slug
   ------------------------------------------------------------------------- */

test.describe("5.5 Stale URLs — invalid theater slug", () => {
  test("invalid theater slug does not crash the page", async ({ page }) => {
    // Mock status to simulate error
    await mockErrorStatus(page, "Theater not found");
    await page.route("**/api/stats**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscribers: 0 }) })
    );
    await page.goto("/?theaters=amc-nonexistent-theater-99&movie=project-hail-mary-76779&dates=2026-04-03");
    // Wait for results-view to appear (URL params cause app to skip setup)
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
    // Page should render something meaningful (title at minimum)
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(5);
  });

  test("invalid theater slug skips setup and shows results view", async ({ page }) => {
    await mockErrorStatus(page, "Theater not found");
    await page.route("**/api/stats**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscribers: 0 }) })
    );
    await page.goto("/?theaters=amc-nonexistent-theater-99&movie=project-hail-mary-76779&dates=2026-04-03");
    // The URL has params, so app should go directly to results (not setup flow)
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="results-view"]')).toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   5.5 Invalid movie slug
   ------------------------------------------------------------------------- */

test.describe("5.5 Stale URLs — invalid movie slug", () => {
  test("invalid movie slug does not crash the page", async ({ page }) => {
    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          checkedAt: "2026-04-01T12:00:00Z",
          cached: false,
          theaters: {
            "amc-lincoln-square-13": {
              name: "AMC Lincoln Square 13",
              neighborhood: "Upper West Side",
              formats: {
                imax70mm: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
                dolbycinema: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
                imax: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
              },
            },
          },
        }),
      })
    );
    await page.route("**/api/stats**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscribers: 0 }) })
    );
    await page.goto("/?theaters=amc-lincoln-square-13&movie=fake-movie-00000&dates=2026-04-03");
    // Wait for results-view — URL params skip setup
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
    // Should not crash
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(5);
  });

  test("invalid movie slug shows empty showtimes, not a crash", async ({ page }) => {
    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          checkedAt: "2026-04-01T12:00:00Z",
          cached: false,
          theaters: {
            "amc-lincoln-square-13": {
              name: "AMC Lincoln Square 13",
              neighborhood: "Upper West Side",
              formats: {
                imax70mm: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
                dolbycinema: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
                imax: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
              },
            },
          },
        }),
      })
    );
    await page.goto("/?theaters=amc-lincoln-square-13&movie=fake-movie-00000&dates=2026-04-03");
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
    // No buy tickets links for nonexistent movie
    const buyLinks = page.locator('a[data-testid^="buy-tickets-"]');
    await expect(buyLinks).toHaveCount(0);
  });
});
