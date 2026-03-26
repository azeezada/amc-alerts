/**
 * Layer 1: Unit Tests — Scraper Logic
 * Tests all scraper pure functions against real AMC HTML fixtures and synthetic HTML.
 * No network. Fast. Deterministic.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractFormatShowtimes,
  extractMovieSection,
  extractMoviesFromPage,
  toDateStr,
  generateDateRange,
  type Showtime,
} from "@/lib/scraper";

/* -------------------------------------------------------------------------
   Fixture helpers
   ------------------------------------------------------------------------- */

const FIXTURES_DIR = join(__dirname, "..", "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

const fixture0326 = loadFixture("amc-lincoln-square-2026-03-26.html");

/* -------------------------------------------------------------------------
   Synthetic HTML helpers — build realistic AMC-like HTML fragments
   ------------------------------------------------------------------------- */

function makeShowtimeAnchor(
  id: string,
  time: string,
  amPm: string,
  formatTag: string,
  movieSlug: string,
  theaterSlug = "amc-lincoln-square-13",
  srOnly = ""
): string {
  const describedBy = `${movieSlug} ${movieSlug}-${theaterSlug} ${movieSlug}-${theaterSlug}-${formatTag} ${movieSlug}-${theaterSlug}-${formatTag}-0 ${movieSlug}-${theaterSlug}-${formatTag}-0-attributes`;
  const srSpan = srOnly
    ? `<!-- --> <span class="sr-only">${srOnly}</span>`
    : "";
  return `<a aria-describedby="${describedBy}" id="${id}" href="/showtimes/${id}">${time}<!-- -->${amPm.toLowerCase()}${srSpan}</a>`;
}

function makeMovieSection(
  movieSlug: string,
  movieTitle: string,
  showtimeHtml: string
): string {
  return `
    <section class="ShowtimesMovieSection">
      <h2><a href="/movies/${movieSlug}">${movieTitle}</a></h2>
      <div class="showtimes">${showtimeHtml}</div>
    </section>`;
}

/* =========================================================================
   1.1 Movie-Scoped Parsing (THE core bug)
   ========================================================================= */

describe("1.1 Movie-Scoped Parsing", () => {
  // Build a synthetic page with TWO movies that both have imax70mm showtimes
  const syntheticPage = [
    makeMovieSection(
      "movie-alpha-11111",
      "Movie Alpha",
      [
        makeShowtimeAnchor("1001", "1:00", "PM", "imax70mm", "movie-alpha-11111"),
        makeShowtimeAnchor("1002", "4:00", "PM", "imax70mm", "movie-alpha-11111"),
      ].join("")
    ),
    makeMovieSection(
      "movie-beta-22222",
      "Movie Beta",
      [
        makeShowtimeAnchor("2001", "2:00", "PM", "imax70mm", "movie-beta-22222"),
        makeShowtimeAnchor("2002", "7:00", "PM", "imax70mm", "movie-beta-22222"),
      ].join("")
    ),
  ].join("");

  it("BUG: extractFormatShowtimes on full page returns ALL movies' showtimes", () => {
    const all = extractFormatShowtimes(syntheticPage, "imax70mm");
    // Without movie scoping, we get showtimes from BOTH movies
    const ids = all.map((s) => s.id);
    expect(ids).toContain("1001");
    expect(ids).toContain("1002");
    expect(ids).toContain("2001");
    expect(ids).toContain("2002");
    expect(all.length).toBe(4);
  });

  it("FIX: extractFormatShowtimes on movie-scoped section returns ONLY that movie's showtimes", () => {
    const sectionA = extractMovieSection(syntheticPage, "movie-alpha-11111");
    expect(sectionA).not.toBeNull();
    const alphaShowtimes = extractFormatShowtimes(sectionA!, "imax70mm");
    const alphaIds = alphaShowtimes.map((s) => s.id);
    expect(alphaIds).toEqual(["1001", "1002"]);

    const sectionB = extractMovieSection(syntheticPage, "movie-beta-22222");
    expect(sectionB).not.toBeNull();
    const betaShowtimes = extractFormatShowtimes(sectionB!, "imax70mm");
    const betaIds = betaShowtimes.map((s) => s.id);
    expect(betaIds).toEqual(["2001", "2002"]);
  });

  it("real fixture: extractMovieSection isolates Project Hail Mary from 11 other movies", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779");
    expect(section).not.toBeNull();

    const phm = extractFormatShowtimes(section!, "imax70mm");
    // PHM has exactly 4 IMAX 70mm showtimes on 2026-03-26
    expect(phm.length).toBe(4);
    const ids = phm.map((s) => s.id);
    expect(ids).toContain("140840248");
    expect(ids).toContain("140840247");
    expect(ids).toContain("140840246");
    expect(ids).toContain("140840249");
  });

  it("real fixture: other movies' showtimes do NOT leak into PHM section", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779");
    expect(section).not.toBeNull();

    // Ready or Not has showtime 141726481 — must NOT appear in PHM section
    expect(section!).not.toContain("141726481");
    // Hoppers has showtime 141726517 — must NOT appear
    expect(section!).not.toContain("141726517");
  });
});

