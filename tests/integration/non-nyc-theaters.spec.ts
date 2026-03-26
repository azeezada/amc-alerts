/**
 * Gap 4.6 — Non-NYC Theaters in /api/status Pipeline
 *
 * All prior integration tests use NYC theater slugs (amc-lincoln-square-13,
 * amc-empire-25). This file exercises LA and Chicago slugs through the same
 * functions the /api/status route uses:
 *
 *  1. resolveTheaters() with LA slugs → returns correct name + neighborhood
 *  2. resolveTheaters() with Chicago slugs → returns correct name + neighborhood
 *  3. resolveTheaters() with mixed-market slugs (NYC + LA) → correct per-theater data
 *  4. getMarketForTheater() for LA theaters → returns "los-angeles"
 *  5. getMarketForTheater() for Chicago theaters → returns "chicago"
 *  6. checkAllCachedAndBuild() with LA theaters → allCached=true path works
 *  7. checkAllCachedAndBuild() with Chicago theaters → partial miss → allCached=false
 *  8. checkAllCachedAndBuild() with cross-market (NYC + LA) → fresh → allCached=true
 *  9. resolveTheaters() for an LA theater that has hasImax70mm=true (amc-century-city-15)
 * 10. makeKey() cache keys embed theater slug correctly for non-NYC slugs
 */
import { describe, it, expect } from "vitest";
import { POPULAR_THEATERS, getMarketForTheater } from "@/lib/theaters";

/* -------------------------------------------------------------------------
   Pure helpers mirrored from /api/status/route.ts
   (Keep in sync if the route changes)
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

interface MockCacheRow {
  cache_key: string;
  data: string;
  checked_at: string;
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
   Gap 4.6.1 — resolveTheaters() with LA theater slugs
   ------------------------------------------------------------------------- */

