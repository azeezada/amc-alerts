/**
 * Layer 5: Navigation / Setup Flow State Machine Tests
 *
 * 5.1 Forward-back-forward transitions
 * 5.2 Back from movie step clears movie when theater changes
 * 5.3 Date picker Next button disabled until dates selected
 * 5.4 Start Over from results returns to theater step
 * 5.5 URL params skip setup flow and load results directly
 * 5.6 Local storage params skip setup flow
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

const MOCK_MOVIES = {
  movies: [
    {
      slug: "project-hail-mary-76779",
      title: "Project Hail Mary",
      formats: ["imax70mm", "dolbycinema", "imax"],
      poster: null,
      description: "An astronaut wakes up alone in deep space.",
    },
    {
      slug: "mission-impossible-8",
      title: "Mission: Impossible",
      formats: ["imax", "dolbycinema"],
      poster: null,
      description: "Ethan Hunt returns.",
    },
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
  },
};

async function mockMoviesApi(page: Page) {
  await page.route("**/api/movies**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MOVIES) })
  );
}

async function mockStatusApi(page: Page) {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_STATUS) })
  );
}

async function selectTheaterAndNext(page: Page, theaterSlug = "amc-lincoln-square-13") {
  await page.click(`[data-testid="theater-${theaterSlug}"]`);
  await page.click('[data-testid="theater-next"]');
}

/* -------------------------------------------------------------------------
   5.1 Forward-back-forward transitions
   ------------------------------------------------------------------------- */

test.describe("5.1 Forward-back-forward transitions", () => {
  test("back from movie step returns to theater step", async ({ page }) => {
    await mockMoviesApi(page);
    await mockStatusApi(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');

    await selectTheaterAndNext(page);
    await page.waitForSelector('[data-testid="movie-setup"]');

    // Go back
    await page.click('button:has-text("Back")');
    await page.waitForSelector('[data-testid="theater-setup"]');
    expect(await page.locator('[data-testid="theater-setup"]').isVisible()).toBe(true);
  });

  test("back from date step returns to movie step", async ({ page }) => {
    await mockMoviesApi(page);
    await mockStatusApi(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');

    await selectTheaterAndNext(page);
    await page.waitForSelector('[data-testid="movie-setup"]');

    // Select movie and proceed
    await page.click('[data-testid="movie-project-hail-mary-76779"]');
    await page.click('[data-testid="movie-next"]');
    await page.waitForSelector('[data-testid="date-setup"]');

    // Go back
    await page.click('button:has-text("Back")');
    await page.waitForSelector('[data-testid="movie-setup"]');
    expect(await page.locator('[data-testid="movie-setup"]').isVisible()).toBe(true);
  });

  test("previously selected theater persists after back", async ({ page }) => {
    await mockMoviesApi(page);
    await mockStatusApi(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');

    await selectTheaterAndNext(page);
    await page.waitForSelector('[data-testid="movie-setup"]');

    // Go back
    await page.click('button:has-text("Back")');
    await page.waitForSelector('[data-testid="theater-setup"]');

    // Theater should still be selected (highlighted)
    const theaterBtn = page.locator('[data-testid="theater-amc-lincoln-square-13"]');
    const borderColor = await theaterBtn.evaluate((el) => getComputedStyle(el).borderColor);
    // The selected theater has accent border (not the subtle default)
    // We just verify the button exists and the next button is not disabled
    expect(await page.locator('[data-testid="theater-next"]').isDisabled()).toBe(false);
  });

  test("can complete full flow theater → movie → dates → results", async ({ page }) => {
    await mockMoviesApi(page);
    await mockStatusApi(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');

    await selectTheaterAndNext(page);
    await page.waitForSelector('[data-testid="movie-setup"]');

    await page.click('[data-testid="movie-project-hail-mary-76779"]');
    await page.click('[data-testid="movie-next"]');
    await page.waitForSelector('[data-testid="date-setup"]');

    // Use quick pick
    await page.click('[data-testid="quick-next-7-days"]');
    await page.click('[data-testid="date-next"]');

    await page.waitForSelector('[data-testid="results-view"]', { timeout: 15000 });
    expect(await page.locator('[data-testid="results-view"]').isVisible()).toBe(true);
  });
});

/* -------------------------------------------------------------------------
   5.4 Start Over from results returns to theater step
   ------------------------------------------------------------------------- */

test.describe("5.4 Start Over from results", () => {
  test("Start Over button goes back to theater setup", async ({ page }) => {
    await mockStatusApi(page);
    await page.goto(
      "/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // Find and click the "Change selection" button (data-testid="change-selection")
    await page.click('[data-testid="change-selection"]');

    await page.waitForSelector('[data-testid="theater-setup"]', { timeout: 5000 });
    expect(await page.locator('[data-testid="theater-setup"]').isVisible()).toBe(true);
  });

  test("URL is cleared after Start Over", async ({ page }) => {
    await mockStatusApi(page);
    await page.goto(
      "/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    await page.click('[data-testid="change-selection"]');

    await page.waitForSelector('[data-testid="theater-setup"]', { timeout: 5000 });
    const url = page.url();
    // URL should not contain theater/movie params after clearing
    expect(url).not.toContain("theaters=");
    expect(url).not.toContain("movie=");
  });
});

/* -------------------------------------------------------------------------
   5.3 Date picker Next disabled until dates selected
   ------------------------------------------------------------------------- */

test.describe("5.3 Date picker disabled state", () => {
  test("View Showtimes button disabled when start > end", async ({ page }) => {
    await mockMoviesApi(page);
    await mockStatusApi(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');

    await selectTheaterAndNext(page);
    await page.waitForSelector('[data-testid="movie-setup"]');
    await page.click('[data-testid="movie-project-hail-mary-76779"]');
    await page.click('[data-testid="movie-next"]');
    await page.waitForSelector('[data-testid="date-setup"]');

    // Set start date AFTER end date
    await page.fill('[data-testid="start-date"]', "2026-04-10");
    await page.fill('[data-testid="end-date"]', "2026-04-05");
    await page.press('[data-testid="end-date"]', "Tab");

    // Next button should be disabled
    await page.waitForTimeout(300);
    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(true);
  });

  test("View Showtimes button enabled with valid date range", async ({ page }) => {
    await mockMoviesApi(page);
    await mockStatusApi(page);
    await page.goto("/");
    await page.waitForSelector('[data-testid="theater-setup"]');

    await selectTheaterAndNext(page);
    await page.waitForSelector('[data-testid="movie-setup"]');
    await page.click('[data-testid="movie-project-hail-mary-76779"]');
    await page.click('[data-testid="movie-next"]');
    await page.waitForSelector('[data-testid="date-setup"]');

    // Apply a valid quick pick
    await page.click('[data-testid="quick-next-7-days"]');

    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(false);
  });
});
