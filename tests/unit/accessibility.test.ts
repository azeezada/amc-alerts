/**
 * Accessibility info tests — CC, AD, and wheelchair access
 *
 * Verifies that:
 *  - extractFormatShowtimes() correctly sets closedCaption/audioDescription
 *    from AMC's aria-describedby attributes list
 *  - getAmenityBadge() returns the wheelchair icon for wheelchair/ADA amenities
 *  - All curated theaters have the wheelchair accessible amenity
 */
import { describe, it, expect } from "vitest";
import { extractFormatShowtimes } from "@/lib/scraper";
import { getAmenityBadge, POPULAR_THEATERS } from "@/lib/theaters";

/* -------------------------------------------------------------------------
   HTML builder helpers
   ------------------------------------------------------------------------- */

/**
 * Build a minimal AMC-like HTML fragment with a showtime anchor + attributes list.
 *
 * AMC structure:
 *   <ul id="${movieSlug}-${theaterSlug}-${formatTag}-0-attributes">
 *     <li>IMAX at AMC</li><li>Closed Caption</li>...
 *   </ul>
 *   ...
 *   <a aria-describedby="... ${attrId}" id="${id}" href="/showtimes/${id}">7:00<!-- -->pm</a>
 */
function makeShowtimeHtml(
  id: string,
  time: string,
  amPm: "am" | "pm",
  formatTag: string,
  movieSlug: string,
  attributes: string[],
  theaterSlug = "test-theater"
): string {
  const attrId = `${movieSlug}-${theaterSlug}-${formatTag}-0-attributes`;
  const describedBy = [
    movieSlug,
    `${movieSlug}-${theaterSlug}`,
    `${movieSlug}-${theaterSlug}-${formatTag}`,
    `${movieSlug}-${theaterSlug}-${formatTag}-0`,
    attrId,
  ].join(" ");

  const attrUl = `<ul id="${attrId}">${attributes.map((a) => `<li>${a}</li>`).join("")}</ul>`;
  const anchor = `<a aria-describedby="${describedBy}" id="${id}" href="/showtimes/${id}">${time}<!-- -->${amPm}</a>`;

  // Include a movie link so extractMovieSection can scope if needed
  return `<a href="/movies/${movieSlug}">Test Movie</a>${attrUl}${anchor}`;
}

const MOVIE = "test-movie-11111";
const FORMAT = "imax70mm";

/* =========================================================================
   Closed Caption extraction
   ========================================================================= */

describe("Accessibility — Closed Caption (CC) extraction", () => {
  it("sets closedCaption=true when attributes list contains 'Closed Caption'", () => {
    const html = makeShowtimeHtml("1001", "7:00", "pm", FORMAT, MOVIE, [
      "IMAX at AMC",
      "Closed Caption",
      "Reserved Seating",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].closedCaption).toBe(true);
    expect(results[0].audioDescription).toBeUndefined();
  });

  it("does not set closedCaption when attributes list has no CC entry", () => {
    const html = makeShowtimeHtml("1002", "8:00", "pm", FORMAT, MOVIE, [
      "IMAX at AMC",
      "70mm",
      "Reserved Seating",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].closedCaption).toBeUndefined();
  });

  it("detects 'Closed Caption' case-insensitively (e.g. CLOSED CAPTION in HTML)", () => {
    // The scraper lowercases the attrChunk before checking
    const html = makeShowtimeHtml("1003", "9:00", "pm", FORMAT, MOVIE, [
      "CLOSED CAPTION",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].closedCaption).toBe(true);
  });
});

/* =========================================================================
   Audio Description extraction
   ========================================================================= */

describe("Accessibility — Audio Description (AD) extraction", () => {
  it("sets audioDescription=true when attributes list contains 'Audio Description'", () => {
    const html = makeShowtimeHtml("2001", "7:00", "pm", FORMAT, MOVIE, [
      "Audio Description",
      "IMAX at AMC",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].audioDescription).toBe(true);
    expect(results[0].closedCaption).toBeUndefined();
  });

  it("detects 'Audio Description' case-insensitively", () => {
    const html = makeShowtimeHtml("2002", "8:00", "pm", FORMAT, MOVIE, [
      "AUDIO DESCRIPTION",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].audioDescription).toBe(true);
  });
});

/* =========================================================================
   Both CC + AD
   ========================================================================= */

