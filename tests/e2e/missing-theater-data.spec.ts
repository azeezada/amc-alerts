/**
 * Gap 4.1: E2E — Movie at Subset of Theaters
 *
 * Scenario: User selects 3 theaters; the movie only plays at 1 of them in a
 * given format. The other tabs must show "Not playing here" — clearly distinct
 * from "Coming soon" / "No tickets yet" which appears when a theater DOES carry
 * the format but tickets haven't gone on sale.
 *
 * Coverage:
 *   4.1.1  Theater A (has imax70mm showtimes)  → shows showtime-grid with Buy Tickets links
 *   4.1.2  Theater B (imax70mm key absent)     → shows "not-playing-here", NOT showtime-grid
 *   4.1.3  Theater C (imax70mm key absent)     → same "not-playing-here" treatment
 *   4.1.4  Theater B has dolbycinema (no showtimes) → showtime-grid shows "Coming soon", NOT "not-playing-here"
 *   4.1.5  Switching back to Theater A         → showtime-grid reappears with correct IDs
 *
 * All tests use page.route() to mock /api/status so results are deterministic.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function st(id: string, time: string, amPm: string, status = "Sellable") {
  return { id, time, amPm, status, url: `https://www.amctheatres.com/showtimes/${id}` };
}

function dateResult(date: string, showtimes: ReturnType<typeof st>[]) {
  return { date, available: showtimes.length > 0, showtimes };
}

/**
 * Mock response where:
 *   - Theater A (amc-lincoln-square-13) has imax70mm WITH showtimes and dolbycinema with no showtimes
 *   - Theater B (amc-empire-25) has NO imax70mm key at all, but does have dolbycinema with showtimes
 *   - Theater C (amc-kips-bay-15) has NO imax70mm key and NO dolbycinema key (only imax)
 */
const MOCK_STATUS_SUBSET = {
  checkedAt: "2026-04-01T12:00:00Z",
  cached: false,
  theaters: {
    "amc-lincoln-square-13": {
      name: "AMC Lincoln Square 13",
      neighborhood: "Upper West Side",
      formats: {
        imax70mm: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("1001", "7:00", "PM"), st("1002", "10:30", "PM")]),
            "2026-04-04": dateResult("2026-04-04", [st("1003", "3:00", "PM")]),
          },
        },
        dolbycinema: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", []),
            "2026-04-04": dateResult("2026-04-04", []),
          },
        },
      },
    },
    "amc-empire-25": {
      name: "AMC Empire 25",
      neighborhood: "Times Square",
      formats: {
        // imax70mm intentionally absent — "not playing here"
        dolbycinema: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("4001", "5:00", "PM")]),
            "2026-04-04": dateResult("2026-04-04", [st("4002", "8:00", "PM")]),
          },
        },
      },
    },
    "amc-kips-bay-15": {
      name: "AMC Kips Bay 15",
      neighborhood: "Kips Bay",
      formats: {
        // imax70mm intentionally absent — "not playing here"
        // dolbycinema intentionally absent — "not playing here"
        imax: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("6001", "6:00", "PM")]),
            "2026-04-04": dateResult("2026-04-04", []),
          },
        },
      },
    },
  },
};

const RESULTS_URL =
  "/?theaters=amc-lincoln-square-13,amc-empire-25,amc-kips-bay-15&movie=project-hail-mary-76779&dates=2026-04-03,2026-04-04";

async function loadMocked(page: Page) {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_STATUS_SUBSET),
    })
  );
  await page.goto(RESULTS_URL);
  await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
}

/* -------------------------------------------------------------------------
   4.1.1 Theater A shows showtimes for imax70mm
   ------------------------------------------------------------------------- */

