/**
 * Layer 2: Integration Tests — Movies Accuracy
 *
 * Tests that extractMoviesFromPage returns correct, deduplicated movies
 * from real AMC HTML fixtures.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractMoviesFromPage } from "@/lib/scraper";

const FIXTURES_DIR = join(__dirname, "..", "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf8");
}

const fixture0326 = loadFixture("amc-lincoln-square-2026-03-26.html");

describe("2.7 Movies Accuracy", () => {
  it("returns at least one movie from fixture", () => {
    const movies = extractMoviesFromPage(fixture0326);
    expect(movies.length).toBeGreaterThan(0);
  });

  it("every movie has non-empty slug and title", () => {
    const movies = extractMoviesFromPage(fixture0326);
    for (const movie of movies) {
      expect(movie.slug).toBeTruthy();
      expect(movie.slug.length).toBeGreaterThan(0);
      expect(movie.title).toBeTruthy();
      expect(movie.title.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("no duplicate movie slugs", () => {
    const movies = extractMoviesFromPage(fixture0326);
    const slugs = movies.map((m) => m.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it("movie slugs match URL-safe pattern", () => {
    const movies = extractMoviesFromPage(fixture0326);
    for (const movie of movies) {
      expect(movie.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("each movie has at least one format", () => {
    const movies = extractMoviesFromPage(fixture0326);
    for (const movie of movies) {
      expect(movie.formats.length).toBeGreaterThan(0);
    }
  });

  it("returns empty array for empty HTML", () => {
    const movies = extractMoviesFromPage("");
    expect(movies).toHaveLength(0);
  });

  it("returns empty array for HTML with no movie links", () => {
    const movies = extractMoviesFromPage("<html><body><p>No movies here</p></body></html>");
    expect(movies).toHaveLength(0);
  });

  it("handles HTML with a single movie correctly", () => {
    const singleMovieHtml = `
      <div>
        <a href="/movies/project-hail-mary-76779">Project Hail Mary</a>
        <a aria-describedby="project-hail-mary-76779 project-hail-mary-76779-imax" id="140840248" href="/showtimes/140840248">7:00pm</a>
      </div>
    `;
    const movies = extractMoviesFromPage(singleMovieHtml);
    expect(movies).toHaveLength(1);
    expect(movies[0].slug).toBe("project-hail-mary-76779");
    expect(movies[0].title).toBe("Project Hail Mary");
  });
});
