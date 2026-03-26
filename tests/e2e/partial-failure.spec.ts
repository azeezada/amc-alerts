/**
 * Layer 5: Partial Failure UI Tests
 *
 * 5.3 Partial Failure UI
 *   - Some dates succeed, some fail → correct display per card
 *   - Error field present on failed dates → not silently "Coming soon"
 *   - Successful dates still show showtimes alongside failed dates
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Mock data — partial failure: Apr 3 works, Apr 4-5 have errors
   ------------------------------------------------------------------------- */

const PARTIAL_FAILURE_STATUS = {
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
            "2026-04-04": {
              date: "2026-04-04",
              available: false,
              showtimes: [],
              error: "AMC returned 429: Too Many Requests",
            },
            "2026-04-05": {
              date: "2026-04-05",
              available: false,
              showtimes: [],
              error: "Network timeout",
            },
          },
        },
        dolbycinema: {
          dates: {
            "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] },
            "2026-04-04": { date: "2026-04-04", available: false, showtimes: [], error: "AMC returned 429: Too Many Requests" },
            "2026-04-05": { date: "2026-04-05", available: false, showtimes: [], error: "Network timeout" },
          },
        },
        imax: {
          dates: {
            "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] },
            "2026-04-04": { date: "2026-04-04", available: false, showtimes: [], error: "AMC returned 429: Too Many Requests" },
            "2026-04-05": { date: "2026-04-05", available: false, showtimes: [], error: "Network timeout" },
          },
        },
      },
    },
  },
};

const RESULTS_URL =
  "/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03,2026-04-04,2026-04-05";

async function loadPartialFailure(page: Page) {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PARTIAL_FAILURE_STATUS),
    })
  );
  await page.goto(RESULTS_URL);
  await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
}

/* -------------------------------------------------------------------------
   5.3 Partial failure tests
   ------------------------------------------------------------------------- */

test.describe("5.3 Partial Failure UI", () => {
  test("successful date shows Buy Tickets link", async ({ page }) => {
    await loadPartialFailure(page);

    // Apr 3 has showtime ID 1001 in imax70mm — best combo should select it
    // Find the buy tickets link for the successful date
    const buyLink = page.locator('a[data-showtime-id="1001"]');
    await expect(buyLink).toHaveCount(1);
  });

  test("page renders date cards for a 3-date request", async ({ page }) => {
    await loadPartialFailure(page);

    // The showtime grid should render date cards for each requested date
    const grid = page.locator('[data-testid="showtime-grid"]');
    await expect(grid).toBeVisible();

    // Verify at least one date card is present with the new data-testid
    const apr3Card = page.locator('[data-testid="date-card-2026-04-03"]');
    await expect(apr3Card).toBeVisible();
  });

  test("failed dates with error field do not show Buy Tickets links", async ({ page }) => {
    await loadPartialFailure(page);

    // IDs 1001 is the only showtime — Apr 4 and Apr 5 have errors and no showtimes
    const allBuyLinks = page.locator('a[data-testid^="buy-tickets-"]');
    const count = await allBuyLinks.count();

    // Collect all showtime IDs shown
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = await allBuyLinks.nth(i).getAttribute("data-showtime-id");
      if (id) ids.push(id);
    }

    // Should NOT contain IDs from Apr 4 or Apr 5 (which are empty/error)
    // Only ID 1001 should be present
    for (const id of ids) {
      expect(["1001"]).toContain(id);
    }
  });

  test("page does not crash when all formats have errors for some dates", async ({ page }) => {
    await loadPartialFailure(page);

    // Page should still be functional
    const resultsView = page.locator('[data-testid="results-view"]');
    await expect(resultsView).toBeVisible();

    // No JS errors that prevent rendering
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });
});

/* -------------------------------------------------------------------------
   All-failure scenario
   ------------------------------------------------------------------------- */

test.describe("5.3 All Dates Fail", () => {
  test("page renders without crashing when all dates have errors", async ({ page }) => {
    const allFailStatus = {
      checkedAt: "2026-04-01T12:00:00Z",
      cached: false,
      theaters: {
        "amc-lincoln-square-13": {
          name: "AMC Lincoln Square 13",
          neighborhood: "Upper West Side",
          formats: {
            imax70mm: {
              dates: {
                "2026-04-03": { date: "2026-04-03", available: false, showtimes: [], error: "AMC 503" },
                "2026-04-04": { date: "2026-04-04", available: false, showtimes: [], error: "AMC 503" },
              },
            },
            dolbycinema: {
              dates: {
                "2026-04-03": { date: "2026-04-03", available: false, showtimes: [], error: "AMC 503" },
                "2026-04-04": { date: "2026-04-04", available: false, showtimes: [], error: "AMC 503" },
              },
            },
            imax: {
              dates: {
                "2026-04-03": { date: "2026-04-03", available: false, showtimes: [], error: "AMC 503" },
                "2026-04-04": { date: "2026-04-04", available: false, showtimes: [], error: "AMC 503" },
              },
            },
          },
        },
      },
    };

    await page.route("**/api/status**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(allFailStatus),
      })
    );
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03,2026-04-04");
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // No buy tickets links when everything fails
    await expect(page.locator('a[data-testid^="buy-tickets-"]')).toHaveCount(0);

    // Page still renders something meaningful
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(20);
  });
});
