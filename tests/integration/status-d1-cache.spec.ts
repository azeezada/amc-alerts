/**
 * Gap 3.3 — /api/status D1 Cache Path
 *
 * Tests the cache-related logic extracted from /api/status/route.ts:
 *
 *  1. resolveTheaters() — custom slug capitalization (slug → title-cased name, empty neighborhood)
 *  2. resolveTheaters() — known slug returns POPULAR_THEATERS data unchanged
 *  3. D1 cache hit path — all entries fresh → allCached=true (cached: true response)
 *  4. D1 partial cache miss — null row → allCached=false (falls through to fresh scrape)
 *  5. D1 partial cache miss — stale row (> 15 min) → allCached=false
 *  6. D1 partial cache miss — multi-theater, second theater stale → allCached=false
 *  7. Rate limit — status route limit is 20 req/min; 20 allowed, 21st is 429
 *  8. Error propagation — checkAllTheatersAndFormats throws → 500 error shape
 *
 * All logic is tested by extracting pure functions / async logic from the route,
 * following the same pattern as check-deduplication.spec.ts and subscriber-scoping.spec.ts.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { POPULAR_THEATERS } from "@/lib/theaters";
import { rateLimit } from "@/lib/rate-limit";

/* -------------------------------------------------------------------------
   Extracted pure logic from /api/status/route.ts
   (Keep in sync with route if the route changes)
   ------------------------------------------------------------------------- */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function makeKey(theaterSlug: string, formatTag: string, date: string, movieSlug: string) {
  return `${movieSlug}__${theaterSlug}__${formatTag}__${date}`;
}

/** Mirrors resolveTheaters() from route.ts */
function resolveTheaters(slugs: string[]): { slug: string; name: string; neighborhood: string }[] {
  return slugs.map((slug) => {
    for (const theaters of Object.values(POPULAR_THEATERS)) {
      const found = theaters.find((t) => t.slug === slug);
      if (found) return { slug: found.slug, name: found.name, neighborhood: found.neighborhood };
    }
    const name = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { slug, name, neighborhood: "" };
  });
}

/* -------------------------------------------------------------------------
   D1 cache check helper (mirrors the outer: loop from route.ts)
   ------------------------------------------------------------------------- */

interface MockCacheRow {
  cache_key: string;
  data: string;
  checked_at: string; // ISO string
}

type MockQueryFn = (key: string) => Promise<MockCacheRow | null>;

async function checkAllCachedAndBuild(
  query: MockQueryFn,
  theaters: Array<{ slug: string; name: string; neighborhood: string }>,
  formats: Array<{ tag: string }>,
  dates: string[],
  movieSlug: string,
  now: number
): Promise<{ allCached: boolean; theaterMap: Record<string, unknown> }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theaterMap: Record<string, any> = {};
  let allCached = true;

  outer: for (const theater of theaters) {
    theaterMap[theater.slug] = {
      name: theater.name,
      neighborhood: theater.neighborhood,
      formats: {} as Record<string, { dates: Record<string, unknown> }>,
    };
    for (const format of formats) {
      theaterMap[theater.slug].formats[format.tag] = { dates: {} };
      for (const date of dates) {
        const key = makeKey(theater.slug, format.tag, date, movieSlug);
        const row = await query(key);
        if (row) {
          const cachedAt = new Date(row.checked_at).getTime();
          if (now - cachedAt < CACHE_TTL_MS) {
            theaterMap[theater.slug].formats[format.tag].dates[date] = JSON.parse(row.data);
            continue;
          }
        }
        allCached = false;
        break outer;
      }
    }
  }
  return { allCached, theaterMap };
}

/* -------------------------------------------------------------------------
   Gap 3.3.1 — resolveTheaters() custom slug capitalization
   ------------------------------------------------------------------------- */

