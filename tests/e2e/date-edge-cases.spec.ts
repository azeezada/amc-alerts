/**
 * Layer 5: Date Edge Cases
 *
 * 5.6 Date Edge Cases
 *   - Start date after end date: no dates selected, View Showtimes disabled
 *   - Wide date range (30 days): no crash, handles it
 *   - Quick pick buttons produce correct date ranges
 *   - Single-day range (start == end): 1 date selected
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Helper: navigate to date-setup step
   ------------------------------------------------------------------------- */

const MOCK_MOVIES = {
  movies: [
    { slug: "project-hail-mary-76779", title: "Project Hail Mary", formats: ["imax70mm"], poster: null, description: "" },
  ],
};

async function goToDateSetup(page: Page) {
  await page.route("**/api/movies**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MOVIES) })
  );
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ checkedAt: "2026-04-01T12:00:00Z", cached: false, theaters: {} }),
    })
  );

  await page.goto("/");
  await page.waitForSelector('[data-testid="theater-setup"]');
  await page.click('[data-testid="theater-amc-lincoln-square-13"]');
  await page.click('[data-testid="theater-next"]');
  await page.waitForSelector('[data-testid="movie-setup"]');
  await page.click('[data-testid="movie-project-hail-mary-76779"]');
  await page.click('[data-testid="movie-next"]');
  await page.waitForSelector('[data-testid="date-setup"]');
}

/* -------------------------------------------------------------------------
   5.6 Date edge cases
   ------------------------------------------------------------------------- */

test.describe("5.6 Date Edge Cases — invalid range", () => {
  test("start > end disables View Showtimes button", async ({ page }) => {
    await goToDateSetup(page);

    await page.fill('[data-testid="start-date"]', "2026-05-10");
    await page.fill('[data-testid="end-date"]', "2026-05-01");
    await page.press('[data-testid="end-date"]', "Tab");
    await page.waitForTimeout(400);

    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(true);
  });

  test("start == end selects exactly 1 date", async ({ page }) => {
    await goToDateSetup(page);

    await page.fill('[data-testid="start-date"]', "2026-05-01");
    await page.fill('[data-testid="end-date"]', "2026-05-01");
    await page.press('[data-testid="end-date"]', "Tab");
    await page.waitForTimeout(400);

    // 1 day selected
    const msg = await page.locator('[data-testid="date-setup"]').innerText();
    expect(msg).toContain("1 day");
    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(false);
  });

  test("30-day range does not crash the page", async ({ page }) => {
    await goToDateSetup(page);

    await page.fill('[data-testid="start-date"]', "2026-05-01");
    await page.fill('[data-testid="end-date"]', "2026-05-30");
    await page.press('[data-testid="end-date"]', "Tab");
    await page.waitForTimeout(400);

    // Button should be enabled and we can proceed
    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(false);

    const msg = await page.locator('[data-testid="date-setup"]').innerText();
    expect(msg).toContain("30 days");
  });
});

test.describe("5.6 Date Edge Cases — quick picks", () => {
  test("Next 7 days quick pick enables View Showtimes", async ({ page }) => {
    await goToDateSetup(page);
    await page.click('[data-testid="quick-next-7-days"]');
    await page.waitForTimeout(200);

    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(false);
    const msg = await page.locator('[data-testid="date-setup"]').innerText();
    expect(msg).toContain("7 days");
  });

  test("Next 2 weeks quick pick enables View Showtimes", async ({ page }) => {
    await goToDateSetup(page);
    await page.click('[data-testid="quick-next-2-weeks"]');
    await page.waitForTimeout(200);

    expect(await page.locator('[data-testid="date-next"]').isDisabled()).toBe(false);
    const msg = await page.locator('[data-testid="date-setup"]').innerText();
    expect(msg).toContain("14 days");
  });

  test("quick pick updates the start and end date inputs", async ({ page }) => {
    await goToDateSetup(page);
    await page.click('[data-testid="quick-next-7-days"]');
    await page.waitForTimeout(200);

    const startVal = await page.locator('[data-testid="start-date"]').inputValue();
    const endVal = await page.locator('[data-testid="end-date"]').inputValue();

    // Both should be valid date strings
    expect(startVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // End should be after start
    expect(endVal >= startVal).toBe(true);
  });
});
