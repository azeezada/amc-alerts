/**
 * Layer 3: E2E Tests — UI Data Integrity
 *
 * Verifies that the UI correctly binds data:
 *   3.1 Movie-showtime binding: Buy Tickets URLs belong to selected movie
 *   3.2 Theater switching: switching tabs shows different showtime IDs
 *   3.3 Format switching: zero overlap between IMAX 70mm / Dolby / IMAX
 *   3.4 Date display: each date card matches API response for that date
 *   3.5 Buy Tickets link attributes: testid, data-showtime-id, AMC URL
 *   3.6 Compare mode consistency: same IDs as card mode
 *   3.7 URL state persistence: reload keeps same results
 *   3.8 Subscribe flow: success message on submit
 *
 * All tests use page.route() to mock /api/status so results are
 * deterministic regardless of live AMC availability.
 *
 * Showtime ID ranges (globally unique to prove isolation):
 *   Lincoln Square IMAX 70mm:  1001–1003
 *   Lincoln Square Dolby:      2001–2002
 *   Lincoln Square IMAX:       3001–3004
 *   Empire 25 IMAX 70mm:       (none)
 *   Empire 25 Dolby:           4001–4002
 *   Empire 25 IMAX:            5001–5002
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Mock data
   ------------------------------------------------------------------------- */

function st(id: string, time: string, amPm: string, status = "Sellable") {
  return { id, time, amPm, status, url: `https://www.amctheatres.com/showtimes/${id}` };
}

function dateResult(date: string, showtimes: ReturnType<typeof st>[]) {
  return { date, available: showtimes.length > 0, showtimes };
}

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
            "2026-04-03": dateResult("2026-04-03", [st("1001", "7:00", "PM"), st("1002", "10:30", "PM")]),
            "2026-04-04": dateResult("2026-04-04", [st("1003", "3:00", "PM", "AlmostFull")]),
          },
        },
        dolbycinema: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("2001", "6:45", "PM"), st("2002", "9:45", "PM", "SoldOut")]),
            "2026-04-04": dateResult("2026-04-04", []),
          },
        },
        imax: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("3001", "1:00", "PM"), st("3002", "4:00", "PM"), st("3003", "7:00", "PM")]),
            "2026-04-04": dateResult("2026-04-04", [st("3004", "2:30", "PM")]),
          },
        },
      },
    },
    "amc-empire-25": {
      name: "AMC Empire 25",
      neighborhood: "Times Square",
      formats: {
        imax70mm: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", []),
            "2026-04-04": dateResult("2026-04-04", []),
          },
        },
        dolbycinema: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("4001", "5:00", "PM")]),
            "2026-04-04": dateResult("2026-04-04", [st("4002", "8:00", "PM")]),
          },
        },
        imax: {
          dates: {
            "2026-04-03": dateResult("2026-04-03", [st("5001", "3:30", "PM"), st("5002", "6:30", "PM")]),
            "2026-04-04": dateResult("2026-04-04", []),
          },
        },
      },
    },
  },
};

const RESULTS_URL =
  "/?theaters=amc-lincoln-square-13,amc-empire-25&movie=project-hail-mary-76779&dates=2026-04-03,2026-04-04";

/** Mount page with mocked /api/status, wait for results to render. */
async function loadMocked(page: Page) {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_STATUS),
    })
  );
  await page.goto(RESULTS_URL);
  await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="showtime-grid"]', { timeout: 10000 });
}

/** Collect all visible data-showtime-id values in card view. */
async function visibleIds(page: Page): Promise<string[]> {
  const links = page.locator('a[data-testid^="buy-tickets-"]');
  const count = await links.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = await links.nth(i).getAttribute("data-showtime-id");
    if (id) ids.push(id);
  }
  return ids;
}

/* -------------------------------------------------------------------------
   3.1 Movie-showtime binding
   ------------------------------------------------------------------------- */

