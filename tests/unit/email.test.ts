/**
 * Layer 4 (unit portion): Email Template Tests
 * Tests buildEmailHtml and buildEmailText output correctness.
 */
import { describe, it, expect } from "vitest";
import { buildEmailHtml, buildEmailText } from "@/lib/email";
import type { DateResult } from "@/lib/scraper";

/* -------------------------------------------------------------------------
   Test data
   ------------------------------------------------------------------------- */

const sampleDates: DateResult[] = [
  {
    date: "2026-04-03",
    available: true,
    showtimes: [
      {
        id: "140840248",
        time: "11:00",
        amPm: "AM",
        status: "Sellable",
        url: "https://www.amctheatres.com/showtimes/140840248",
      },
      {
        id: "140840247",
        time: "3:00",
        amPm: "PM",
        status: "AlmostFull",
        url: "https://www.amctheatres.com/showtimes/140840247",
      },
      {
        id: "140840246",
        time: "7:00",
        amPm: "PM",
        status: "SoldOut",
        url: "https://www.amctheatres.com/showtimes/140840246",
      },
    ],
  },
  {
    date: "2026-04-04",
    available: true,
    showtimes: [
      {
        id: "140840300",
        time: "1:00",
        amPm: "PM",
        status: "Sellable",
        url: "https://www.amctheatres.com/showtimes/140840300",
      },
    ],
  },
];

/* =========================================================================
   buildEmailHtml
   ========================================================================= */

describe("buildEmailHtml", () => {
  const html = buildEmailHtml(sampleDates, "test-token-123", "user@example.com");

  it("contains correct dates formatted nicely", () => {
    expect(html).toContain("April 3"); // Thursday, April 3
    expect(html).toContain("April 4");
  });

  it("contains all showtime times", () => {
    expect(html).toContain("11:00 AM");
    expect(html).toContain("3:00 PM");
    expect(html).toContain("7:00 PM");
    expect(html).toContain("1:00 PM");
  });

  it("contains all Buy Tickets URLs", () => {
    expect(html).toContain("https://www.amctheatres.com/showtimes/140840248");
    expect(html).toContain("https://www.amctheatres.com/showtimes/140840247");
    expect(html).toContain("https://www.amctheatres.com/showtimes/140840246");
    expect(html).toContain("https://www.amctheatres.com/showtimes/140840300");
  });

  it("contains status text for each showtime", () => {
    expect(html).toContain("Sellable");
    expect(html).toContain("AlmostFull");
    expect(html).toContain("SoldOut");
  });

  it("contains unsubscribe link with token and email", () => {
    expect(html).toContain("test-token-123");
    expect(html).toContain("user%40example.com");
    expect(html).toContain("Unsubscribe");
  });

  it("omits unsubscribe link when no token provided", () => {
    const noUnsub = buildEmailHtml(sampleDates);
    expect(noUnsub).not.toContain("Unsubscribe");
  });

  it("reports correct number of dates in banner", () => {
    expect(html).toContain("2 dates");
    const single = buildEmailHtml([sampleDates[0]]);
    expect(single).toContain("1 date");
  });

  it("uses dynamic movie title and theater name when provided", () => {
    const custom = buildEmailHtml(sampleDates, undefined, undefined, "Mission Impossible", "AMC Empire 25");
    expect(custom).toContain("Mission Impossible");
    expect(custom).toContain("AMC Empire 25");
    expect(custom).not.toContain("Project Hail Mary");
  });

  it("falls back to generic strings when movie/theater not provided", () => {
    const fallback = buildEmailHtml(sampleDates);
    expect(fallback).toContain("IMAX Showtime");
    expect(fallback).toContain("AMC Theatres");
  });
});

/* =========================================================================
   buildEmailText
   ========================================================================= */

describe("buildEmailText", () => {
  const text = buildEmailText(sampleDates);

  it("contains correct dates", () => {
    expect(text).toContain("April 3");
    expect(text).toContain("April 4");
  });

  it("contains showtime times and statuses", () => {
    expect(text).toContain("11:00 AM — Sellable");
    expect(text).toContain("3:00 PM — AlmostFull");
    expect(text).toContain("7:00 PM — SoldOut");
  });

  it("contains Buy Tickets URLs", () => {
    expect(text).toContain("https://www.amctheatres.com/showtimes/140840248");
    expect(text).toContain("https://www.amctheatres.com/showtimes/140840300");
  });

  it("uses dynamic movie title and theater name in plain text", () => {
    const custom = buildEmailText(sampleDates, "Mission Impossible", "AMC Empire 25");
    expect(custom).toContain("Mission Impossible");
    expect(custom).toContain("AMC Empire 25");
    expect(custom).not.toContain("Project Hail Mary");
  });

  it("falls back to generic strings when movie/theater not provided", () => {
    const fallback = buildEmailText(sampleDates);
    expect(fallback).toContain("IMAX Showtime");
    expect(fallback).toContain("AMC Theatres");
  });
});
