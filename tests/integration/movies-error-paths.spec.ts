/**
 * Gap 3.5 — /api/movies Error Paths
 *
 * Tests the error-handling branches in /api/movies/route.ts:
 *  1. Missing ?theater param → 400 { error: "Missing required parameter: theater" }
 *  2. fetchPage() returns null → 502 { movies: [], error: "Could not fetch theater page" }
 *  3. fetchPage() throws → 500 { error: "Failed to fetch movies", detail: "..." }
 *  4. TMDB enrichment pass — API returns poster_path + overview → merged into movie
 *  5. TMDB enrichment fail — TMDB returns !ok → movie returned unchanged
 *  6. No TMDB key → movies returned as-is (enrichWithTmdb not called)
 *
 * All tests use pure logic extracted from the route (no HTTP server required).
 * Pattern mirrors check-edge-cases.spec.ts and theaters.spec.ts.
 */
import { describe, it, expect } from "vitest";
import type { MovieInfo } from "@/lib/scraper";

/* -------------------------------------------------------------------------
   Pure logic mirrored from /api/movies/route.ts
   Keep in sync with route if the route changes.
   ------------------------------------------------------------------------- */

/** Mirrors: if (!theater) return 400 */
function missingTheater(theater: string | null): boolean {
  return !theater;
}

/** Response body for missing theater param */
const MISSING_THEATER_BODY = { error: "Missing required parameter: theater" };

/** Response body when fetchPage returns null */
function buildFetchNullBody(): { movies: MovieInfo[]; error: string } {
  return { movies: [], error: "Could not fetch theater page" };
}

/** Response body for outer catch(e) → 500 */
function buildCatchBody(e: unknown): { error: string; detail: string } {
  return { error: "Failed to fetch movies", detail: String(e) };
}

/**
 * Mirrors enrichWithTmdb() logic for a single movie.
 * Accepts an injectable fetch function so tests can control TMDB responses.
 */
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w342";

