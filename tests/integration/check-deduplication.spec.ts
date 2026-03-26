/**
 * Gap 4.3 — /api/check Deduplication Delta Logic
 *
 * Tests the cache-comparison logic in runCheck(): when previous cache has
 * N showtimes and current scrape returns N+M, only M net-new showtimes
 * trigger a notification. The "Already known, no changes" path is also covered.
 *
 * We test the pure deduplication logic extracted from route.ts, following
 * the same pattern as subscriber-scoping.spec.ts.
 */
import { describe, it, expect } from "vitest";
import { type DateResult } from "@/lib/scraper";

/* -------------------------------------------------------------------------
   Extracted deduplication logic from /api/check route.ts
   (lines 120-139: the isNew determination block)
   ------------------------------------------------------------------------- */

interface MockCacheRow {
  cache_key: string;
  data: string; // JSON-serialized DateResult
}

/**
 * Mirrors the deduplication logic from runCheck().
 * Returns { isNew, newShowtimeCount } for a given current result vs cached value.
 */
function computeIsNew(
  currentResult: DateResult,
  cached: MockCacheRow | null
): { isNew: boolean; newShowtimeCount: number } {
  if (!currentResult.available || currentResult.showtimes.length === 0) {
    return { isNew: false, newShowtimeCount: 0 };
  }

  if (!cached) {
    return { isNew: true, newShowtimeCount: currentResult.showtimes.length };
  }

  const prevData = JSON.parse(cached.data) as DateResult;
  if (!prevData.available || prevData.showtimes.length === 0) {
    return { isNew: true, newShowtimeCount: currentResult.showtimes.length };
  }

  const prevIds = new Set(prevData.showtimes.map((s) => s.id));
  const netNewShowtimes = currentResult.showtimes.filter((s) => !prevIds.has(s.id));
  const isNew = netNewShowtimes.length > 0;
  return { isNew, newShowtimeCount: netNewShowtimes.length };
}

function makeShowtime(id: string) {
  return { id, time: "7:00", amPm: "PM", status: "Sellable" as const, url: `https://www.amctheatres.com/showtimes/${id}` };
}

function makeDateResult(ids: string[], available = true): DateResult {
  return {
    date: "2026-04-03",
    available,
    showtimes: ids.map(makeShowtime),
  };
}

function makeCachedRow(result: DateResult): MockCacheRow {
  return { cache_key: "test-key", data: JSON.stringify(result) };
}

/* -------------------------------------------------------------------------
   Gap 4.3 Tests
   ------------------------------------------------------------------------- */

describe("Gap 4.3 — /api/check deduplication delta logic", () => {
  it("no cache entry → all showtimes are new", () => {
    const current = makeDateResult(["100", "101", "102"]);
    const { isNew, newShowtimeCount } = computeIsNew(current, null);
    expect(isNew).toBe(true);
    expect(newShowtimeCount).toBe(3);
  });

  it("cache has 2 showtimes, current has 3 → 1 net-new showtime", () => {
    const prev = makeDateResult(["100", "101"]);
    const current = makeDateResult(["100", "101", "102"]);
    const { isNew, newShowtimeCount } = computeIsNew(current, makeCachedRow(prev));
    expect(isNew).toBe(true);
    expect(newShowtimeCount).toBe(1);
  });

  it("cache has same 3 showtimes as current → no new showtimes (no-op)", () => {
    const prev = makeDateResult(["100", "101", "102"]);
    const current = makeDateResult(["100", "101", "102"]);
    const { isNew, newShowtimeCount } = computeIsNew(current, makeCachedRow(prev));
    expect(isNew).toBe(false);
    expect(newShowtimeCount).toBe(0);
  });

  it("cache was unavailable (0 showtimes), now has showtimes → isNew=true", () => {
    const prev = makeDateResult([], false);
    const current = makeDateResult(["200", "201"]);
    const { isNew, newShowtimeCount } = computeIsNew(current, makeCachedRow(prev));
    expect(isNew).toBe(true);
    expect(newShowtimeCount).toBe(2);
  });

  it("current result unavailable → isNew=false regardless of cache", () => {
    // Even if cache has showtimes, a now-unavailable result doesn't trigger new notification
    const prev = makeDateResult(["100", "101"]);
    const current = makeDateResult([], false);
    const { isNew } = computeIsNew(current, makeCachedRow(prev));
    expect(isNew).toBe(false);
  });

  it("cache has 5 showtimes, current adds 2 more → 2 net-new", () => {
    const prevIds = ["10", "11", "12", "13", "14"];
    const currIds = ["10", "11", "12", "13", "14", "15", "16"];
    const prev = makeDateResult(prevIds);
    const current = makeDateResult(currIds);
    const { isNew, newShowtimeCount } = computeIsNew(current, makeCachedRow(prev));
    expect(isNew).toBe(true);
    expect(newShowtimeCount).toBe(2);
  });

  it("completely disjoint showtimes (different IDs) → all current are new", () => {
    // Rare case: maybe IDs changed, or different date segment
    const prev = makeDateResult(["100", "101"]);
    const current = makeDateResult(["200", "201"]);
    const { isNew, newShowtimeCount } = computeIsNew(current, makeCachedRow(prev));
    expect(isNew).toBe(true);
    expect(newShowtimeCount).toBe(2);
  });
});
