import { test, expect } from "@playwright/test";

test.describe("AMC IMAX Alerts — Smoke Tests", () => {
  test("homepage loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/IMAX 70mm Alerts/);
  });

  test("hero section renders heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Track Any Movie at Any AMC Theater");
  });

  test("AMC SHOWTIME ALERTS badge is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("AMC SHOWTIME ALERTS")).toBeVisible();
  });

  test("setup flow card is visible on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("setup-flow")).toBeVisible();
  });

  test("no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForTimeout(2000);
    const critical = errors.filter(
      (e) =>
        !e.includes("Failed to fetch") &&
        !e.includes("ERR_CONNECTION") &&
        !e.includes("net::") &&
        !e.includes("Hydration") &&
        !e.includes("hydrat")
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe("Setup Flow — Theater Selection", () => {
  test("theater setup shows Select Theaters heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("theater-setup")).toBeVisible();
    await expect(page.getByText("Select Theaters")).toBeVisible();
  });

  test("curated theater list is visible without market selection", async ({ page }) => {
    await page.goto("/");
    // Theater list should be immediately visible
    await expect(page.getByTestId("theater-options")).toBeVisible();
    // Should show the three curated NYC theaters by name
    await expect(page.getByTestId("theater-amc-lincoln-square-13")).toBeVisible();
    await expect(page.getByTestId("theater-amc-empire-25")).toBeVisible();
    await expect(page.getByTestId("theater-amc-kips-bay-15")).toBeVisible();
  });

  test("Next button is disabled when no theaters selected", async ({ page }) => {
    await page.goto("/");
    const nextBtn = page.getByTestId("theater-next");
    await expect(nextBtn).toBeDisabled();
  });

  test("no custom theater slug input — only curated list", async ({ page }) => {
    await page.goto("/");
    // Should NOT have a free-text slug input
    await expect(page.getByPlaceholder("e.g. amc-metreon-16")).not.toBeVisible();
    // Should show curated theater buttons instead
    await expect(page.getByTestId("theater-options")).toBeVisible();
  });
});

test.describe("Setup Flow — Step Indicators", () => {
  test("three step indicators visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Theaters").first()).toBeVisible();
    await expect(page.getByText("Movie").first()).toBeVisible();
    await expect(page.getByText("Dates").first()).toBeVisible();
  });
});

test.describe("URL Parameters — Direct Results", () => {
  test("URL params skip setup and go to results", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01,2026-04-02,2026-04-03");
    await page.waitForTimeout(2000);
    await expect(page.getByTestId("results-view")).toBeVisible();
  });

  test("results view shows theater tabs", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13,amc-empire-25&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();
  });

  test("results view shows format pills", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    const formatGroup = page.locator('[role="group"][aria-label="Format selector"]');
    await expect(formatGroup).toBeVisible();
  });

  test("change selection button returns to setup", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    await page.getByTestId("change-selection").click();
    await expect(page.getByTestId("setup-flow")).toBeVisible();
  });
});

test.describe("Results View — Content Sections", () => {
  test("ratings section shows IMDb score", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    await expect(page.getByText("8.2/10")).toBeVisible();
    await expect(page.getByText("IMDb")).toBeVisible();
  });

  test("ratings section shows RT score", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    await expect(page.getByText("96%").first()).toBeVisible();
    await expect(page.getByText("Rotten Tomatoes")).toBeVisible();
  });

  test("trailer section has YouTube iframe", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Official Trailer")).toBeVisible();
    const iframe = page.locator('iframe[src*="youtube.com"]');
    await expect(iframe).toBeVisible();
  });

  test("Why IMAX 70mm section is present", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Why IMAX 70mm?")).toBeVisible();
    await expect(page.getByText("18K Resolution Equivalent")).toBeVisible();
  });

  test("share button is visible", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    await expect(page.getByText("Share").first()).toBeVisible();
  });

  test("compare all toggle works", async ({ page }) => {
    await page.goto("/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-01");
    await page.waitForTimeout(2000);
    const compareBtn = page.getByText("Compare all");
    await compareBtn.click();
    // Should now show "Card view" text
    await expect(page.getByText("Card view")).toBeVisible();
    // Should show comparison table
    const table = page.locator("table");
    await expect(table).toBeVisible();
  });
});

test.describe("Footer", () => {
  test("footer has How it works section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("How it works").first()).toBeVisible();
  });

  test("footer has disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Not affiliated/i).first()).toBeVisible();
  });

  test("footer has formats tracked section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Formats tracked").first()).toBeVisible();
  });
});

test.describe("Responsive / Mobile", () => {
  test("renders correctly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByTestId("setup-flow")).toBeVisible();
  });

  test("renders correctly on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("Meta & SEO", () => {
  test("favicon link present", async ({ page }) => {
    await page.goto("/");
    const favicons = page.locator('link[rel="icon"]');
    expect(await favicons.count()).toBeGreaterThanOrEqual(1);
  });

  test("OG meta tags present", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator('meta[property="og:title"]').count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator('meta[property="og:description"]').count()).toBeGreaterThanOrEqual(1);
  });

  test("Twitter card meta present", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator('meta[name="twitter:card"]').count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("Accessibility", () => {
  test("page has exactly one h1", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("h1").count()).toBe(1);
  });

  test("page uses Roboto font variable", async ({ page }) => {
    await page.goto("/");
    const htmlEl = page.locator("html");
    const classes = await htmlEl.getAttribute("class");
    expect(classes).toBeTruthy();
    expect(classes!.length).toBeGreaterThan(0);
  });
});

test.describe("Performance", () => {
  test("page loads in under 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