describe("Gap 3.3.1 — resolveTheaters() custom slug capitalization", () => {
  it("unknown slug → title-cased name from hyphens, empty neighborhood", () => {
    const result = resolveTheaters(["some-custom-theater"]);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("some-custom-theater");
    expect(result[0].name).toBe("Some Custom Theater");
    expect(result[0].neighborhood).toBe("");
  });

  it("slug with numbers → capitalizes each word segment", () => {
    const result = resolveTheaters(["amc-fake-theater-12"]);
    expect(result[0].name).toBe("Amc Fake Theater 12");
    expect(result[0].neighborhood).toBe("");
  });

  it("single-word slug → title-cased name", () => {
    const result = resolveTheaters(["cinema"]);
    expect(result[0].name).toBe("Cinema");
    expect(result[0].neighborhood).toBe("");
  });

  it("known slug returns exact POPULAR_THEATERS data", () => {
    const result = resolveTheaters(["amc-lincoln-square-13"]);
    expect(result[0].slug).toBe("amc-lincoln-square-13");
    expect(result[0].name).toBe("AMC Lincoln Square 13");
    expect(result[0].neighborhood).toBe("Upper West Side");
  });

  it("known slug from a non-NYC market returns correct data", () => {
    const result = resolveTheaters(["amc-century-city-15"]);
    expect(result[0].slug).toBe("amc-century-city-15");
    expect(result[0].name).toBe("AMC Century City 15");
    expect(result[0].neighborhood).toBe("Century City");
  });

  it("mixed array: one known + one unknown → correct hybrid results", () => {
    const result = resolveTheaters(["amc-lincoln-square-13", "my-custom-theater"]);
    expect(result[0].name).toBe("AMC Lincoln Square 13");
    expect(result[0].neighborhood).toBe("Upper West Side");
    expect(result[1].name).toBe("My Custom Theater");
    expect(result[1].neighborhood).toBe("");
  });
});

/* -------------------------------------------------------------------------
   Gap 3.3.2 — D1 cache hit path: all fresh → allCached=true
   ------------------------------------------------------------------------- */

