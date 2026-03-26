/**
 * Layer 0: Live AMC Canary Tests
 *
 * These tests hit the real AMC website to validate that our HTML parsing
 * assumptions still hold. If these fail, our regex parsers are broken and
 * all other test results are unreliable.
 *
 * Run: npx playwright test --config playwright.unit.config.ts tests/canary/
 *
 * NOT run in CI on every commit — run daily or before deploying a scraper change.
 */
import { test, expect } from "@playwright/test";

const THEATER_SLUG = "amc-lincoln-square-13";
const MARKET_SLUG = "new-york-city";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

function todayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchAMCPage(date: string): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `https://www.amctheatres.com/movie-theatres/${MARKET_SLUG}/${THEATER_SLUG}/showtimes?date=${date}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  const body = await resp.text();
  return { ok: resp.ok, status: resp.status, body };
}

test.describe("AMC HTML Canary — Structure Validation", () => {
  let pageBody: string;
  let fetchStatus: number;

  test.beforeAll(async () => {
    const date = todayISODate();
    const result = await fetchAMCPage(date);
    fetchStatus = result.status;
    pageBody = result.body;
  });

  // 0.1a: Basic reachability
  test("0.1a: AMC responds with HTTP 200 (not blocked/CAPTCHA)", () => {
    if (fetchStatus === 429) {
      test.skip(true, "AMC is rate-limiting — try again later");
    }
    if (fetchStatus === 403) {
      test.fail(true, "AMC is blocking scraper requests (403)");
    }
    expect(fetchStatus).toBe(200);
  });

  // 0.1b: Response is HTML, not an error page
  test("0.1b: Response body is HTML (contains doctype or html tag)", () => {
    const lower = pageBody.toLowerCase();
    const isHTML = lower.includes("<!doctype html") || lower.includes("<html");
    expect(isHTML, "Response should be HTML — may be JSON error or redirect").toBe(true);
  });

  // 0.2a: Showtime anchors with aria-describedby exist
  test("0.2a: HTML contains showtime anchors with aria-describedby attribute", () => {
    // Our scraper relies on: <a aria-describedby="..." id="N" href="/showtimes/N">
    const hasAnchor = /<a[^>]+aria-describedby="[^"]*"[^>]*id="\d+"[^>]*href="\/showtimes\/\d+"/.test(pageBody);
    if (!hasAnchor) {
      // Could be no showtimes today — check if movie links exist at all
      const hasMovieLinks = /href="\/movies\/[a-z0-9-]+"/.test(pageBody);
      if (!hasMovieLinks) {
        test.fail(true, "AMC HTML has NO movie links — structure may have changed completely");
      }
      // No showtimes today is OK (not a scraper breakage)
      test.skip(true, "No showtime anchors found for today — may be no showtimes yet");
    }
    expect(hasAnchor).toBe(true);
  });

  // 0.2b: Movie links exist
  test("0.2b: HTML contains movie links (href=/movies/{slug})", () => {
    const hasMovieLinks = /href="\/movies\/[a-z0-9-]+"/.test(pageBody);
    expect(hasMovieLinks, "AMC HTML should have /movies/{slug} links — structure may have changed").toBe(true);
  });

  // 0.2c: Showtime href pattern valid
  test("0.2c: Showtime hrefs contain numeric IDs", () => {
    const matches = pageBody.match(/href="\/showtimes\/(\d+)"/g);
    if (!matches) {
      test.skip(true, "No showtimes today — skip numeric ID check");
    }
    // Every captured group should be numeric
    const ids = (matches || []).map((m) => m.match(/\/showtimes\/(\d+)/)?.[1]);
    for (const id of ids) {
      expect(id).toMatch(/^\d+$/);
    }
  });

  // 0.3: CAPTCHA/block detection
  test("0.3: No CAPTCHA or challenge page detected", () => {
    const lower = pageBody.toLowerCase();
    const isCaptcha =
      lower.includes("captcha") ||
      lower.includes("challenge") ||
      lower.includes("cf-challenge") ||
      lower.includes("access denied");
    expect(isCaptcha, "AMC is serving a CAPTCHA — scraper is blocked").toBe(false);
  });
});
