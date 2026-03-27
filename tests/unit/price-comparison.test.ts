/**
 * PriceComparisonTable — promo extraction logic unit tests
 *
 * Tests for the extractPromosByFormat helper that powers PriceComparisonTable.
 * The function mirrors the useMemo logic in the PriceComparisonTable component.
 *
 *  1. empty theaters → empty result
 *  2. single promo on one showtime → appears in correct format bucket
 *  3. duplicate promos on same format → deduplicated
 *  4. multiple formats each with distinct promos → each format has its own entry
 *  5. showtimes with no promo field → not included
 *  6. multiple theaters, same format → promos merged across theaters
 *  7. mixed promo + no-promo showtimes → only promo ones collected
 *  8. undefined theaters → returns empty object (null-safety)
 */

import { describe, it, expect } from "vitest";

/* -------------------------------------------------------------------------
   Mirror of the PriceComparisonTable promo extraction logic from page.tsx
   ------------------------------------------------------------------------- */
interface Showtime {
  id: string;
  time: string;
  amPm: string;
  status: string;
  url: string;
  promo?: string;
}

interface DateResult {
  date: string;
  available: boolean;
  showtimes: Showtime[];
  error?: string;
}

interface TheaterFormatData {
  dates: Record<string, DateResult>;
}

interface TheaterData {
  name: string;
  neighborhood: string;
  formats: Record<string, TheaterFormatData>;
}

function extractPromosByFormat(
  theaters: Record<string, TheaterData> | undefined
): Record<string, string[]> {
  if (!theaters) return {};
  const result: Record<string, Set<string>> = {};
  for (const theaterData of Object.values(theaters)) {
    for (const [formatTag, formatData] of Object.entries(theaterData.formats)) {
      for (const dateResult of Object.values(formatData.dates)) {
        for (const st of dateResult.showtimes) {
          if (st.promo) {
            if (!result[formatTag]) result[formatTag] = new Set<string>();
            result[formatTag].add(st.promo);
          }
        }
      }
    }
  }
  return Object.fromEntries(
    Object.entries(result).map(([k, v]) => [k, [...v]])
  ) as Record<string, string[]>;
}

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */
function makeShowtime(id: string, promo?: string): Showtime {
  return { id, time: "7:00", amPm: "PM", status: "Sellable", url: `/t/${id}`, promo };
}

function makeDate(showtimes: Showtime[]): DateResult {
  return { date: "2026-04-01", available: true, showtimes };
}

function makeFormatData(showtimes: Showtime[]): TheaterFormatData {
  return { dates: { "2026-04-01": makeDate(showtimes) } };
}

function makeTheater(
  formats: Record<string, Showtime[]>
): TheaterData {
  return {
    name: "Test Theater",
    neighborhood: "Test",
    formats: Object.fromEntries(
      Object.entries(formats).map(([tag, sts]) => [tag, makeFormatData(sts)])
    ),
  };
}

/* -------------------------------------------------------------------------
   Tests
   ------------------------------------------------------------------------- */
describe("extractPromosByFormat", () => {
  it("1. empty theaters object → empty result", () => {
    const result = extractPromosByFormat({});
    expect(result).toEqual({});
  });

  it("2. single promo on one showtime → appears in correct format bucket", () => {
    const theaters: Record<string, TheaterData> = {
      "amc-lincoln-square": makeTheater({
        imax70mm: [makeShowtime("st-1", "20% OFF")],
      }),
    };
    const result = extractPromosByFormat(theaters);
    expect(result).toHaveProperty("imax70mm");
    expect(result["imax70mm"]).toContain("20% OFF");
    expect(result["imax70mm"]).toHaveLength(1);
  });

  it("3. duplicate promos on same format across showtimes → deduplicated", () => {
    const theaters: Record<string, TheaterData> = {
      "amc-lincoln-square": makeTheater({
        imax70mm: [
          makeShowtime("st-1", "20% OFF"),
          makeShowtime("st-2", "20% OFF"),
          makeShowtime("st-3", "20% OFF"),
        ],
      }),
    };
    const result = extractPromosByFormat(theaters);
    expect(result["imax70mm"]).toHaveLength(1);
    expect(result["imax70mm"]).toEqual(["20% OFF"]);
  });

  it("4. multiple formats each with distinct promos → each format has its own entry", () => {
    const theaters: Record<string, TheaterData> = {
      "amc-lincoln-square": makeTheater({
        imax70mm: [makeShowtime("st-1", "20% OFF")],
        dolbycinema: [makeShowtime("st-2", "UP TO 15% OFF")],
        imax: [makeShowtime("st-3", "10% OFF")],
      }),
    };
    const result = extractPromosByFormat(theaters);
    expect(result["imax70mm"]).toEqual(["20% OFF"]);
    expect(result["dolbycinema"]).toEqual(["UP TO 15% OFF"]);
    expect(result["imax"]).toEqual(["10% OFF"]);
  });

  it("5. showtimes with no promo field → not included in result", () => {
    const theaters: Record<string, TheaterData> = {
      "amc-empire": makeTheater({
        imax70mm: [
          makeShowtime("st-1"),       // no promo
          makeShowtime("st-2"),       // no promo
        ],
      }),
    };
    const result = extractPromosByFormat(theaters);
    expect(result).not.toHaveProperty("imax70mm");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("6. multiple theaters with same format → promos merged across theaters", () => {
    const theaters: Record<string, TheaterData> = {
      "amc-lincoln-square": makeTheater({
        imax70mm: [makeShowtime("st-1", "20% OFF")],
      }),
      "amc-empire-25": makeTheater({
        imax70mm: [makeShowtime("st-2", "MEMBERS ONLY")],
      }),
    };
    const result = extractPromosByFormat(theaters);
    expect(result["imax70mm"]).toHaveLength(2);
    expect(result["imax70mm"]).toContain("20% OFF");
    expect(result["imax70mm"]).toContain("MEMBERS ONLY");
  });

  it("7. mixed promo + no-promo showtimes → only promo ones collected", () => {
    const theaters: Record<string, TheaterData> = {
      "amc-lincoln-square": makeTheater({
        imax70mm: [
          makeShowtime("st-1"),            // no promo
          makeShowtime("st-2", "20% OFF"), // has promo
          makeShowtime("st-3"),            // no promo
        ],
      }),
    };
    const result = extractPromosByFormat(theaters);
    expect(result["imax70mm"]).toHaveLength(1);
    expect(result["imax70mm"]).toEqual(["20% OFF"]);
  });

  it("8. undefined theaters → returns empty object", () => {
    const result = extractPromosByFormat(undefined);
    expect(result).toEqual({});
  });
});