/* =========================================================================
   1.2 Format Filtering
   ========================================================================= */

describe("1.2 Format Filtering", () => {
  const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;

  it("imax70mm returns only IMAX 70mm showtimes, not Dolby or standard", () => {
    const imax70mm = extractFormatShowtimes(section, "imax70mm");
    expect(imax70mm.length).toBe(4);
    // None of the Dolby IDs
    const ids = imax70mm.map((s) => s.id);
    expect(ids).not.toContain("140846596"); // Dolby 10:00 AM
    expect(ids).not.toContain("140846595"); // Dolby 2:00 PM
  });

  it("dolbycinema returns only Dolby Cinema showtimes, not IMAX 70mm", () => {
    const dolby = extractFormatShowtimes(section, "dolbycinema");
    expect(dolby.length).toBe(4);
    const ids = dolby.map((s) => s.id);
    expect(ids).toContain("140846596");
    expect(ids).toContain("140846595");
    expect(ids).toContain("140846594");
    expect(ids).toContain("141797405");
    // None of the IMAX 70mm IDs
    expect(ids).not.toContain("140840248");
    expect(ids).not.toContain("140840247");
  });

  it("imax (standard) excludes imax70mm showtimes", () => {
    // Build synthetic HTML with both imax70mm and plain imax
    const html = [
      makeShowtimeAnchor("9001", "1:00", "PM", "imax70mm", "test-movie-00001"),
      makeShowtimeAnchor("9002", "3:00", "PM", "imax", "test-movie-00001"),
    ].join("");

    const imax = extractFormatShowtimes(html, "imax");
    expect(imax.length).toBe(1);
    expect(imax[0].id).toBe("9002");

    const imax70 = extractFormatShowtimes(html, "imax70mm");
    expect(imax70.length).toBe(1);
    expect(imax70[0].id).toBe("9001");
  });

  it("no cross-contamination between three format types", () => {
    const html = [
      makeShowtimeAnchor("8001", "10:00", "AM", "imax70mm", "test-00001"),
      makeShowtimeAnchor("8002", "1:00", "PM", "dolbycinemaatamcprime", "test-00001"),
      makeShowtimeAnchor("8003", "4:00", "PM", "imax", "test-00001"),
    ].join("");

    const imax70 = extractFormatShowtimes(html, "imax70mm");
    const dolby = extractFormatShowtimes(html, "dolbycinema");
    const imax = extractFormatShowtimes(html, "imax");

    expect(imax70.map((s) => s.id)).toEqual(["8001"]);
    expect(dolby.map((s) => s.id)).toEqual(["8002"]);
    expect(imax.map((s) => s.id)).toEqual(["8003"]);
  });
});

/* =========================================================================
   1.3 Showtime ID → URL Integrity
   ========================================================================= */