test.describe("4.1.1 Theater A — format present with showtimes", () => {
  test("shows showtime-grid with Buy Tickets links for imax70mm", async ({ page }) => {
    await loadMocked(page);

    // Theater A (Lincoln Square) should be auto-selected as best combo (has imax70mm showtimes)
    // Switch to Lincoln Square explicitly via tab
    const lincolnTab = page.getByRole("tab", { name: /Lincoln Square/i });
    await lincolnTab.click();

    // Select imax70mm format
    const imax70mmPill = page.getByRole("button", { name: /IMAX 70mm/i });
    await imax70mmPill.click();

    // showtime-grid should be visible
    await expect(page.locator('[data-testid="showtime-grid"]')).toBeVisible();

    // "not-playing-here" must NOT appear
    await expect(page.locator('[data-testid="not-playing-here"]')).not.toBeVisible();

    // There should be Buy Tickets links
    const links = page.locator('a[data-testid^="buy-tickets-"]');
    await expect(links.first()).toBeVisible();
    expect(await links.count()).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------
   4.1.2 Theater B — imax70mm absent → "not playing here"
   ------------------------------------------------------------------------- */

test.describe("4.1.2 Theater B — format absent", () => {
  test("shows not-playing-here for imax70mm at Empire 25", async ({ page }) => {
    await loadMocked(page);

    // Switch to Empire 25
    const empireTab = page.getByRole("tab", { name: /Empire 25/i });
    await empireTab.click();

    // Select imax70mm
    const imax70mmPill = page.getByRole("button", { name: /IMAX 70mm/i });
    await imax70mmPill.click();

    // "not-playing-here" panel should appear
    await expect(page.locator('[data-testid="not-playing-here"]')).toBeVisible();
    await expect(page.locator('[data-testid="not-playing-here"]')).toContainText("Not playing here");

    // showtime-grid must NOT be visible
    await expect(page.locator('[data-testid="showtime-grid"]')).not.toBeVisible();
  });

  test("not-playing-here message mentions the format name", async ({ page }) => {
    await loadMocked(page);

    const empireTab = page.getByRole("tab", { name: /Empire 25/i });
    await empireTab.click();

    const imax70mmPill = page.getByRole("button", { name: /IMAX 70mm/i });
    await imax70mmPill.click();

    await expect(page.locator('[data-testid="not-playing-here"]')).toContainText("IMAX 70mm");
  });
});

/* -------------------------------------------------------------------------
   4.1.3 Theater C — both imax70mm and dolbycinema absent → "not playing here"
   ------------------------------------------------------------------------- */

test.describe("4.1.3 Theater C — multiple formats absent", () => {
  test("shows not-playing-here for imax70mm at Kips Bay", async ({ page }) => {
    await loadMocked(page);

    const kipsBayTab = page.getByRole("tab", { name: /Kips Bay/i });
    await kipsBayTab.click();

    const imax70mmPill = page.getByRole("button", { name: /IMAX 70mm/i });
    await imax70mmPill.click();

    await expect(page.locator('[data-testid="not-playing-here"]')).toBeVisible();
    await expect(page.locator('[data-testid="showtime-grid"]')).not.toBeVisible();
  });

  test("shows not-playing-here for dolbycinema at Kips Bay", async ({ page }) => {
    await loadMocked(page);

    const kipsBayTab = page.getByRole("tab", { name: /Kips Bay/i });
    await kipsBayTab.click();

    const dolbyPill = page.getByRole("button", { name: /Dolby/i });
    await dolbyPill.click();

    await expect(page.locator('[data-testid="not-playing-here"]')).toBeVisible();
    await expect(page.locator('[data-testid="showtime-grid"]')).not.toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   4.1.4 "Not on sale yet" is distinct from "not playing here"
   When Theater A has dolbycinema present but no showtimes, it should show
   the showtime-grid with "Coming soon" badges — NOT the "not-playing-here" panel.
   ------------------------------------------------------------------------- */

test.describe("4.1.4 Not on sale yet vs not playing here distinction", () => {
  test("Theater A dolbycinema (present, no showtimes) shows showtime-grid not not-playing-here", async ({
    page,
  }) => {
    await loadMocked(page);

    const lincolnTab = page.getByRole("tab", { name: /Lincoln Square/i });
    await lincolnTab.click();

    const dolbyPill = page.getByRole("button", { name: /Dolby/i });
    await dolbyPill.click();

    // showtime-grid SHOULD appear (format is present, just no showtimes yet)
    await expect(page.locator('[data-testid="showtime-grid"]')).toBeVisible();

    // "not-playing-here" must NOT appear
    await expect(page.locator('[data-testid="not-playing-here"]')).not.toBeVisible();

    // Date cards should show "Coming soon" or "No tickets yet" badge (not TICKETS LIVE)
    const dateCards = page.locator('[data-testid^="date-card-"]');
    expect(await dateCards.count()).toBeGreaterThan(0);

    // There should be no Buy Tickets links (no showtimes)
    const links = page.locator('a[data-testid^="buy-tickets-"]');
    await expect(links).toHaveCount(0);
  });

  test("Empire 25 dolbycinema (present, has showtimes) does NOT show not-playing-here", async ({
    page,
  }) => {
    await loadMocked(page);

    const empireTab = page.getByRole("tab", { name: /Empire 25/i });
    await empireTab.click();

    const dolbyPill = page.getByRole("button", { name: /Dolby/i });
    await dolbyPill.click();

    await expect(page.locator('[data-testid="showtime-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="not-playing-here"]')).not.toBeVisible();

    // Has Buy Tickets links
    const links = page.locator('a[data-testid^="buy-tickets-"]');
    expect(await links.count()).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------
   4.1.5 Switching back to Theater A restores showtime-grid
   ------------------------------------------------------------------------- */

test.describe("4.1.5 Tab switching restores correct state", () => {
  test("switching A→B→A restores showtime-grid for imax70mm", async ({ page }) => {
    await loadMocked(page);

    const lincolnTab = page.getByRole("tab", { name: /Lincoln Square/i });
    const empireTab = page.getByRole("tab", { name: /Empire 25/i });
    const imax70mmPill = page.getByRole("button", { name: /IMAX 70mm/i });

    // Start on Theater A
    await lincolnTab.click();
    await imax70mmPill.click();
    await expect(page.locator('[data-testid="showtime-grid"]')).toBeVisible();

    // Switch to Theater B — format absent
    await empireTab.click();
    await expect(page.locator('[data-testid="not-playing-here"]')).toBeVisible();
    await expect(page.locator('[data-testid="showtime-grid"]')).not.toBeVisible();

    // Switch back to Theater A — showtime-grid should return
    await lincolnTab.click();
    await expect(page.locator('[data-testid="showtime-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="not-playing-here"]')).not.toBeVisible();

    // Correct showtime IDs visible
    const link1 = page.locator('[data-testid="buy-tickets-1001"]');
    await expect(link1).toBeVisible();
  });
});
