/**
 * Unit tests for theaters.ts (Gap 1.3 + Gap 1.4)
 *
 * Gap 1.3 — searchTheaters(): name, slug, neighborhood matching, case-insensitive,
 *   market-scoped search, empty-query behavior, no-match returns [].
 * Gap 1.4 — getMarketForTheater(): null branch for unknown slug.
 */
import { describe, it, expect } from "vitest";
import {
  searchTheaters,
  getMarketForTheater,
  POPULAR_THEATERS,
} from "@/lib/theaters";

describe("Gap 1.3 — searchTheaters()", () => {
  it("matches by theater name substring", () => {
    const results = searchTheaters("Lincoln");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.slug === "amc-lincoln-square-13")).toBe(true);
  });

  it("matches by slug substring", () => {
    const results = searchTheaters("lincoln-square");
    expect(results.some((t) => t.slug === "amc-lincoln-square-13")).toBe(true);
  });

  it("matches by neighborhood", () => {
    // AMC Empire 25 is in "Times Square" neighborhood
    const results = searchTheaters("times square");
    expect(results.some((t) => t.slug === "amc-empire-25")).toBe(true);
  });

  it("is case-insensitive for name and neighborhood", () => {
    const lower = searchTheaters("kips bay");
    const upper = searchTheaters("KIPS BAY");
    const mixed = searchTheaters("Kips Bay");
    expect(lower.length).toBeGreaterThan(0);
    expect(upper.length).toEqual(lower.length);
    expect(mixed.length).toEqual(lower.length);
  });

  it("market-scoped search returns only theaters from that market", () => {
    // "grove" matches AMC The Grove 14 in los-angeles
    const allMarkets = searchTheaters("grove");
    const laOnly = searchTheaters("grove", "los-angeles");
    expect(laOnly.length).toBeGreaterThan(0);
    // Every result must be in the los-angeles market
    const laMarketSlugs = new Set(
      (POPULAR_THEATERS["los-angeles"] ?? []).map((t) => t.slug)
    );
    for (const t of laOnly) {
      expect(laMarketSlugs.has(t.slug)).toBe(true);
    }
    // All-markets search must contain at least as many results
    expect(allMarkets.length).toBeGreaterThanOrEqual(laOnly.length);
  });

  it("unknown market slug returns empty array (no theaters for that market)", () => {
    const results = searchTheaters("amc", "nonexistent-market-xyz");
    expect(results).toEqual([]);
  });

  it("query with no matches returns empty array", () => {
    const results = searchTheaters("xyzzy-no-such-theater-12345");
    expect(results).toEqual([]);
  });
});

describe("Gap 1.4 — getMarketForTheater()", () => {
  it("returns correct market for a known theater slug", () => {
    expect(getMarketForTheater("amc-lincoln-square-13")).toBe("new-york-city");
    expect(getMarketForTheater("amc-century-city-15")).toBe("los-angeles");
  });

  it("returns null for an unknown theater slug", () => {
    expect(getMarketForTheater("nonexistent-theater-slug")).toBeNull();
  });
});