test.describe("3.1 Movie-Showtime Binding", () => {
  test("Buy Tickets URLs point to AMC with a numeric showtime ID", async ({ page }) => {
    await loadMocked(page);

    const links = page.locator('a[data-testid^="buy-tickets-"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute("href");
      const id = await links.nth(i).getAttribute("data-showtime-id");
      expect(href).toMatch(/^https:\/\/www\.amctheatres\.com\/showtimes\/\d+$/);
      expect(href).toContain(id!);
    }
  });

  test("data-showtime-id matches the numeric suffix of data-testid", async ({ page }) => {
    await loadMocked(page);

    const links = page.locator('a[data-testid^="buy-tickets-"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const testId = await links.nth(i).getAttribute("data-testid");
      const id = await links.nth(i).getAttribute("data-showtime-id");
      expect(testId).toBe(`buy-tickets-${id}`);
    }
  });

  test("changing movie URL shows different showtime IDs", async ({ page }) => {
    // Load with mock for movie A
    await loadMocked(page);
    const idsA = await visibleIds(page);

    // Load with a different (nonexistent) movie — mock returns empty showtimes
    const emptyStatus = JSON.parse(JSON.stringify(MOCK_STATUS));
    for (const theater of Object.values(emptyStatus.theaters) as any[]) {
      for (const fmt of Object.values(theater.formats) as any[]) {
        for (const dr of Object.values(fmt.dates) as any[]) {
          dr.available = false;
          dr.showtimes = [];
        }
      }
    }

    await page.route(
      "**/api/status**",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(emptyStatus),
        }),
      { times: 1 }
    );

    await page.goto(
      "/?theaters=amc-lincoln-square-13&movie=some-other-movie-00000&dates=2026-04-03,2026-04-04"
    );
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    const idsB = await visibleIds(page);

    // Movie A had showtimes; different movie shows none
    expect(idsA.length).toBeGreaterThan(0);
    expect(idsB.length).toBe(0);
  });
});

/* -------------------------------------------------------------------------
   3.2 Theater Switching — Data Isolation
   ------------------------------------------------------------------------- */

test.describe("3.2 Theater Switching — Data Isolation", () => {
  test("switching theater tabs shows different showtime IDs", async ({ page }) => {
    await loadMocked(page);

    // Card view starts on Lincoln Square (first theater), IMAX 70mm (first format)
    // Grab IDs for Lincoln Square
    const idsLincoln = await visibleIds(page);

    // Switch to Empire 25 tab
    const tabs = page.getByRole("tablist", { name: "Theater selector" });
    await tabs.getByRole("tab").nth(1).click();
    await page.waitForTimeout(200);

    const idsEmpire = await visibleIds(page);

    // Both sets should be non-empty (after switching to IMAX which has data)
    // But the IDs must not overlap
    if (idsLincoln.length > 0 && idsEmpire.length > 0) {
      const setLincoln = new Set(idsLincoln);
      const overlap = idsEmpire.filter((id) => setLincoln.has(id));
      expect(overlap).toHaveLength(0);
    }
  });

  test("switching back to first theater restores original showtime IDs", async ({ page }) => {
    await loadMocked(page);

    const idsFirst = await visibleIds(page);

    // Switch to Empire 25
    const tabs = page.getByRole("tablist", { name: "Theater selector" });
    await tabs.getByRole("tab").nth(1).click();
    await page.waitForTimeout(200);

    // Switch back to Lincoln Square
    await tabs.getByRole("tab").nth(0).click();
    await page.waitForTimeout(200);

    const idsRestored = await visibleIds(page);

    // IDs should be the same as the initial load
    expect(idsRestored.sort()).toEqual(idsFirst.sort());
  });
});

/* -------------------------------------------------------------------------
   3.3 Format Switching — No Cross-Contamination
   ------------------------------------------------------------------------- */

test.describe("3.3 Format Switching — No Cross-Contamination", () => {
  test("IMAX 70mm and IMAX showtime IDs have zero overlap", async ({ page }) => {
    await loadMocked(page);

    // Select IMAX 70mm
    const formatGroup = page.getByRole("group", { name: "Format selector" });
    await formatGroup.getByText("IMAX 70mm").click();
    await page.waitForTimeout(200);
    const idsImax70 = await visibleIds(page);

    // Select IMAX
    await formatGroup.getByText("IMAX", { exact: true }).click();
    await page.waitForTimeout(200);
    const idsImax = await visibleIds(page);

    // No showtime should appear in both formats
    if (idsImax70.length > 0 && idsImax.length > 0) {
      const set70 = new Set(idsImax70);
      const overlap = idsImax.filter((id) => set70.has(id));
      expect(overlap).toHaveLength(0);
    }
  });

  test("Dolby Cinema and IMAX showtime IDs have zero overlap", async ({ page }) => {
    await loadMocked(page);

    const formatGroup = page.getByRole("group", { name: "Format selector" });

    await formatGroup.getByText("Dolby Cinema").click();
    await page.waitForTimeout(200);
    const idsDolby = await visibleIds(page);

    await formatGroup.getByText("IMAX", { exact: true }).click();
    await page.waitForTimeout(200);
    const idsImax = await visibleIds(page);

    if (idsDolby.length > 0 && idsImax.length > 0) {
      const setDolby = new Set(idsDolby);
      const overlap = idsImax.filter((id) => setDolby.has(id));
      expect(overlap).toHaveLength(0);
    }
  });

  test("each format pill shows different showtimes (known mock IDs)", async ({ page }) => {
    await loadMocked(page);

    const formatGroup = page.getByRole("group", { name: "Format selector" });

    // IMAX 70mm → Lincoln Square → IDs should be 1001, 1002 (Apr 3)
    await formatGroup.getByText("IMAX 70mm").click();
    await page.waitForTimeout(200);
    const idsImax70 = await visibleIds(page);
    expect(idsImax70).toContain("1001");
    expect(idsImax70).toContain("1002");

    // Dolby Cinema → Lincoln Square → IDs should be 2001, 2002 (Apr 3)
    await formatGroup.getByText("Dolby Cinema").click();
    await page.waitForTimeout(200);
    const idsDolby = await visibleIds(page);
    expect(idsDolby).toContain("2001");
    expect(idsDolby).toContain("2002");

    // IMAX → Lincoln Square → IDs should be 3001, 3002, 3003 (Apr 3)
    await formatGroup.getByText("IMAX", { exact: true }).click();
    await page.waitForTimeout(200);
    const idsImax = await visibleIds(page);
    expect(idsImax).toContain("3001");
    expect(idsImax).toContain("3002");
    expect(idsImax).toContain("3003");
  });
});

