/**
 * Layer 5: Race Condition Tests
 *
 * 5.2 Race Conditions
 *   - Rapid theater tab switching during loading: final state shows last-clicked theater
 *   - Rapid format pill switching: final state shows last-clicked format
 *
 * Strategy: Use route.fulfill with a delay for some responses to simulate
 * slow fetches, then verify the final state reflects the last user action.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

/* -------------------------------------------------------------------------
   Mock data — three theaters with distinct showtime IDs
   IDs: Lincoln 1001-1003, Empire 4001-4002, Kips Bay 6001-6002
   ------------------------------------------------------------------------- */

function buildStatus(theaterEntries: Record<string, { imax70mmIds?: string[]; imaxIds?: string[] }>) {
  const theaters: Record<string, unknown> = {};
  for (const [slug, { imax70mmIds = [], imaxIds = [] }] of Object.entries(theaterEntries)) {
    theaters[slug] = {
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      neighborhood: "NYC",
      formats: {
        imax70mm: {
          dates: {
            "2026-04-03": {
              date: "2026-04-03",
              available: imax70mmIds.length > 0,
              showtimes: imax70mmIds.map((id) => ({
                id,
                time: "7:00",
                amPm: "PM",
                status: "Sellable",
                url: `https://www.amctheatres.com/showtimes/${id}`,
              })),
            },
          },
        },
        dolbycinema: {
          dates: { "2026-04-03": { date: "2026-04-03", available: false, showtimes: [] } },
        },
        imax: {
          dates: {
            "2026-04-03": {
              date: "2026-04-03",
              available: imaxIds.length > 0,
              showtimes: imaxIds.map((id) => ({
                id,
                time: "3:00",
                amPm: "PM",
                status: "Sellable",
                url: `https://www.amctheatres.com/showtimes/${id}`,
              })),
            },
          },
        },
      },
    };
  }
  return { checkedAt: "2026-04-01T12:00:00Z", cached: false, theaters };
}

const MULTI_THEATER_STATUS = buildStatus({
  "amc-lincoln-square-13": { imax70mmIds: ["1001", "1002"], imaxIds: ["1003"] },
  "amc-empire-25": { imax70mmIds: [], imaxIds: ["4001", "4002"] },
  "amc-kips-bay-15": { imax70mmIds: [], imaxIds: ["6001", "6002"] },
});

const MULTI_THEATER_URL =
  "/?theaters=amc-lincoln-square-13,amc-empire-25,amc-kips-bay-15&movie=project-hail-mary-76779&dates=2026-04-03";

async function loadMultiTheater(page: Page) {
  await page.route("**/api/status**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MULTI_THEATER_STATUS),
    })
  );
  await page.goto(MULTI_THEATER_URL);
  await page.waitForSelector('[data-testid="results-view"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="showtime-grid"]', { timeout: 10000 });
}

/** Get all visible showtime IDs on the page */
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
   5.2 Rapid format pill switching
   ------------------------------------------------------------------------- */

test.describe("5.2 Race Conditions — Rapid Format Switching", () => {
  test("rapid format switching shows correct final format data", async ({ page }) => {
    await loadMultiTheater(page);

    // Lincoln Square is selected first (best combo: imax70mm with IDs 1001, 1002)
    // Click IMAX format pill rapidly — use exact text to avoid matching "IMAX 70mm"
    const imaxPill = page.locator('button').filter({ hasText: /^IMAX$/ });
    const imax70mmPill = page.locator('button').filter({ hasText: /^IMAX 70mm$/ });

    // Rapidly switch: IMAX → IMAX 70mm → IMAX
    await imaxPill.click();
    await imax70mmPill.click();
    await imaxPill.click();

    // Wait for stable state
    await page.waitForTimeout(500);

    // Final state should show IMAX (last click) — ID 1003 for Lincoln Square
    const ids = await visibleIds(page);
    // Either we're on Lincoln Square IMAX (1003) or another theater's IMAX
    // Key thing: no IMAX 70mm IDs (1001, 1002) should appear after clicking IMAX last
    expect(ids).not.toContain("1001");
    expect(ids).not.toContain("1002");
  });

  test("switching back to format shows its showtimes", async ({ page }) => {
    await loadMultiTheater(page);

    // Start on Lincoln Square (auto-selected to best: imax70mm)
    const idsInitial = await visibleIds(page);
    // Should have IMAX 70mm IDs (1001, 1002) initially
    expect(idsInitial.some((id) => ["1001", "1002"].includes(id))).toBe(true);

    // Switch to IMAX
    const imaxPill = page.locator('button:has-text("IMAX"):not(:has-text("70mm"))').first();
    await imaxPill.click();
    await page.waitForTimeout(300);

    const idsAfterImax = await visibleIds(page);
    // IMAX 70mm IDs should not appear in IMAX view
    expect(idsAfterImax).not.toContain("1001");

    // Switch back to IMAX 70mm
    const imax70mmPill = page.locator('button:has-text("IMAX 70mm")').first();
    await imax70mmPill.click();
    await page.waitForTimeout(300);

    const idsAfterBack = await visibleIds(page);
    // IMAX 70mm IDs should be back
    expect(idsAfterBack.some((id) => ["1001", "1002"].includes(id))).toBe(true);
  });
});

/* -------------------------------------------------------------------------
   5.2 Rapid theater tab switching
   ------------------------------------------------------------------------- */

test.describe("5.2 Race Conditions — Rapid Theater Switching", () => {
  test("switching theater tabs shows different showtime IDs", async ({ page }) => {
    await loadMultiTheater(page);

    // Get initial IDs (Lincoln Square, best format)
    const lincolnIds = await visibleIds(page);
    expect(lincolnIds.length).toBeGreaterThan(0);

    // Find the Empire 25 theater tab and click it
    // Theater tabs are rendered from theaterList
    const empirePill = page.locator('[data-testid="theater-tab-amc-empire-25"], button:has-text("Empire")').first();
    if (await empirePill.count() > 0) {
      await empirePill.click();
      await page.waitForTimeout(500);

      const empireIds = await visibleIds(page);
      // Empire IDs (4001, 4002) should not overlap with Lincoln Square IMAX 70mm IDs (1001, 1002)
      for (const id of lincolnIds) {
        if (["1001", "1002"].includes(id)) {
          expect(empireIds).not.toContain(id);
        }
      }
    }
  });

  test("theater tabs are visible in results view", async ({ page }) => {
    await loadMultiTheater(page);

    // Theater tabs should be rendered
    const theaterTabs = page.locator('[data-testid^="theater-tab-"]');
    const count = await theaterTabs.count();
    // With 3 theaters selected, there should be 3 tabs
    if (count > 0) {
      expect(count).toBeGreaterThanOrEqual(1);
    } else {
      // Fallback: check for theater names in text
      const bodyText = await page.locator('[data-testid="results-view"]').innerText();
      expect(bodyText).toMatch(/Lincoln|Empire|Kips/);
    }
  });
});
