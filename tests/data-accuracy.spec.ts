import { test, expect } from "@playwright/test";

const STATUS_URL =
  "/api/status?theaters=amc-lincoln-square-13,amc-empire-25&movie=project-hail-mary-76779&dates=2026-04-03,2026-04-04,2026-04-05";

test.describe("Data Accuracy — Showtime IDs", () => {
  test("showtime IDs are numeric strings", async ({ request }) => {
    const resp = await request.get(STATUS_URL);
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      for (const [, format] of Object.entries(theater.formats) as [string, any][]) {
        for (const [, dateResult] of Object.entries(format.dates) as [string, any][]) {
          if (!dateResult.showtimes) continue;
          for (const st of dateResult.showtimes) {
            expect(st.id).toBeDefined();
            expect(st.id).not.toBe("");
            // Showtime IDs should be numeric (digits only)
            expect(st.id).toMatch(/^\d+$/);
          }
        }
      }
    }
  });
});

test.describe("Data Accuracy — Buy Tickets URLs", () => {
  test("Buy Tickets URLs are properly formatted AMC URLs", async ({ request }) => {
    const resp = await request.get(STATUS_URL);
    const body = await resp.json();

    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      for (const [, format] of Object.entries(theater.formats) as [string, any][]) {
        for (const [, dateResult] of Object.entries(format.dates) as [string, any][]) {
          if (!dateResult.showtimes) continue;
          for (const st of dateResult.showtimes) {
            expect(st.url).toBeDefined();
            expect(st.url).not.toBe("");
            // URL should be an AMC ticketing URL
            expect(st.url).toMatch(/^https:\/\/www\.amctheatres\.com\//);
            // URL should contain the showtime ID
            expect(st.url).toContain(st.id);
          }
        }
      }
    }
  });

  test("Buy Tickets URLs contain a valid showtimeId path segment", async ({ request }) => {
    const resp = await request.get(STATUS_URL);
    const body = await resp.json();

    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      for (const [, format] of Object.entries(theater.formats) as [string, any][]) {
        for (const [, dateResult] of Object.entries(format.dates) as [string, any][]) {
          if (!dateResult.showtimes) continue;
          for (const st of dateResult.showtimes) {
            // URL should have a numeric showtime ID somewhere in the path
            const url = new URL(st.url);
            const pathSegments = url.pathname.split("/").filter(Boolean);
            const hasNumericSegment = pathSegments.some((seg: string) => /^\d+$/.test(seg));
            expect(hasNumericSegment).toBe(true);
          }
        }
      }
    }
  });
});

test.describe("Data Accuracy — Theater-Format Mapping", () => {
  test("each showtime maps to the correct theater", async ({ request }) => {
    const resp = await request.get(STATUS_URL);
    const body = await resp.json();

    for (const [theaterSlug, theater] of Object.entries(body.theaters) as [string, any][]) {
      // Theater name should relate to the slug
      expect(theater.name).toBeDefined();
      expect(typeof theater.name).toBe("string");
      expect(theater.name.length).toBeGreaterThan(0);

      // The slug should be derivable from the name (lowercase, dashes)
      const slugFromName = theater.name.toLowerCase().replace(/\s+/g, "-");
      // At least the theater slug should share significant overlap with the name
      const slugParts = theaterSlug.split("-");
      const nameHasSlugWord = slugParts.some(
        (part: string) => part.length > 2 && slugFromName.includes(part)
      );
      expect(nameHasSlugWord).toBe(true);
    }
  });

  test("format keys are known format tags", async ({ request }) => {
    const KNOWN_FORMATS = ["imax70mm", "dolbycinema", "imax", "standard", "prime", "reald3d"];
    const resp = await request.get(STATUS_URL);
    const body = await resp.json();

    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      for (const formatTag of Object.keys(theater.formats)) {
        expect(KNOWN_FORMATS).toContain(formatTag);
      }
    }
  });

  test("date results use ISO date format (YYYY-MM-DD)", async ({ request }) => {
    const resp = await request.get(STATUS_URL);
    const body = await resp.json();

    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      for (const [, format] of Object.entries(theater.formats) as [string, any][]) {
        for (const dateKey of Object.keys(format.dates)) {
          expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });
});

test.describe("Data Accuracy — UI data-testid attributes", () => {
  test("Buy Tickets links have data-testid and data-showtime-id", async ({ page }) => {
    await page.goto(
      "/?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );

    // Wait for results to load
    await page.waitForSelector('[data-testid="results-view"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="showtime-grid"]', { timeout: 15000 });

    // Check if any buy tickets links exist (may not if no showtimes available)
    const buyLinks = page.locator('a[data-testid^="buy-tickets-"]');
    const count = await buyLinks.count();

    // If showtimes exist, verify their attributes
    for (let i = 0; i < count; i++) {
      const link = buyLinks.nth(i);
      const testId = await link.getAttribute("data-testid");
      const showtimeId = await link.getAttribute("data-showtime-id");
      const href = await link.getAttribute("href");

      // data-testid should follow the pattern buy-tickets-{id}
      expect(testId).toMatch(/^buy-tickets-\d+$/);
      // data-showtime-id should be numeric
      expect(showtimeId).toMatch(/^\d+$/);
      // href should be an AMC URL
      expect(href).toMatch(/^https:\/\/www\.amctheatres\.com\//);
      // href should contain the showtime ID
      expect(href).toContain(showtimeId!);
    }
  });
});