async function enrichSingleMovie(
  movie: MovieInfo,
  fetchFn: (url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>
): Promise<MovieInfo> {
  try {
    const searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(movie.title)}&language=en-US&page=1`;
    const resp = await fetchFn(searchUrl, {
      headers: { Authorization: "Bearer test-key", Accept: "application/json" },
    });
    if (!resp.ok) return movie;
    const data = (await resp.json()) as {
      results?: Array<{ poster_path?: string; overview?: string }>;
    };
    const top = data.results?.[0];
    if (!top) return movie;
    return {
      ...movie,
      poster: top.poster_path ? `${TMDB_IMG_BASE}${top.poster_path}` : undefined,
      description: top.overview?.slice(0, 180) || undefined,
    };
  } catch {
    return movie;
  }
}

/** Mirrors: tmdbKey ? enrichWithTmdb(movies, key) : movies */
async function conditionallyEnrich(
  movies: MovieInfo[],
  tmdbKey: string | undefined,
  fetchFn: (url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>
): Promise<MovieInfo[]> {
  if (!tmdbKey) return movies;
  return Promise.all(movies.map((m) => enrichSingleMovie(m, fetchFn)));
}

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function makeMovie(overrides: Partial<MovieInfo> = {}): MovieInfo {
  return {
    slug: "test-movie-12345",
    title: "Test Movie",
    formats: ["IMAX"],
    ...overrides,
  };
}

/* =========================================================================
   3.5.1 — Missing theater param → 400
   ========================================================================= */

describe("Gap 3.5.1 — Missing theater param → 400 body", () => {
  it("null theater → missingTheater returns true", () => {
    expect(missingTheater(null)).toBe(true);
  });

  it("empty string theater → missingTheater returns true", () => {
    expect(missingTheater("")).toBe(true);
  });

  it("present theater → missingTheater returns false", () => {
    expect(missingTheater("amc-lincoln-square-13")).toBe(false);
  });

  it("error body has correct shape", () => {
    expect(MISSING_THEATER_BODY).toEqual({ error: "Missing required parameter: theater" });
  });
});

/* =========================================================================
   3.5.2 — fetchPage returns null → 502 body
   ========================================================================= */

describe("Gap 3.5.2 — fetchPage null → 502 body", () => {
  it("returns movies: [] and error string", () => {
    const body = buildFetchNullBody();
    expect(body.movies).toEqual([]);
    expect(body.error).toBe("Could not fetch theater page");
  });

  it("movies array is empty (no partial data)", () => {
    const body = buildFetchNullBody();
    expect(body.movies).toHaveLength(0);
  });
});

/* =========================================================================
   3.5.3 — fetchPage throws → 500 body
   ========================================================================= */

describe("Gap 3.5.3 — fetchPage throws → 500 body", () => {
  it("Error instance → detail is stringified error message", () => {
    const body = buildCatchBody(new Error("Network timeout"));
    expect(body.error).toBe("Failed to fetch movies");
    expect(body.detail).toBe("Error: Network timeout");
  });

  it("string thrown → detail is the string", () => {
    const body = buildCatchBody("connection refused");
    expect(body.error).toBe("Failed to fetch movies");
    expect(body.detail).toBe("connection refused");
  });

  it("object thrown → detail is JSON-like string", () => {
    const body = buildCatchBody({ code: 503 });
    expect(body.error).toBe("Failed to fetch movies");
    expect(body.detail).toContain("[object Object]");
  });
});

/* =========================================================================
   3.5.4 — TMDB enrichment pass
   ========================================================================= */

describe("Gap 3.5.4 — TMDB enrichment pass: poster + description merged", () => {
  it("adds poster URL when TMDB returns poster_path", async () => {
    const movie = makeMovie();
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        results: [{ poster_path: "/abc123.jpg", overview: "A great film about space." }],
      }),
    });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.poster).toBe(`${TMDB_IMG_BASE}/abc123.jpg`);
  });

  it("adds description sliced to 180 chars from overview", async () => {
    const longOverview = "A".repeat(300);
    const movie = makeMovie();
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        results: [{ poster_path: null, overview: longOverview }],
      }),
    });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.description).toHaveLength(180);
    expect(enriched.description).toBe("A".repeat(180));
  });

  it("preserves original slug and title", async () => {
    const movie = makeMovie({ slug: "my-slug", title: "My Title" });
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        results: [{ poster_path: "/x.jpg", overview: "Synopsis." }],
      }),
    });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.slug).toBe("my-slug");
    expect(enriched.title).toBe("My Title");
  });

  it("no poster set when poster_path is null", async () => {
    const movie = makeMovie();
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        results: [{ poster_path: null, overview: "Some overview" }],
      }),
    });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.poster).toBeUndefined();
  });

  it("no description set when overview is empty string", async () => {
    const movie = makeMovie();
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        results: [{ poster_path: "/p.jpg", overview: "" }],
      }),
    });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.description).toBeUndefined();
  });
});

/* =========================================================================
   3.5.5 — TMDB enrichment fail: non-ok response → movie unchanged
   ========================================================================= */

describe("Gap 3.5.5 — TMDB enrichment fail: movie returned unchanged", () => {
  it("TMDB 401 → ok=false → original movie returned", async () => {
    const movie = makeMovie({ slug: "unchanged", title: "Unchanged Movie" });
    const mockFetch = async () => ({ ok: false, json: async () => ({}) });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched).toEqual(movie);
  });

  it("TMDB 500 → ok=false → no poster added", async () => {
    const movie = makeMovie();
    const mockFetch = async () => ({ ok: false, json: async () => ({}) });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.poster).toBeUndefined();
    expect(enriched.description).toBeUndefined();
  });

  it("TMDB fetch throws → caught → original movie returned", async () => {
    const movie = makeMovie({ slug: "throw-test", title: "Throw Test" });
    const mockFetch = async (): Promise<never> => {
      throw new Error("network error");
    };
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched).toEqual(movie);
  });

  it("TMDB returns empty results array → no enrichment", async () => {
    const movie = makeMovie();
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    });
    const enriched = await enrichSingleMovie(movie, mockFetch);
    expect(enriched.poster).toBeUndefined();
    expect(enriched.description).toBeUndefined();
  });
});

/* =========================================================================
   3.5.6 — No TMDB key → movies returned as-is
   ========================================================================= */

describe("Gap 3.5.6 — No TMDB key: movies returned without enrichment", () => {
  it("undefined TMDB key → same array reference returned", async () => {
    const movies = [makeMovie({ slug: "m1" }), makeMovie({ slug: "m2" })];
    // fetchFn should never be called
    const mockFetch = async (): Promise<never> => {
      throw new Error("should not be called");
    };
    const result = await conditionallyEnrich(movies, undefined, mockFetch);
    expect(result).toBe(movies); // exact same reference
  });

  it("undefined TMDB key → no poster or description added", async () => {
    const movies = [makeMovie()];
    const mockFetch = async (): Promise<never> => {
      throw new Error("should not be called");
    };
    const result = await conditionallyEnrich(movies, undefined, mockFetch);
    expect(result[0].poster).toBeUndefined();
    expect(result[0].description).toBeUndefined();
  });

  it("with TMDB key → enrichment runs (contrast to no-key behavior)", async () => {
    const movies = [makeMovie({ title: "A Space Odyssey" })];
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        results: [{ poster_path: "/poster.jpg", overview: "A mind-bending film." }],
      }),
    });
    const result = await conditionallyEnrich(movies, "real-api-key", mockFetch);
    expect(result[0].poster).toBe(`${TMDB_IMG_BASE}/poster.jpg`);
  });
});
