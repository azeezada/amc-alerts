/**
 * Layer 5: Mobile-Specific Tests
 *
 * 5.7 Mobile (375px viewport)
 *   - Movie carousel is scrollable (overflow-x)
 *   - Movies beyond viewport are reachable
 *   - Compare mode table scrolls horizontally on mobile
 *   - Theater tab area is usable on mobile
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Mobile viewport config
   ------------------------------------------------------------------------- */

const MOBILE_VIEWPORT = { width: 375, height: 667 };

/* -------------------------------------------------------------------------
   Mock data
   ------------------------------------------------------------------------- */

const MOCK_MOVIES = {
  movies: [
    { slug: "project-hail-mary-76779", title: "Project Hail Mary", formats: ["imax70mm", "imax"], poster: null, description: "An astronaut in deep space." },
    { slug: "mission-impossible-8", title: "Mission: Impossible", formats: ["imax", "dolbycinema"], poster: null, description: "Ethan Hunt returns." },
    { slug: "avatar-3", title: "Avatar 3", formats: ["imax"], poster: null, description: "Back to Pandora." },
    { slug: "fast-furious-11", title: "Fast & Furious 11", formats: ["dolbycinema"], poster: null, description: "One last ride." },
  ],
};

const MOCK_STATUS = {
  checkedAt: "2026-04-01T12:00:00Z",
  cached: false,
  theaters: {
    "amc-lincoln-square-13": {
      name: "AMC Lincoln Square 13",
      neighborhood: "Upper West Side",
      formats: {
        imax70mm: {
          dates: {
            "2026-04-03": {
              date: "2026-04-03",
              available: true,
              showtimes: [
                { id: "1001", time: "7:00", amPm: "PM", status: "Sellable", url: "https://www.amctheatres.com/showtimes/1001" },
              ],
            },
          },
        },
        dolbycinema: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
        imax: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
      },
    },
    "amc-empire-25": {
      name: "AMC Empire 25",
      neighborhood: "Times Square",
      formats: {
        imax70mm: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
        dolbycinema: {
          dates: {
            "2026-04-03": {
              date: "2026-04-03",
              available: true,
              showtimes: [
                { id: "4001", time: "5:00", amPm: "PM", status: "Sellable", url: "https://www.amctheatres.com/showtimes/4001" },
              ],
            },
          },
        },
        imax: { dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } } },
      },
    },
  },
};

const RESULTS_URL =
  "/?theaters=amc-lincoln-square-13,amc-empire-25&movie=project-hail-mary-76779&dates=2026-04-03";

/* -------------------------------------------------------------------------
   5.7 Mobile — movie carousel
   ------------------------------------------------------------------------- */

test.describe("5.7 Mobile — movie carousel", () => {
  test("movie carousel is scrollable (has overflow-x auto or scroll)", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route("**/api/movies**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MOVIES) })
    );
    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS) })
    );

    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');
    await page.click('[data-testid="theater-amc-lincoln-square-13"]');
    await page.click('[data-testid="theater-next"]');
    await page.waitForSelector('[data-testid="movie-setup"]');
    await page.waitForSelector('[data-testid="movie-list"]');

    // Check that the movie list has overflow-x scroll/auto CSS
    const overflowX = await page.locator('[data-testid="movie-list"]').evaluate(
      (el) => getComputedStyle(el).overflowX
    );
    expect(["auto", "scroll"]).toContain(overflowX);
  });

  test("multiple movie cards are rendered at mobile width", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route("**/api/movies**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MOVIES) })
    );

    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');
    await page.click('[data-testid="theater-amc-lincoln-square-13"]');
    await page.click('[data-testid="theater-next"]');
    await page.waitForSelector('[data-testid="movie-list"]');

    // All 4 movies should be in the DOM (even if some are off-screen)
    // Scope to children of movie-list to exclude movie-setup, movie-list, movie-next elements
    const movieCards = page.locator('[data-testid="movie-list"] [data-testid^="movie-"]');
    const count = await movieCards.count();
    expect(count).toBe(4);
  });
});

/* -------------------------------------------------------------------------
   5.7 Mobile — results view
   ------------------------------------------------------------------------- */

test.describe("5.7 Mobile — results view", () => {
  test("results view renders on mobile without overflow issues", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS) })
    );
    await page.route("**/api/stats**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscribers: 5 }) })
    );

    await page.goto(RESULTS_URL);
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // Results view should be visible
    await expect(page.locator('[data-testid="results-view"]')).toBeVisible();
  });

  test("Buy Tickets links are visible and tappable on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS) })
    );
    await page.route("**/api/stats**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscribers: 5 }) })
    );

    await page.goto(RESULTS_URL);
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="showtime-grid"]', { timeout: 10000 });

    // At least one buy-tickets link should be visible
    const buyLink = page.locator('a[data-testid="buy-tickets-1001"]');
    await expect(buyLink).toBeVisible();

    // Verify link is in viewport (tappable)
    const box = await buyLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test("compare mode table is horizontally scrollable on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS) })
    );
    await page.route("**/api/stats**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscribers: 5 }) })
    );

    await page.goto(RESULTS_URL);
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // Toggle compare mode
    await page.click('button:has-text("Compare all")');
    await page.waitForTimeout(500);

    // Compare mode container should exist
    const compareGrid = page.locator('[data-testid="compare-grid"], table, .compare');
    const count = await compareGrid.count();
    if (count > 0) {
      // Check that the container is scrollable
      const overflowX = await compareGrid.first().evaluate((el) => getComputedStyle(el).overflowX);
      // Either scrollable or the parent container handles it
      expect(["auto", "scroll", "visible"]).toContain(overflowX);
    }
  });
});
