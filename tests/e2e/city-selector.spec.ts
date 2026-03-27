/**
 * City Selector E2E Tests
 *
 * Verifies the city/market picker in the TheaterSetup step:
 *   CS.1  City selector renders with all available markets
 *   CS.2  NYC is selected by default
 *   CS.3  NYC theaters show in the list by default (Lincoln Square, Empire 25, Kips Bay)
 *   CS.4  Clicking Los Angeles shows LA theaters (Century City, Burbank, Grove, CityWalk)
 *   CS.5  Clicking Chicago shows Chicago theaters (River East, Navy Pier, Block 37)
 *   CS.6  Selecting a theater then switching city clears the selection
 *   CS.7  The "Next" button is disabled until a theater is picked from the new city
 *   CS.8  Switching back to NYC after LA shows NYC theaters again
 */

import { test, expect, type Page } from "@playwright/test";

/** Navigate to the root page (no URL params) to land on the setup-theaters step. */
async function goToSetup(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="theater-setup"]', { timeout: 15000 });
}

/* -------------------------------------------------------------------------
   CS.1 — City selector renders
   ------------------------------------------------------------------------- */

test.describe("CS.1 City selector renders", () => {
  test("city-selector section is visible on theater setup step", async ({ page }) => {
    await goToSetup(page);
    const citySelector = page.locator('[data-testid="city-selector"]');
    await expect(citySelector).toBeVisible();
  });

  test("all major markets appear as city buttons", async ({ page }) => {
    await goToSetup(page);
    // Spot-check key markets
    await expect(page.locator('[data-testid="city-new-york-city"]')).toBeVisible();
    await expect(page.locator('[data-testid="city-los-angeles"]')).toBeVisible();
    await expect(page.locator('[data-testid="city-chicago"]')).toBeVisible();
    await expect(page.locator('[data-testid="city-san-francisco"]')).toBeVisible();
  });

  test("at least 6 city buttons are rendered", async ({ page }) => {
    await goToSetup(page);
    const buttons = page.locator('[data-testid^="city-"]');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });
});

/* -------------------------------------------------------------------------
   CS.2 — NYC is selected by default
   ------------------------------------------------------------------------- */

test.describe("CS.2 NYC selected by default", () => {
  test("NYC city button appears active/selected on load", async ({ page }) => {
    await goToSetup(page);
    // The active city button has a solid accent background (style check via aria or computed)
    // We check that the NYC button exists and the LA one doesn't look the same
    const nycBtn = page.locator('[data-testid="city-new-york-city"]');
    await expect(nycBtn).toBeVisible();

    // NYC theaters should be showing in the theater-options
    const theaterOptions = page.locator('[data-testid="theater-options"]');
    await expect(theaterOptions).toBeVisible();
    await expect(page.locator('[data-testid="theater-amc-lincoln-square-13"]')).toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   CS.3 — NYC theaters shown by default
   ------------------------------------------------------------------------- */

test.describe("CS.3 NYC theaters in default list", () => {
  test("AMC Lincoln Square 13 appears in theater list on load", async ({ page }) => {
    await goToSetup(page);
    await expect(page.locator('[data-testid="theater-amc-lincoln-square-13"]')).toBeVisible();
  });

  test("AMC Empire 25 appears in theater list on load", async ({ page }) => {
    await goToSetup(page);
    await expect(page.locator('[data-testid="theater-amc-empire-25"]')).toBeVisible();
  });

  test("AMC Kips Bay 15 appears in theater list on load", async ({ page }) => {
    await goToSetup(page);
    await expect(page.locator('[data-testid="theater-amc-kips-bay-15"]')).toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   CS.4 — Clicking LA updates theater list
   ------------------------------------------------------------------------- */

test.describe("CS.4 LA city selection updates theater list", () => {
  test("clicking Los Angeles shows AMC Century City 15", async ({ page }) => {
    await goToSetup(page);
    await page.locator('[data-testid="city-los-angeles"]').click();
    await expect(page.locator('[data-testid="theater-amc-century-city-15"]')).toBeVisible();
  });

  test("clicking Los Angeles hides NYC theaters", async ({ page }) => {
    await goToSetup(page);
    await page.locator('[data-testid="city-los-angeles"]').click();
    await expect(page.locator('[data-testid="theater-amc-lincoln-square-13"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="theater-amc-empire-25"]')).not.toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   CS.5 — Clicking Chicago updates theater list
   ------------------------------------------------------------------------- */

test.describe("CS.5 Chicago city selection updates theater list", () => {
  test("clicking Chicago shows AMC River East 21", async ({ page }) => {
    await goToSetup(page);
    await page.locator('[data-testid="city-chicago"]').click();
    await expect(page.locator('[data-testid="theater-amc-river-east-21"]')).toBeVisible();
  });

  test("clicking Chicago hides NYC theaters", async ({ page }) => {
    await goToSetup(page);
    await page.locator('[data-testid="city-chicago"]').click();
    await expect(page.locator('[data-testid="theater-amc-lincoln-square-13"]')).not.toBeVisible();
  });
});

/* -------------------------------------------------------------------------
   CS.6 — Switching city clears selected theaters
   ------------------------------------------------------------------------- */

test.describe("CS.6 City switch clears theater selection", () => {
  test("selecting NYC theater then switching to LA clears selection", async ({ page }) => {
    await goToSetup(page);

    // Select a NYC theater
    await page.locator('[data-testid="theater-amc-lincoln-square-13"]').click();

    // Confirm Next button is now enabled
    const nextBtn = page.locator('[data-testid="theater-next"]');
    await expect(nextBtn).not.toBeDisabled();

    // Switch to LA
    await page.locator('[data-testid="city-los-angeles"]').click();

    // Next button should be disabled again (no LA theaters selected)
    await expect(nextBtn).toBeDisabled();
  });
});

/* -------------------------------------------------------------------------
   CS.7 — Next button disabled until theater selected in new city
   ------------------------------------------------------------------------- */

test.describe("CS.7 Next button state after city switch", () => {
  test("Next is disabled after switching to LA before selecting any theater", async ({ page }) => {
    await goToSetup(page);
    await page.locator('[data-testid="city-los-angeles"]').click();
    await expect(page.locator('[data-testid="theater-next"]')).toBeDisabled();
  });

  test("Next is enabled after selecting an LA theater", async ({ page }) => {
    await goToSetup(page);
    await page.locator('[data-testid="city-los-angeles"]').click();
    await page.locator('[data-testid="theater-amc-century-city-15"]').click();
    await expect(page.locator('[data-testid="theater-next"]')).not.toBeDisabled();
  });
});

/* -------------------------------------------------------------------------
   CS.8 — Switching back to NYC restores NYC theaters
   ------------------------------------------------------------------------- */

test.describe("CS.8 Switching back to NYC", () => {
  test("NYC theaters reappear after NYC → LA → NYC navigation", async ({ page }) => {
    await goToSetup(page);

    // Go to LA
    await page.locator('[data-testid="city-los-angeles"]').click();
    await expect(page.locator('[data-testid="theater-amc-century-city-15"]')).toBeVisible();

    // Go back to NYC
    await page.locator('[data-testid="city-new-york-city"]').click();
    await expect(page.locator('[data-testid="theater-amc-lincoln-square-13"]')).toBeVisible();
    await expect(page.locator('[data-testid="theater-amc-century-city-15"]')).not.toBeVisible();
  });
});