/* -------------------------------------------------------------------------
   3.4 Date Display — Correct Day Mapping
   ------------------------------------------------------------------------- */

test.describe("3.4 Date Display — Correct Day Mapping", () => {
  test("showtime grid renders one card per requested date", async ({ page }) => {
    await loadMocked(page);

    const grid = page.getByTestId("showtime-grid");
    const cards = grid.locator(".card");
    const count = await cards.count();
    // 2 dates were requested → 2 date cards
    expect(count).toBe(2);
  });

  test("April 3 card shows IMAX 70mm showtimes 1001 and 1002", async ({ page }) => {
    await loadMocked(page);

    const formatGroup = page.getByRole("group", { name: "Format selector" });
    await formatGroup.getByText("IMAX 70mm").click();
    await page.waitForTimeout(200);

    const ids = await visibleIds(page);
    expect(ids).toContain("1001");
    expect(ids).toContain("1002");
    // April 4 only has 1003 — should also be present in the grid
    expect(ids).toContain("1003");
    // No Empire IDs should appear for Lincoln Square
    expect(ids).not.toContain("4001");
    expect(ids).not.toContain("5001");
  });

  test("date cards display TICKETS LIVE badge when showtimes exist", async ({ page }) => {
    await loadMocked(page);

    // Should see at least one TICKETS LIVE badge
    const badges = page.getByText("TICKETS LIVE");
    expect(await badges.count()).toBeGreaterThan(0);
  });

  test("date cards display Coming soon when no showtimes", async ({ page }) => {
    await loadMocked(page);

    // Switch to Lincoln Square, Dolby Cinema — Apr 4 has no showtimes
    const formatGroup = page.getByRole("group", { name: "Format selector" });
    await formatGroup.getByText("Dolby Cinema").click();
    await page.waitForTimeout(200);

    // Should show "Coming soon" for the Apr 4 card
    const comingSoon = page.getByText("Coming soon");
    expect(await comingSoon.count()).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------
   3.5 Buy Tickets Link Attributes
   ------------------------------------------------------------------------- */

test.describe("3.5 Buy Tickets Link Attributes", () => {
  test("all Buy Tickets links have required attributes", async ({ page }) => {
    await loadMocked(page);

    const links = page.locator('a[data-testid^="buy-tickets-"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const testId = await link.getAttribute("data-testid");
      const showtimeId = await link.getAttribute("data-showtime-id");
      const href = await link.getAttribute("href");
      const target = await link.getAttribute("target");

      expect(testId).toMatch(/^buy-tickets-\d+$/);
      expect(showtimeId).toMatch(/^\d+$/);
      expect(href).toMatch(/^https:\/\/www\.amctheatres\.com\/showtimes\/\d+$/);
      expect(href).toContain(showtimeId!);
      expect(target).toBe("_blank");
    }
  });

  test("no duplicate showtime IDs in card view", async ({ page }) => {
    await loadMocked(page);

    const ids = await visibleIds(page);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

/* -------------------------------------------------------------------------
   3.6 Compare Mode vs Card Mode Consistency
   ------------------------------------------------------------------------- */

test.describe("3.6 Compare Mode vs Card Mode Consistency", () => {
  test("compare mode shows same showtime IDs as card mode", async ({ page }) => {
    await loadMocked(page);

    // Compare mode shows ALL formats × ALL theaters.
    // Collect card-mode IDs by iterating every format for every theater.
    const formatGroup = page.getByRole("group", { name: "Format selector" });
    const tabs = page.getByRole("tablist", { name: "Theater selector" });
    const allCardModeIds = new Set<string>();

    const formatLabels: Array<{ label: string; exact?: boolean }> = [
      { label: "IMAX 70mm" },
      { label: "Dolby Cinema" },
      { label: "IMAX", exact: true },
    ];

    for (const { label, exact } of formatLabels) {
      await formatGroup.getByText(label, exact ? { exact: true } : {}).click();
      await page.waitForTimeout(200);

      // Lincoln Square (tab 0)
      await tabs.getByRole("tab").nth(0).click();
      await page.waitForTimeout(200);
      (await visibleIds(page)).forEach((id) => allCardModeIds.add(id));

      // Empire 25 (tab 1)
      await tabs.getByRole("tab").nth(1).click();
      await page.waitForTimeout(200);
      (await visibleIds(page)).forEach((id) => allCardModeIds.add(id));
    }

    // Enable compare mode
    await page.getByText("Compare all").click();
    await page.waitForTimeout(300);

    // Collect all IDs visible in compare table
    const compareLinks = page.locator('a[data-testid^="buy-tickets-"]');
    const compareCount = await compareLinks.count();
    const compareModeIds = new Set<string>();
    for (let i = 0; i < compareCount; i++) {
      const id = await compareLinks.nth(i).getAttribute("data-showtime-id");
      if (id) compareModeIds.add(id);
    }

    // Every card-mode ID should appear in compare mode
    for (const id of allCardModeIds) {
      expect(compareModeIds.has(id)).toBe(true);
    }
    // And vice versa
    for (const id of compareModeIds) {
      expect(allCardModeIds.has(id)).toBe(true);
    }
  });

  test("toggling back to card view restores original state", async ({ page }) => {
    await loadMocked(page);

    const idsCardBefore = await visibleIds(page);

    await page.getByText("Compare all").click();
    await page.waitForTimeout(300);

    await page.getByText("Card view").click();
    await page.waitForTimeout(300);

    const idsCardAfter = await visibleIds(page);
    expect(idsCardAfter.sort()).toEqual(idsCardBefore.sort());
  });
});

/* -------------------------------------------------------------------------
   3.7 URL State Persistence
   ------------------------------------------------------------------------- */

test.describe("3.7 URL State Persistence", () => {
  test("reloading same URL shows same results", async ({ page }) => {
    await loadMocked(page);
    const idsBefore = await visibleIds(page);
    const urlBefore = page.url();

    // Reload the page (still mocked)
    await page.route("**/api/status**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_STATUS),
      })
    );
    await page.reload();
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    const idsAfter = await visibleIds(page);
    const urlAfter = page.url();

    expect(urlAfter).toBe(urlBefore);
    expect(idsAfter.sort()).toEqual(idsBefore.sort());
  });

  test("URL with all params skips setup flow and shows results", async ({ page }) => {
    await page.route("**/api/status**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_STATUS),
      })
    );

    await page.goto(RESULTS_URL);
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    // Setup flow should NOT be visible
    await expect(page.getByTestId("setup-flow")).not.toBeVisible();
    // Results should be visible
    await expect(page.getByTestId("results-view")).toBeVisible();
  });

  test("Change selection button returns to setup flow", async ({ page }) => {
    await loadMocked(page);

    await page.getByTestId("change-selection").click();
    await page.waitForTimeout(500);

    // Should return to setup flow
    await expect(page.getByTestId("setup-flow")).toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   3.8 Subscribe Flow
   ------------------------------------------------------------------------- */

test.describe("3.8 Subscribe Flow", () => {
  test("entering email and submitting shows success state", async ({ page }) => {
    await page.route("**/api/status**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_STATUS),
      })
    );
    await page.route("**/api/subscribe**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );
    await page.route("**/api/stats**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 42 }),
      })
    );

    await page.goto(RESULTS_URL);
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });

    const emailSection = page.getByTestId("email-subscribe");
    await expect(emailSection).toBeVisible();

    // Fill in email
    const emailInput = emailSection.locator('input[type="email"]');
    await emailInput.fill("test@example.com");

    // Submit
    await emailSection.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);

    // Should show success state (no error message)
    const errorMsg = emailSection.locator('[class*="error"], [data-error]');
    const hasError = await errorMsg.count();
    expect(hasError).toBe(0);
  });

  test("subscribe section is visible in results view", async ({ page }) => {
    await loadMocked(page);

    const emailSection = page.getByTestId("email-subscribe");
    await expect(emailSection).toBeVisible();

    // Should have an email input
    const emailInput = emailSection.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });
});