describe("Gap 3.3.2 — D1 cache: all-fresh → allCached=true", () => {
  const now = Date.now();
  const freshCheckedAt = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago (fresh)
  const theaters = [{ slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side" }];
  const formats = [{ tag: "imax" }];
  const dates = ["2026-04-03"];
  const movieSlug = "project-hail-mary-76779";

  it("single theater/format/date — fresh row → allCached=true", async () => {
    const mockData = JSON.stringify({ available: true, showtimes: [{ id: "100", time: "7:00", amPm: "PM" }] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: freshCheckedAt,
    });

    const { allCached, theaterMap } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(true);
    // theaterMap should have the parsed data
    const entry = theaterMap["amc-lincoln-square-13"].formats["imax"].dates["2026-04-03"];
    expect(entry.available).toBe(true);
    expect(entry.showtimes).toHaveLength(1);
  });

  it("multiple theaters × formats × dates — all fresh → allCached=true", async () => {
    const multiTheaters = [
      { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side" },
      { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Times Square" },
    ];
    const multiFormats = [{ tag: "imax" }, { tag: "imax70mm" }];
    const multiDates = ["2026-04-03", "2026-04-04"];
    const mockData = JSON.stringify({ available: false, showtimes: [] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: freshCheckedAt,
    });

    const { allCached } = await checkAllCachedAndBuild(query, multiTheaters, multiFormats, multiDates, movieSlug, now);
    expect(allCached).toBe(true);
  });
});

/* -------------------------------------------------------------------------
   Gap 3.3.3 — D1 partial cache miss: null or stale entry → allCached=false
   ------------------------------------------------------------------------- */

describe("Gap 3.3.3 — D1 partial cache miss → allCached=false (falls through to scrape)", () => {
  const now = Date.now();
  const freshCheckedAt = new Date(now - 5 * 60 * 1000).toISOString();  // 5 min ago (fresh)
  const staleCheckedAt = new Date(now - 20 * 60 * 1000).toISOString(); // 20 min ago (stale)
  const theaters = [{ slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side" }];
  const formats = [{ tag: "imax" }];
  const dates = ["2026-04-03"];
  const movieSlug = "project-hail-mary-76779";
  const mockData = JSON.stringify({ available: false, showtimes: [] });

  it("D1 returns null for the key → allCached=false", async () => {
    const query: MockQueryFn = async () => null;

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });

  it("D1 row exists but checked_at is stale (>15 min) → allCached=false", async () => {
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: staleCheckedAt, // 20 min ago — exceeds 15-min TTL
    });

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });

  it("first entry fresh, second entry null → allCached=false (breaks out of outer loop)", async () => {
    const multiDates = ["2026-04-03", "2026-04-04"];
    let callCount = 0;
    const query: MockQueryFn = async (key) => {
      callCount++;
      if (callCount === 1) {
        return { cache_key: key, data: mockData, checked_at: freshCheckedAt };
      }
      return null; // second call returns null
    };

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, multiDates, movieSlug, now);
    expect(allCached).toBe(false);
  });

  it("multi-theater: first theater fresh, second theater has stale row → allCached=false", async () => {
    const multiTheaters = [
      { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side" },
      { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Times Square" },
    ];
    const query: MockQueryFn = async (key) => {
      // First theater: fresh; second theater: stale
      if (key.includes("amc-empire-25")) {
        return { cache_key: key, data: mockData, checked_at: staleCheckedAt };
      }
      return { cache_key: key, data: mockData, checked_at: freshCheckedAt };
    };

    const { allCached } = await checkAllCachedAndBuild(query, multiTheaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });
});

/* -------------------------------------------------------------------------
   Gap 3.3.4 — Rate limit threshold for /api/status (limit: 20 req/min)
   ------------------------------------------------------------------------- */

describe("Gap 3.3.4 — /api/status rate limit (20 req/min)", () => {
  afterEach(() => vi.restoreAllMocks());

  function makeRequest(ip = "1.2.3.4"): Request {
    return new Request("https://example.com/api/status", {
      headers: { "cf-connecting-ip": ip },
    });
  }

  it("first 20 requests from same IP are allowed (rateLimit returns null)", () => {
    const ip = "5.5.5.5";
    for (let i = 0; i < 20; i++) {
      const result = rateLimit(makeRequest(ip) as Parameters<typeof rateLimit>[0], {
        limit: 20,
        windowMs: 60_000,
      });
      expect(result).toBeNull();
    }
  });

  it("21st request from same IP → 429 Too Many Requests", () => {
    const ip = "6.6.6.6";
    for (let i = 0; i < 20; i++) {
      rateLimit(makeRequest(ip) as Parameters<typeof rateLimit>[0], { limit: 20, windowMs: 60_000 });
    }
    const result = rateLimit(makeRequest(ip) as Parameters<typeof rateLimit>[0], {
      limit: 20,
      windowMs: 60_000,
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("different IPs each get their own independent limit bucket", () => {
    for (let i = 0; i < 20; i++) {
      rateLimit(makeRequest("7.7.7.7") as Parameters<typeof rateLimit>[0], { limit: 20, windowMs: 60_000 });
    }
    // A different IP should still be allowed
    const result = rateLimit(makeRequest("8.8.8.8") as Parameters<typeof rateLimit>[0], {
      limit: 20,
      windowMs: 60_000,
    });
    expect(result).toBeNull();
  });
});

/* -------------------------------------------------------------------------
   Gap 3.3.5 — Error path: scraper throws → 500 error shape
   ------------------------------------------------------------------------- */

describe("Gap 3.3.5 — Error path: scraper throws → 500 shape", () => {
  /**
   * Mirrors the catch block in the GET handler:
   *   catch (e) {
   *     return NextResponse.json({ error: "Failed to fetch showtimes", detail: String(e) }, { status: 500 });
   *   }
   */
  function buildStatusErrorResponse(e: unknown): { status: 500; body: { error: string; detail: string } } {
    return {
      status: 500,
      body: { error: "Failed to fetch showtimes", detail: String(e) },
    };
  }

  it("Error object → detail contains the error message", () => {
    const err = new Error("Scraper timed out");
    const resp = buildStatusErrorResponse(err);
    expect(resp.status).toBe(500);
    expect(resp.body.error).toBe("Failed to fetch showtimes");
    expect(resp.body.detail).toContain("Scraper timed out");
  });

  it("string error → detail is the string", () => {
    const resp = buildStatusErrorResponse("Unexpected HTML structure");
    expect(resp.status).toBe(500);
    expect(resp.body.detail).toBe("Unexpected HTML structure");
  });

  it("non-Error object → detail is String()-coerced", () => {
    const resp = buildStatusErrorResponse({ code: 503 });
    expect(resp.status).toBe(500);
    expect(resp.body.detail).toBe("[object Object]");
  });
});