describe("Accessibility — CC and AD together", () => {
  it("sets both closedCaption and audioDescription when both are in attributes list", () => {
    const html = makeShowtimeHtml("3001", "7:00", "pm", FORMAT, MOVIE, [
      "IMAX at AMC",
      "Closed Caption",
      "Audio Description",
      "Reserved Seating",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].closedCaption).toBe(true);
    expect(results[0].audioDescription).toBe(true);
  });
});

/* =========================================================================
   No accessibility attributes
   ========================================================================= */

describe("Accessibility — no accessibility attributes", () => {
  it("does not set any accessibility flag when attributes list has no CC/AD", () => {
    const html = makeShowtimeHtml("4001", "7:00", "pm", FORMAT, MOVIE, [
      "IMAX at AMC",
      "70mm",
      "AMC Club Rockers",
      "Reserved Seating",
    ]);
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].closedCaption).toBeUndefined();
    expect(results[0].audioDescription).toBeUndefined();
  });

  it("does not set any accessibility flag when aria-describedby has no -attributes token", () => {
    // Build anchor WITHOUT the -attributes token in aria-describedby
    const describedBy = `${MOVIE} ${MOVIE}-test-theater ${MOVIE}-test-theater-${FORMAT}`;
    const html = `<a href="/movies/${MOVIE}">Test Movie</a><a aria-describedby="${describedBy}" id="4002" href="/showtimes/4002">7:00<!-- -->pm</a>`;
    const results = extractFormatShowtimes(html, FORMAT);
    expect(results).toHaveLength(1);
    expect(results[0].closedCaption).toBeUndefined();
    expect(results[0].audioDescription).toBeUndefined();
  });
});

/* =========================================================================
   Multiple showtimes — per-showtime accuracy
   ========================================================================= */

describe("Accessibility — per-showtime accuracy across multiple showtimes", () => {
  it("correctly assigns CC only to the showtime that has it in its attributes list", () => {
    // Showtime A: has CC
    const htmlA = makeShowtimeHtml("5001", "7:00", "pm", FORMAT, MOVIE + "-a", [
      "Closed Caption",
    ], "test-theater-a");
    // Showtime B: no CC
    const htmlB = makeShowtimeHtml("5002", "9:00", "pm", FORMAT, MOVIE + "-b", [
      "IMAX at AMC",
    ], "test-theater-b");

    const resultsA = extractFormatShowtimes(htmlA, FORMAT);
    const resultsB = extractFormatShowtimes(htmlB, FORMAT);

    expect(resultsA[0].id).toBe("5001");
    expect(resultsA[0].closedCaption).toBe(true);

    expect(resultsB[0].id).toBe("5002");
    expect(resultsB[0].closedCaption).toBeUndefined();
  });
});

/* =========================================================================
   getAmenityBadge — wheelchair / ADA access
   ========================================================================= */

describe("Accessibility — getAmenityBadge wheelchair/ADA", () => {
  it("returns ♿ icon for 'Wheelchair accessible'", () => {
    const badge = getAmenityBadge("Wheelchair accessible");
    expect(badge.icon).toBe("♿");
    expect(badge.label).toBe("Wheelchair accessible");
    expect(badge.color).toBe("#38bdf8");
  });

  it("returns ♿ icon for 'ADA compliant' (ada keyword match)", () => {
    const badge = getAmenityBadge("ADA compliant");
    expect(badge.icon).toBe("♿");
  });

  it("returns ♿ icon for strings containing 'accessible' keyword", () => {
    const badge = getAmenityBadge("Fully accessible entrance");
    expect(badge.icon).toBe("♿");
  });
});

/* =========================================================================
   Wheelchair amenity in curated theater database
   ========================================================================= */

describe("Accessibility — all curated NYC theaters have wheelchair amenity", () => {
  it("every NYC theater in POPULAR_THEATERS has 'Wheelchair accessible' in its amenities list", () => {
    const nycTheaters = POPULAR_THEATERS["new-york-city"] ?? [];
    expect(nycTheaters.length).toBeGreaterThan(0);
    for (const theater of nycTheaters) {
      const hasWheelchair = theater.amenities.some((a) =>
        a.toLowerCase().includes("wheelchair")
      );
      expect(
        hasWheelchair,
        `Theater "${theater.name}" is missing 'Wheelchair accessible' amenity`
      ).toBe(true);
    }
  });
});
