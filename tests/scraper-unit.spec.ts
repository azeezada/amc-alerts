/**
 * Unit tests for scraper.ts pure functions.
 * These tests use mock HTML and never make network requests.
 * Run with: npx playwright test --config playwright.unit.config.ts
 */
import { test, expect } from "@playwright/test";
import { extractMovieSection } from "../lib/scraper";

// ---------------------------------------------------------------------------
// Helpers to build realistic mock AMC HTML fragments
// ---------------------------------------------------------------------------

function makeShowtimeAnchor(id: string, time: string, amPm: string, formatTag: string) {
  return `<a aria-describedby="${formatTag}-format" id="${id}" href="/showtimes/${id}">${time}<!-- -->${amPm.toLowerCase()}</a>`;
}

function makeMovieSection(movieSlug: string, movieTitle: string, showtimeHtml: string) {
  return `
    <section class="ShowtimesMovieSection">
      <h2><a href="/movies/${movieSlug}">${movieTitle}</a></h2>
      <div class="showtimes">
        ${showtimeHtml}
      </div>
    </section>`;
}

// A full mock page with two movies, each with distinct showtimes
const MOCK_PAGE_TWO_MOVIES = [
  makeMovieSection(
    "project-hail-mary-76779",
    "Project Hail Mary",
    [
      makeShowtimeAnchor("100", "7:00", "PM", "imax70mm"),
      makeShowtimeAnchor("101", "3:00", "PM", "imax70mm"),
      makeShowtimeAnchor("102", "10:00", "AM", "dolbycinema"),
    ].join("\n")
  ),
  makeMovieSection(
    "thunderbolts-99999",
    "Thunderbolts",
    [
      makeShowtimeAnchor("200", "6:00", "PM", "imax70mm"),
      makeShowtimeAnchor("201", "9:00", "PM", "imax70mm"),
      makeShowtimeAnchor("202", "1:00", "PM", "dolbycinema"),
    ].join("\n")
  ),
].join("\n");

// ---------------------------------------------------------------------------
// extractMovieSection tests
// ---------------------------------------------------------------------------

test.describe("extractMovieSection", () => {
  test("returns section containing only target movie links and showtimes", () => {
    const section = extractMovieSection(MOCK_PAGE_TWO_MOVIES, "project-hail-mary-76779");
    expect(section).not.toBeNull();

    // Contains target movie's showtime IDs
    expect(section!).toContain("/showtimes/100");
    expect(section!).toContain("/showtimes/101");
    expect(section!).toContain("/showtimes/102");

    // Does NOT contain the other movie's showtime IDs
    expect(section!).not.toContain("/showtimes/200");
    expect(section!).not.toContain("/showtimes/201");
    expect(section!).not.toContain("/showtimes/202");
  });

  test("returns section for the second movie when requested", () => {
    const section = extractMovieSection(MOCK_PAGE_TWO_MOVIES, "thunderbolts-99999");
    expect(section).not.toBeNull();

    // Contains second movie's showtime IDs
    expect(section!).toContain("/showtimes/200");
    expect(section!).toContain("/showtimes/201");

    // Does NOT contain first movie's showtimes
    expect(section!).not.toContain("/showtimes/100");
    expect(section!).not.toContain("/showtimes/101");
  });

  test("returns null when movie slug not present", () => {
    const section = extractMovieSection(MOCK_PAGE_TWO_MOVIES, "nonexistent-movie-00000");
    expect(section).toBeNull();
  });

  test("returns full content from start when only one movie on page", () => {
    const singleMoviePage = makeMovieSection(
      "project-hail-mary-76779",
      "Project Hail Mary",
      makeShowtimeAnchor("100", "7:00", "PM", "imax70mm")
    );
    const section = extractMovieSection(singleMoviePage, "project-hail-mary-76779");
    expect(section).not.toBeNull();
    expect(section!).toContain("/showtimes/100");
  });

  test("returns null on empty HTML", () => {
    expect(extractMovieSection("", "project-hail-mary-76779")).toBeNull();
  });

  test("handles page where target movie appears multiple times (navigation + showtime section)", () => {
    // Simulate a nav link appearing before the showtime section
    const pageWithNavLink = `
      <nav><a href="/movies/project-hail-mary-76779">Project Hail Mary</a></nav>
      ${makeMovieSection(
        "thunderbolts-99999",
        "Thunderbolts",
        makeShowtimeAnchor("200", "6:00", "PM", "imax70mm")
      )}
      ${makeMovieSection(
        "project-hail-mary-76779",
        "Project Hail Mary",
        makeShowtimeAnchor("100", "7:00", "PM", "imax70mm")
      )}
    `;

    const section = extractMovieSection(pageWithNavLink, "project-hail-mary-76779");
    // Should find the movie (first occurrence) and not include Thunderbolts' showtimes
    // The nav link occurrence comes before Thunderbolts, so sectionEnd = Thunderbolts position
    expect(section).not.toBeNull();
    expect(section!).not.toContain("/showtimes/200");
  });
});

// ---------------------------------------------------------------------------
// Integration: scoped extraction prevents cross-movie contamination
// ---------------------------------------------------------------------------

test.describe("movie-scoped showtime extraction (integration)", () => {
  test("three-movie page: each movie section is isolated", () => {
    const threeMoviePage = [
      makeMovieSection(
        "movie-a-11111",
        "Movie A",
        makeShowtimeAnchor("10", "1:00", "PM", "imax70mm")
      ),
      makeMovieSection(
        "movie-b-22222",
        "Movie B",
        makeShowtimeAnchor("20", "2:00", "PM", "imax70mm")
      ),
      makeMovieSection(
        "movie-c-33333",
        "Movie C",
        makeShowtimeAnchor("30", "3:00", "PM", "imax70mm")
      ),
    ].join("\n");

    const secA = extractMovieSection(threeMoviePage, "movie-a-11111");
    const secB = extractMovieSection(threeMoviePage, "movie-b-22222");
    const secC = extractMovieSection(threeMoviePage, "movie-c-33333");

    expect(secA).not.toBeNull();
    expect(secB).not.toBeNull();
    expect(secC).not.toBeNull();

    // Each section contains only its own showtimes
    expect(secA!).toContain("/showtimes/10");
    expect(secA!).not.toContain("/showtimes/20");
    expect(secA!).not.toContain("/showtimes/30");

    expect(secB!).toContain("/showtimes/20");
    expect(secB!).not.toContain("/showtimes/10");
    expect(secB!).not.toContain("/showtimes/30");

    expect(secC!).toContain("/showtimes/30");
    expect(secC!).not.toContain("/showtimes/10");
    expect(secC!).not.toContain("/showtimes/20");
  });
});