describe("1.3 Showtime ID → URL Integrity", () => {
  const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;
  const showtimes = extractFormatShowtimes(section, "imax70mm");

  it("every URL matches the pattern https://www.amctheatres.com/showtimes/{id}", () => {
    for (const st of showtimes) {
      expect(st.url).toBe(`https://www.amctheatres.com/showtimes/${st.id}`);
    }
  });

  it("every ID is numeric", () => {
    for (const st of showtimes) {
      expect(st.id).toMatch(/^\d+$/);
    }
  });

  it("no duplicate IDs across all formats for the same movie section", () => {
    const allIds = new Set<string>();
    for (const format of ["imax70mm", "dolbycinema"]) {
      const sts = extractFormatShowtimes(section, format);
      for (const st of sts) {
        expect(allIds.has(st.id)).toBe(false);
        allIds.add(st.id);
      }
    }
  });

  it("no duplicate IDs within full page extraction", () => {
    const allShowtimes = extractFormatShowtimes(fixture0326, "imax70mm");
    const ids = allShowtimes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* =========================================================================
   1.4 Movie Extraction (extractMoviesFromPage)
   ========================================================================= */

describe("1.4 Movie Extraction", () => {
  it("real fixture: extracts correct number of unique movies", () => {
    const movies = extractMoviesFromPage(fixture0326);
    // Manifest says 12 movies
    expect(movies.length).toBe(12);
  });

  it("no duplicate slugs", () => {
    const movies = extractMoviesFromPage(fixture0326);
    const slugs = movies.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every movie has non-empty slug and title", () => {
    const movies = extractMoviesFromPage(fixture0326);
    for (const m of movies) {
      expect(m.slug.length).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("Project Hail Mary detected with imax70mm format", () => {
    const movies = extractMoviesFromPage(fixture0326);
    const phm = movies.find((m) => m.slug === "project-hail-mary-76779");
    expect(phm).toBeDefined();
    expect(phm!.formats).toContain("imax70mm");
  });

  it("format detection is per-movie, not page-wide", () => {
    const movies = extractMoviesFromPage(fixture0326);
    // Ready or Not should NOT have imax70mm (it only has laseratamc)
    const readyOrNot = movies.find(
      (m) => m.slug === "ready-or-not-2-here-i-come-80592"
    );
    expect(readyOrNot).toBeDefined();
    expect(readyOrNot!.formats).not.toContain("imax70mm");
  });
});

/* =========================================================================
   1.5 Status Detection
   ========================================================================= */

describe("1.5 Status Detection", () => {
  it("detects AlmostFull from real fixture (PHM IMAX 70mm)", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;
    const showtimes = extractFormatShowtimes(section, "imax70mm");
    // All 4 IMAX 70mm PHM showtimes are AlmostFull on 2026-03-26
    const almostFull = showtimes.filter((s) => s.status === "AlmostFull");
    expect(almostFull.length).toBeGreaterThan(0);
  });

  it("detects Sellable from real fixture (PHM Dolby)", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;
    const dolby = extractFormatShowtimes(section, "dolbycinema");
    const sellable = dolby.filter((s) => s.status === "Sellable");
    expect(sellable.length).toBeGreaterThan(0);
  });

  it("detects SoldOut from synthetic HTML", () => {
    const html = makeShowtimeAnchor(
      "5001",
      "7:00",
      "PM",
      "imax70mm",
      "test-00001",
      "amc-lincoln-square-13",
      "Sold Out"
    );
    const showtimes = extractFormatShowtimes(html, "imax70mm");
    expect(showtimes.length).toBe(1);
    expect(showtimes[0].status).toBe("SoldOut");
  });

  it("detects AlmostFull from synthetic HTML", () => {
    const html = makeShowtimeAnchor(
      "5002",
      "8:00",
      "PM",
      "imax70mm",
      "test-00001",
      "amc-lincoln-square-13",
      "Almost Full"
    );
    const showtimes = extractFormatShowtimes(html, "imax70mm");
    expect(showtimes[0].status).toBe("AlmostFull");
  });

  it("defaults to Sellable when no sr-only status span", () => {
    const html = makeShowtimeAnchor(
      "5003",
      "9:00",
      "PM",
      "imax70mm",
      "test-00001"
    );
    const showtimes = extractFormatShowtimes(html, "imax70mm");
    expect(showtimes[0].status).toBe("Sellable");
  });

  it("no empty or undefined status in real fixture", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;
    for (const format of ["imax70mm", "dolbycinema"]) {
      const showtimes = extractFormatShowtimes(section, format);
      for (const st of showtimes) {
        expect(st.status).toBeDefined();
        expect(st.status.length).toBeGreaterThan(0);
        expect(["Sellable", "AlmostFull", "SoldOut"]).toContain(st.status);
      }
    }
  });
});

/* =========================================================================
   1.6 Time Sorting
   ========================================================================= */

describe("1.6 Time Sorting", () => {
  it("sorts showtimes chronologically (AM before PM)", () => {
    const html = [
      makeShowtimeAnchor("6001", "7:00", "PM", "imax70mm", "test-00001"),
      makeShowtimeAnchor("6002", "10:30", "AM", "imax70mm", "test-00001"),
      makeShowtimeAnchor("6003", "1:15", "PM", "imax70mm", "test-00001"),
      makeShowtimeAnchor("6004", "12:00", "AM", "imax70mm", "test-00001"),
    ].join("");

    const showtimes = extractFormatShowtimes(html, "imax70mm");
    const times = showtimes.map((s) => `${s.time} ${s.amPm}`);
    expect(times).toEqual(["12:00 AM", "10:30 AM", "1:15 PM", "7:00 PM"]);
  });

  it("handles 12:00 PM (noon) correctly", () => {
    const html = [
      makeShowtimeAnchor("6010", "12:00", "PM", "imax70mm", "test-00001"),
      makeShowtimeAnchor("6011", "11:00", "AM", "imax70mm", "test-00001"),
      makeShowtimeAnchor("6012", "1:00", "PM", "imax70mm", "test-00001"),
    ].join("");

    const showtimes = extractFormatShowtimes(html, "imax70mm");
    const times = showtimes.map((s) => `${s.time} ${s.amPm}`);
    expect(times).toEqual(["11:00 AM", "12:00 PM", "1:00 PM"]);
  });

  it("real fixture IMAX 70mm showtimes are sorted", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;
    const showtimes = extractFormatShowtimes(section, "imax70mm");
    const times = showtimes.map((s) => `${s.time} ${s.amPm}`);
    // 11:00 AM < 3:00 PM < 7:00 PM < 10:45 PM
    expect(times).toEqual(["11:00 AM", "3:00 PM", "7:00 PM", "10:45 PM"]);
  });
});

/* =========================================================================
   1.7 checkDate Movie Filtering
   ========================================================================= */

describe("1.7 Movie Filtering via extractMovieSection", () => {
  it("nonexistent movie returns null", () => {
    const section = extractMovieSection(fixture0326, "nonexistent-movie-12345");
    expect(section).toBeNull();
  });

  it("real movie slug returns section with only that movie's content", () => {
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779");
    expect(section).not.toBeNull();
    // Section should contain PHM's links
    expect(section!).toContain("project-hail-mary-76779");
    // Should NOT contain other movies
    expect(section!).not.toContain('href="/movies/ready-or-not-2-here-i-come-80592"');
    expect(section!).not.toContain('href="/movies/hoppers-72462"');
  });

  it("each of the 12 movies can be isolated", () => {
    const movies = extractMoviesFromPage(fixture0326);
    for (const movie of movies) {
      const section = extractMovieSection(fixture0326, movie.slug);
      expect(section).not.toBeNull();
      expect(section!).toContain(movie.slug);
    }
  });
});

/* =========================================================================
   1.8 Edge Cases
   ========================================================================= */

describe("1.8 Edge Cases", () => {
  it("empty HTML → empty results, no crash", () => {
    expect(extractFormatShowtimes("", "imax70mm")).toEqual([]);
    expect(extractMovieSection("", "any-movie")).toBeNull();
    expect(extractMoviesFromPage("")).toEqual([]);
  });

  it("HTML with no showtimes → empty array", () => {
    const html = "<html><body><p>No showtimes today</p></body></html>";
    expect(extractFormatShowtimes(html, "imax70mm")).toEqual([]);
  });

  it("malformed HTML (unclosed tags) → graceful degradation", () => {
    const html = `<a aria-describedby="x-imax70mm" id="999" href="/showtimes/999">7:00<!-- -->pm`;
    // Should still match even without closing </a>
    const result = extractFormatShowtimes(html, "imax70mm");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("999");
  });

  it("movie slug in unrelated context (ad, sidebar) → handled by extractMovieSection", () => {
    // If the slug appears in a nav link before other movies, section boundaries
    // are still determined by movie links, not arbitrary text
    const page = `
      <nav><a href="/movies/target-movie-00001">Target</a></nav>
      ${makeMovieSection("other-movie-00002", "Other", makeShowtimeAnchor("3001", "5:00", "PM", "imax70mm", "other-movie-00002"))}
      ${makeMovieSection("target-movie-00001", "Target", makeShowtimeAnchor("3002", "6:00", "PM", "imax70mm", "target-movie-00001"))}
    `;
    const section = extractMovieSection(page, "target-movie-00001");
    expect(section).not.toBeNull();
    // The first occurrence (nav) starts the section; it ends at "other-movie"
    // So the section should NOT contain other-movie's showtime
    expect(section!).not.toContain("3001");
  });

  it("HTML with zero format matches → empty results", () => {
    const html = makeMovieSection(
      "test-movie-00001",
      "Test",
      makeShowtimeAnchor("7001", "1:00", "PM", "laseratamc", "test-movie-00001")
    );
    // Searching for imax70mm in a page that only has laseratamc
    expect(extractFormatShowtimes(html, "imax70mm")).toEqual([]);
  });
});

/* =========================================================================
   1.9 Timezone Date Handling
   ========================================================================= */

describe("1.9 Timezone Date Handling", () => {
  it("toDateStr uses local date, not UTC", () => {
    // Simulate 11:30 PM EST on March 26, 2026
    // EST = UTC-5, so 11:30 PM EST = 4:30 AM UTC March 27
    // The old bug: toISOString() would return "2026-03-27T04:30:00.000Z"
    // and split("T")[0] would give "2026-03-27" — WRONG for EST
    const date = new Date(2026, 2, 26, 23, 30, 0); // March 26 at 11:30 PM local
    const result = toDateStr(date);
    expect(result).toBe("2026-03-26");
  });

  it("toDateStr formats with zero-padding", () => {
    const date = new Date(2026, 0, 5); // January 5
    expect(toDateStr(date)).toBe("2026-01-05");
  });

  it("generateDateRange returns exact range, inclusive", () => {
    const result = generateDateRange("2026-04-01", "2026-04-03");
    expect(result).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
  });

  it("generateDateRange single day", () => {
    const result = generateDateRange("2026-04-01", "2026-04-01");
    expect(result).toEqual(["2026-04-01"]);
  });

  it("generateDateRange empty when start > end", () => {
    const result = generateDateRange("2026-04-03", "2026-04-01");
    expect(result).toEqual([]);
  });

  it("generateDateRange crosses month boundary correctly", () => {
    const result = generateDateRange("2026-03-30", "2026-04-02");
    expect(result).toEqual(["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02"]);
  });
});

/* =========================================================================
   Additional: Real fixture cross-validation
   ========================================================================= */

describe("Real fixture cross-validation", () => {
  it("total showtimes on page matches manifest (40)", () => {
    // Extract all showtimes from the full page (all formats)
    // Include "70mm" — PHM has a standalone 70mm format (not imax70mm)
    const allFormats = [
      "imax70mm",
      "dolbycinema",
      "laseratamc",
      "opencaption",
      "fanfaves",
      "frenchenglishsubtitle",
      "70mm",
    ];
    const allIds = new Set<string>();
    for (const format of allFormats) {
      const sts = extractFormatShowtimes(fixture0326, format);
      for (const st of sts) allIds.add(st.id);
    }
    expect(allIds.size).toBe(40);
  });

  it("extractMovieSection + extractFormatShowtimes count matches per-movie expectations", () => {
    // PHM: 4 imax70mm + 4 dolbycinema = 8 (+ 3 from 70mm format which is separate)
    const section = extractMovieSection(fixture0326, "project-hail-mary-76779")!;
    const imax70 = extractFormatShowtimes(section, "imax70mm");
    const dolby = extractFormatShowtimes(section, "dolbycinema");
    expect(imax70.length).toBe(4);
    expect(dolby.length).toBe(4);
  });
});