describe("Gap 4.6.1 — resolveTheaters() with LA theater slugs", () => {
  it("amc-century-city-15 resolves to correct name and neighborhood", () => {
    const result = resolveTheaters(["amc-century-city-15"]);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("amc-century-city-15");
    expect(result[0].name).toBe("AMC Century City 15");
    expect(result[0].neighborhood).toBe("Century City");
  });

  it("amc-burbank-16 resolves to correct name and neighborhood", () => {
    const result = resolveTheaters(["amc-burbank-16"]);
    expect(result[0].slug).toBe("amc-burbank-16");
    expect(result[0].name).toBe("AMC Burbank 16");
    expect(result[0].neighborhood).toBe("Burbank");
  });

  it("amc-grove-14 resolves to correct name and neighborhood", () => {
    const result = resolveTheaters(["amc-grove-14"]);
    expect(result[0].name).toBe("AMC The Grove 14");
    expect(result[0].neighborhood).toBe("The Grove");
  });

  it("all LA theaters resolve with non-empty neighborhood", () => {
    const laSlugs = POPULAR_THEATERS["los-angeles"].map((t) => t.slug);
    const resolved = resolveTheaters(laSlugs);
    for (const r of resolved) {
      expect(r.neighborhood).not.toBe("");
    }
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.2 — resolveTheaters() with Chicago theater slugs
   ------------------------------------------------------------------------- */

describe("Gap 4.6.2 — resolveTheaters() with Chicago theater slugs", () => {
  it("amc-navy-pier-imax resolves to correct name and neighborhood", () => {
    const result = resolveTheaters(["amc-navy-pier-imax"]);
    expect(result[0].slug).toBe("amc-navy-pier-imax");
    expect(result[0].name).toBe("AMC Navy Pier IMAX");
    expect(result[0].neighborhood).toBe("Navy Pier");
  });

  it("amc-river-east-21 resolves to correct name and neighborhood", () => {
    const result = resolveTheaters(["amc-river-east-21"]);
    expect(result[0].name).toBe("AMC River East 21");
    expect(result[0].neighborhood).toBe("Streeterville");
  });

  it("all Chicago theaters resolve with non-empty neighborhood", () => {
    const chicagoSlugs = POPULAR_THEATERS["chicago"].map((t) => t.slug);
    const resolved = resolveTheaters(chicagoSlugs);
    for (const r of resolved) {
      expect(r.neighborhood).not.toBe("");
    }
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.3 — resolveTheaters() with mixed-market slugs (NYC + LA)
   ------------------------------------------------------------------------- */

describe("Gap 4.6.3 — resolveTheaters() with mixed-market slugs", () => {
  it("NYC + LA slugs in one call → each resolved correctly from its market", () => {
    const result = resolveTheaters(["amc-lincoln-square-13", "amc-century-city-15"]);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("amc-lincoln-square-13");
    expect(result[0].name).toBe("AMC Lincoln Square 13");
    expect(result[0].neighborhood).toBe("Upper West Side");
    expect(result[1].slug).toBe("amc-century-city-15");
    expect(result[1].name).toBe("AMC Century City 15");
    expect(result[1].neighborhood).toBe("Century City");
  });

  it("NYC + Chicago slugs in one call → each resolved correctly", () => {
    const result = resolveTheaters(["amc-empire-25", "amc-navy-pier-imax"]);
    expect(result[0].name).toBe("AMC Empire 25");
    expect(result[0].neighborhood).toBe("Times Square");
    expect(result[1].name).toBe("AMC Navy Pier IMAX");
    expect(result[1].neighborhood).toBe("Navy Pier");
  });

  it("order is preserved: LA, Chicago, NYC slugs returned in input order", () => {
    const slugs = ["amc-grove-14", "amc-block-37", "amc-kips-bay-15"];
    const result = resolveTheaters(slugs);
    expect(result[0].slug).toBe("amc-grove-14");
    expect(result[1].slug).toBe("amc-block-37");
    expect(result[2].slug).toBe("amc-kips-bay-15");
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.4 — getMarketForTheater() for LA and Chicago slugs
   ------------------------------------------------------------------------- */

describe("Gap 4.6.4 — getMarketForTheater() for LA and Chicago theaters", () => {
  it("amc-century-city-15 → 'los-angeles'", () => {
    expect(getMarketForTheater("amc-century-city-15")).toBe("los-angeles");
  });

  it("amc-burbank-16 → 'los-angeles'", () => {
    expect(getMarketForTheater("amc-burbank-16")).toBe("los-angeles");
  });

  it("amc-navy-pier-imax → 'chicago'", () => {
    expect(getMarketForTheater("amc-navy-pier-imax")).toBe("chicago");
  });

  it("amc-river-east-21 → 'chicago'", () => {
    expect(getMarketForTheater("amc-river-east-21")).toBe("chicago");
  });

  it("unknown slug → null (not NYC by default)", () => {
    expect(getMarketForTheater("some-la-theater-not-in-db")).toBeNull();
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.5 — checkAllCachedAndBuild() with LA theaters: allCached=true path
   ------------------------------------------------------------------------- */

describe("Gap 4.6.5 — checkAllCachedAndBuild() with LA theaters: allCached path", () => {
  const now = Date.now();
  const freshCheckedAt = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago
  const movieSlug = "project-hail-mary-76779";
  const formats = [{ tag: "imax" }];
  const dates = ["2026-04-03"];

  it("single LA theater — all fresh → allCached=true with correct theaterMap", async () => {
    const theaters = resolveTheaters(["amc-century-city-15"]);
    const mockData = JSON.stringify({ available: true, showtimes: [{ id: "la-100", time: "8:00", amPm: "PM" }] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: freshCheckedAt,
    });

    const { allCached, theaterMap } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (theaterMap["amc-century-city-15"] as any).formats["imax"].dates["2026-04-03"];
    expect(entry.available).toBe(true);
    expect(entry.showtimes).toHaveLength(1);
  });

  it("two LA theaters — both fresh → allCached=true", async () => {
    const theaters = resolveTheaters(["amc-century-city-15", "amc-burbank-16"]);
    const mockData = JSON.stringify({ available: false, showtimes: [] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: freshCheckedAt,
    });

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(true);
  });

  it("theaterMap for LA theater includes correct name and neighborhood from POPULAR_THEATERS", async () => {
    const theaters = resolveTheaters(["amc-century-city-15"]);
    const mockData = JSON.stringify({ available: false, showtimes: [] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: freshCheckedAt,
    });

    const { theaterMap } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((theaterMap["amc-century-city-15"] as any).name).toBe("AMC Century City 15");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((theaterMap["amc-century-city-15"] as any).neighborhood).toBe("Century City");
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.6 — checkAllCachedAndBuild() with Chicago theaters: partial miss
   ------------------------------------------------------------------------- */

describe("Gap 4.6.6 — checkAllCachedAndBuild() with Chicago theaters: partial miss", () => {
  const now = Date.now();
  const freshCheckedAt = new Date(now - 5 * 60 * 1000).toISOString();
  const staleCheckedAt = new Date(now - 20 * 60 * 1000).toISOString(); // 20 min ago (stale)
  const movieSlug = "project-hail-mary-76779";
  const formats = [{ tag: "imax" }];
  const dates = ["2026-04-03"];

  it("Chicago theater — D1 returns null → allCached=false", async () => {
    const theaters = resolveTheaters(["amc-navy-pier-imax"]);
    const query: MockQueryFn = async () => null;

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });

  it("Chicago theater — stale row (>15 min) → allCached=false", async () => {
    const theaters = resolveTheaters(["amc-river-east-21"]);
    const mockData = JSON.stringify({ available: false, showtimes: [] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: staleCheckedAt,
    });

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });

  it("two Chicago theaters — first fresh, second stale → allCached=false", async () => {
    const theaters = resolveTheaters(["amc-navy-pier-imax", "amc-river-east-21"]);
    const mockData = JSON.stringify({ available: false, showtimes: [] });
    const query: MockQueryFn = async (key) => {
      if (key.includes("amc-river-east-21")) {
        return { cache_key: key, data: mockData, checked_at: staleCheckedAt };
      }
      return { cache_key: key, data: mockData, checked_at: freshCheckedAt };
    };

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.7 — checkAllCachedAndBuild() with cross-market (NYC + LA) theaters
   ------------------------------------------------------------------------- */

describe("Gap 4.6.7 — checkAllCachedAndBuild() with cross-market (NYC + LA) theaters", () => {
  const now = Date.now();
  const freshCheckedAt = new Date(now - 5 * 60 * 1000).toISOString();
  const movieSlug = "project-hail-mary-76779";
  const formats = [{ tag: "imax70mm" }];
  const dates = ["2026-04-03"];

  it("NYC + LA theaters — all fresh → allCached=true", async () => {
    const theaters = resolveTheaters(["amc-lincoln-square-13", "amc-century-city-15"]);
    const mockData = JSON.stringify({ available: true, showtimes: [{ id: "x1", time: "7:00", amPm: "PM" }] });
    const query: MockQueryFn = async (key) => ({
      cache_key: key,
      data: mockData,
      checked_at: freshCheckedAt,
    });

    const { allCached, theaterMap } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((theaterMap["amc-lincoln-square-13"] as any).name).toBe("AMC Lincoln Square 13");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((theaterMap["amc-century-city-15"] as any).name).toBe("AMC Century City 15");
  });

  it("NYC theater fresh + LA theater stale → allCached=false", async () => {
    const theaters = resolveTheaters(["amc-lincoln-square-13", "amc-century-city-15"]);
    const staleCheckedAt = new Date(now - 20 * 60 * 1000).toISOString();
    const mockData = JSON.stringify({ available: false, showtimes: [] });
    const query: MockQueryFn = async (key) => {
      const checkedAt = key.includes("amc-century-city-15") ? staleCheckedAt : freshCheckedAt;
      return { cache_key: key, data: mockData, checked_at: checkedAt };
    };

    const { allCached } = await checkAllCachedAndBuild(query, theaters, formats, dates, movieSlug, now);
    expect(allCached).toBe(false);
  });
});

/* -------------------------------------------------------------------------
   Gap 4.6.8 — makeKey() cache keys embed non-NYC theater slugs correctly
   ------------------------------------------------------------------------- */

describe("Gap 4.6.8 — makeKey() embeds non-NYC theater slugs correctly", () => {
  const movieSlug = "project-hail-mary-76779";

  it("LA theater key contains the correct slug segment", () => {
    const key = makeKey("amc-century-city-15", "imax70mm", "2026-04-03", movieSlug);
    expect(key).toContain("amc-century-city-15");
    expect(key).toBe(`${movieSlug}__amc-century-city-15__imax70mm__2026-04-03`);
  });

  it("Chicago theater key contains the correct slug segment", () => {
    const key = makeKey("amc-navy-pier-imax", "imax", "2026-04-04", movieSlug);
    expect(key).toContain("amc-navy-pier-imax");
    expect(key).toBe(`${movieSlug}__amc-navy-pier-imax__imax__2026-04-04`);
  });

  it("keys for different markets have distinct slugs (no collision)", () => {
    const nycKey = makeKey("amc-lincoln-square-13", "imax70mm", "2026-04-03", movieSlug);
    const laKey = makeKey("amc-century-city-15", "imax70mm", "2026-04-03", movieSlug);
    const chiKey = makeKey("amc-navy-pier-imax", "imax70mm", "2026-04-03", movieSlug);
    expect(nycKey).not.toBe(laKey);
    expect(laKey).not.toBe(chiKey);
    expect(nycKey).not.toBe(chiKey);
  });
});
