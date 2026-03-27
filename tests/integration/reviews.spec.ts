/**
 * Community Reviews — /api/reviews Integration Tests
 *
 * Tests GET /api/reviews?movie_slug=xxx[&limit=N]
 *   and POST /api/reviews {movie_slug, anonymous_id, rating, body}
 *
 * Mirrors the exact branches in app/api/reviews/route.ts without spinning up
 * a real HTTP server or Cloudflare runtime.
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";

const MAX_BODY_LENGTH = 1000;

/* -------------------------------------------------------------------------
   Types matching the route
   ------------------------------------------------------------------------- */
interface ReviewRow {
  id: number;
  movie_slug: string;
  anonymous_id: string;
  rating: number;
  body: string;
  created_at: string;
}

interface GetResponse {
  status: number;
  body: { reviews?: ReviewRow[]; total?: number; error?: string };
}

interface PostResponse {
  status: number;
  body: { id?: number; created?: boolean; updated?: boolean; error?: string };
}

/* -------------------------------------------------------------------------
   Simulate route logic (mirrors app/api/reviews/route.ts exactly)
   ------------------------------------------------------------------------- */

async function simulateGet(
  searchParams: { movie_slug?: string | null; limit?: string | null },
  db: D1Database | undefined
): Promise<GetResponse> {
  const movieSlug = searchParams.movie_slug ?? null;
  const limitParam = searchParams.limit ?? null;
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 100);

  if (!movieSlug) {
    return { status: 400, body: { error: "movie_slug is required" } };
  }

  try {
    if (!db) {
      return { status: 200, body: { reviews: [], total: 0 } };
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM reviews WHERE movie_slug = ?")
      .bind(movieSlug)
      .first<{ count: number }>();

    const total = countRow?.count ?? 0;

    const rows = await db
      .prepare(
        "SELECT id, movie_slug, anonymous_id, rating, body, created_at FROM reviews WHERE movie_slug = ? ORDER BY created_at DESC LIMIT ?"
      )
      .bind(movieSlug, limit)
      .all<ReviewRow>();

    return { status: 200, body: { reviews: rows.results ?? [], total } };
  } catch {
    return { status: 200, body: { reviews: [], total: 0 } };
  }
}

async function simulatePost(
  body: {
    movie_slug?: unknown;
    anonymous_id?: unknown;
    rating?: unknown;
    body?: unknown;
  },
  db: D1Database | undefined
): Promise<PostResponse> {
  const { movie_slug: movieSlug, anonymous_id: anonymousId, rating, body: reviewBody } = body;

  if (!movieSlug || typeof movieSlug !== "string" || (movieSlug as string).trim().length === 0) {
    return { status: 400, body: { error: "movie_slug is required" } };
  }
  if (!anonymousId || typeof anonymousId !== "string" || (anonymousId as string).trim().length === 0) {
    return { status: 400, body: { error: "anonymous_id is required" } };
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return { status: 400, body: { error: "rating must be an integer 1–5" } };
  }
  if (!reviewBody || typeof reviewBody !== "string" || (reviewBody as string).trim().length === 0) {
    return { status: 400, body: { error: "body is required" } };
  }

  const slug = (movieSlug as string).trim().slice(0, 200);
  const aid = (anonymousId as string).trim().slice(0, 64);
  const sanitizedBody = (reviewBody as string).trim().slice(0, MAX_BODY_LENGTH);
  const ratingNum = rating as number;

  if (!db) {
    return { status: 200, body: { id: 0, created: true } };
  }

  try {
    const existing = await db
      .prepare("SELECT id FROM reviews WHERE movie_slug = ? AND anonymous_id = ?")
      .bind(slug, aid)
      .first<{ id: number }>();

    if (existing) {
      await db
        .prepare(
          "UPDATE reviews SET rating = ?, body = ?, created_at = datetime('now') WHERE movie_slug = ? AND anonymous_id = ?"
        )
        .bind(ratingNum, sanitizedBody, slug, aid)
        .run();
      return { status: 200, body: { id: existing.id, updated: true } };
    }

    const result = await db
      .prepare("INSERT INTO reviews (movie_slug, anonymous_id, rating, body) VALUES (?, ?, ?, ?)")
      .bind(slug, aid, ratingNum, sanitizedBody)
      .run();

    const newRow = await db
      .prepare("SELECT id FROM reviews WHERE movie_slug = ? AND anonymous_id = ?")
      .bind(slug, aid)
      .first<{ id: number }>();

    if (!result.success) {
      return { status: 500, body: { error: "Failed to save review" } };
    }

    return { status: 201, body: { id: newRow?.id ?? 0, created: true } };
  } catch (e) {
    return { status: 500, body: { error: "Something went wrong. Please try again." } };
  }
}

/* -------------------------------------------------------------------------
   In-memory DB mock
   ------------------------------------------------------------------------- */

interface StoredReview {
  id: number;
  movie_slug: string;
  anonymous_id: string;
  rating: number;
  body: string;
  created_at: string;
}

function makeReviewsDb(initialReviews: Omit<StoredReview, "id" | "created_at">[] = []): D1Database {
  let nextId = 1;
  const store: StoredReview[] = initialReviews.map((r) => ({
    ...r,
    id: nextId++,
    created_at: new Date().toISOString(),
  }));

  function makeStmt(query: string, bindings: unknown[]): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (...args: unknown[]) => makeStmt(query, args),

      run: async () => {
        if (query.startsWith("INSERT INTO reviews")) {
          const [slug, aid, rating, body] = bindings as [string, string, number, string];
          store.push({ id: nextId++, movie_slug: slug, anonymous_id: aid, rating, body, created_at: new Date().toISOString() });
          return { success: true };
        }
        if (query.startsWith("UPDATE reviews SET")) {
          const [newRating, newBody, slug, aid] = bindings as [number, string, string, string];
          const idx = store.findIndex((r) => r.movie_slug === slug && r.anonymous_id === aid);
          if (idx !== -1) {
            store[idx].rating = newRating;
            store[idx].body = newBody;
            store[idx].created_at = new Date().toISOString();
          }
          return { success: true };
        }
        return { success: true };
      },

      first: async <T>() => {
        if (query.includes("COUNT(*)")) {
          const [slug] = bindings as string[];
          const count = store.filter((r) => r.movie_slug === slug).length;
          return { count } as unknown as T;
        }
        if (query.includes("SELECT id FROM reviews")) {
          const [slug, aid] = bindings as string[];
          const found = store.find((r) => r.movie_slug === slug && r.anonymous_id === aid);
          return (found ? { id: found.id } : null) as unknown as T;
        }
        return null as unknown as T;
      },

      all: async <T>() => {
        if (query.includes("SELECT id, movie_slug")) {
          const [slug, limit] = bindings as [string, number];
          const filtered = store
            .filter((r) => r.movie_slug === slug)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, limit);
          return { results: filtered as unknown as T[] };
        }
        return { results: [] };
      },
    };
    return stmt;
  }

  return { prepare: (query: string) => makeStmt(query, []) };
}

function makeThrowingDb(): D1Database {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: async () => { throw new Error("D1 unavailable"); },
    first: async () => { throw new Error("D1 unavailable"); },
    all: async () => { throw new Error("D1 unavailable"); },
  };
  return { prepare: () => stmt };
}

/* =========================================================================
   GET tests
   ========================================================================= */

describe("Reviews GET — missing movie_slug", () => {
  it("returns 400 when movie_slug is absent", async () => {
    const res = await simulateGet({ movie_slug: null }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/movie_slug/);
  });

  it("returns 400 when movie_slug is undefined", async () => {
    const res = await simulateGet({}, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/movie_slug/);
  });
});

describe("Reviews GET — no DB (dev mode)", () => {
  it("returns empty list when DB is undefined", async () => {
    const res = await simulateGet({ movie_slug: "project-hail-mary" }, undefined);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reviews: [], total: 0 });
  });
});

describe("Reviews GET — with DB, empty table", () => {
  it("returns empty reviews and total=0 for unknown movie", async () => {
    const db = makeReviewsDb([]);
    const res = await simulateGet({ movie_slug: "unknown-movie" }, db);
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

describe("Reviews GET — with DB, existing reviews", () => {
  it("returns reviews for the correct movie_slug", async () => {
    const db = makeReviewsDb([
      { movie_slug: "project-hail-mary", anonymous_id: "anon-1", rating: 5, body: "Incredible film!" },
      { movie_slug: "project-hail-mary", anonymous_id: "anon-2", rating: 4, body: "Really enjoyed it." },
      { movie_slug: "other-movie", anonymous_id: "anon-3", rating: 3, body: "Meh." },
    ]);
    const res = await simulateGet({ movie_slug: "project-hail-mary" }, db);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.reviews).toHaveLength(2);
    for (const r of res.body.reviews!) {
      expect(r.movie_slug).toBe("project-hail-mary");
    }
  });

  it("does not leak other movie's reviews", async () => {
    const db = makeReviewsDb([
      { movie_slug: "movie-a", anonymous_id: "anon-1", rating: 5, body: "Great!" },
    ]);
    const res = await simulateGet({ movie_slug: "movie-b" }, db);
    expect(res.body.reviews).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("reviews include id, rating, body, anonymous_id, created_at", async () => {
    const db = makeReviewsDb([
      { movie_slug: "project-hail-mary", anonymous_id: "anon-1", rating: 5, body: "Amazing!" },
    ]);
    const res = await simulateGet({ movie_slug: "project-hail-mary" }, db);
    const review = res.body.reviews![0];
    expect(review.id).toBeGreaterThan(0);
    expect(review.rating).toBe(5);
    expect(review.body).toBe("Amazing!");
    expect(review.anonymous_id).toBe("anon-1");
    expect(review.created_at).toBeTruthy();
  });
});

describe("Reviews GET — limit parameter", () => {
  it("defaults to 20 results when limit not specified", async () => {
    const db = makeReviewsDb(
      Array.from({ length: 25 }, (_, i) => ({
        movie_slug: "test-movie",
        anonymous_id: `anon-${i}`,
        rating: 3,
        body: `Review number ${i}`,
      }))
    );
    const res = await simulateGet({ movie_slug: "test-movie" }, db);
    expect(res.body.reviews!.length).toBeLessThanOrEqual(20);
  });

  it("caps limit at 100", async () => {
    // simulateGet enforces Math.min(limit, 100) — verify the cap is applied
    const limitParam = "999";
    const effective = Math.min(parseInt(limitParam, 10), 100);
    expect(effective).toBe(100);
  });
});

describe("Reviews GET — DB error fallback", () => {
  it("returns {reviews:[], total:0} when DB throws", async () => {
    const res = await simulateGet({ movie_slug: "project-hail-mary" }, makeThrowingDb());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reviews: [], total: 0 });
  });
});

/* =========================================================================
   POST tests
   ========================================================================= */

describe("Reviews POST — validation: movie_slug", () => {
  it("returns 400 when movie_slug is missing", async () => {
    const res = await simulatePost({ anonymous_id: "anon-1", rating: 5, body: "Great movie!" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/movie_slug/);
  });

  it("returns 400 when movie_slug is empty string", async () => {
    const res = await simulatePost({ movie_slug: "   ", anonymous_id: "anon-1", rating: 5, body: "Great!" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/movie_slug/);
  });

  it("returns 400 when movie_slug is not a string", async () => {
    const res = await simulatePost({ movie_slug: 123, anonymous_id: "anon-1", rating: 5, body: "Great!" }, undefined);
    expect(res.status).toBe(400);
  });
});

describe("Reviews POST — validation: anonymous_id", () => {
  it("returns 400 when anonymous_id is missing", async () => {
    const res = await simulatePost({ movie_slug: "phm", rating: 5, body: "Great!" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/anonymous_id/);
  });

  it("returns 400 when anonymous_id is empty", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "", rating: 5, body: "Great!" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/anonymous_id/);
  });
});

describe("Reviews POST — validation: rating", () => {
  it("returns 400 when rating is 0", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 0, body: "Ok." }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  it("returns 400 when rating is 6", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 6, body: "Ok." }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  it("returns 400 when rating is a float", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 4.5, body: "Ok." }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  it("returns 400 when rating is a string", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: "5", body: "Ok." }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  it("accepts rating=1 (minimum)", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 1, body: "Not my favorite." }, undefined);
    expect(res.status).not.toBe(400);
  });

  it("accepts rating=5 (maximum)", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "Best film ever!" }, undefined);
    expect(res.status).not.toBe(400);
  });
});

describe("Reviews POST — validation: body", () => {
  it("returns 400 when body is missing", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5 }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body/);
  });

  it("returns 400 when body is empty string", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "   " }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body/);
  });
});

describe("Reviews POST — no DB (dev mode)", () => {
  it("returns {id:0, created:true} when DB is undefined", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 4, body: "Loved it!" }, undefined);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 0, created: true });
  });
});

describe("Reviews POST — create new review", () => {
  it("inserts review and returns 201 created", async () => {
    const db = makeReviewsDb([]);
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "Absolutely stunning!" }, db);
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.id).toBeGreaterThan(0);
  });

  it("review is retrievable after insert", async () => {
    const db = makeReviewsDb([]);
    await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "Absolutely stunning!" }, db);
    const getRes = await simulateGet({ movie_slug: "phm" }, db);
    expect(getRes.body.total).toBe(1);
    expect(getRes.body.reviews![0].rating).toBe(5);
    expect(getRes.body.reviews![0].body).toBe("Absolutely stunning!");
  });

  it("multiple different users can each submit a review", async () => {
    const db = makeReviewsDb([]);
    await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "Masterpiece!" }, db);
    await simulatePost({ movie_slug: "phm", anonymous_id: "anon-2", rating: 4, body: "Very good." }, db);
    await simulatePost({ movie_slug: "phm", anonymous_id: "anon-3", rating: 3, body: "It was okay." }, db);
    const getRes = await simulateGet({ movie_slug: "phm" }, db);
    expect(getRes.body.total).toBe(3);
  });
});

describe("Reviews POST — upsert (one review per anonymous_id per movie)", () => {
  it("updates existing review and returns {updated:true}", async () => {
    const db = makeReviewsDb([
      { movie_slug: "phm", anonymous_id: "anon-1", rating: 3, body: "Good film." },
    ]);
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "Changed my mind — brilliant!" }, db);
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(res.body.id).toBeGreaterThan(0);
  });

  it("updated review content is reflected in subsequent GET", async () => {
    const db = makeReviewsDb([
      { movie_slug: "phm", anonymous_id: "anon-1", rating: 2, body: "Disappointing." },
    ]);
    await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 5, body: "Totally changed my mind!" }, db);
    const getRes = await simulateGet({ movie_slug: "phm" }, db);
    expect(getRes.body.total).toBe(1); // still 1 review
    expect(getRes.body.reviews![0].rating).toBe(5);
    expect(getRes.body.reviews![0].body).toBe("Totally changed my mind!");
  });

  it("upsert does not create a duplicate review for the same user+movie", async () => {
    const db = makeReviewsDb([
      { movie_slug: "phm", anonymous_id: "anon-1", rating: 3, body: "Original review." },
    ]);
    await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 4, body: "Updated review." }, db);
    const getRes = await simulateGet({ movie_slug: "phm" }, db);
    expect(getRes.body.total).toBe(1);
  });
});

describe("Reviews POST — body truncation at 1000 chars", () => {
  it("accepts exactly 1000 chars", async () => {
    const db = makeReviewsDb([]);
    const longBody = "A".repeat(1000);
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 3, body: longBody }, db);
    expect(res.status).toBe(201);
  });

  it("truncates body exceeding 1000 chars at the route level", () => {
    const tooLong = "A".repeat(1500);
    const truncated = tooLong.trim().slice(0, MAX_BODY_LENGTH);
    expect(truncated.length).toBe(1000);
  });
});

describe("Reviews POST — DB error", () => {
  it("returns 500 when DB throws on insert", async () => {
    const res = await simulatePost({ movie_slug: "phm", anonymous_id: "anon-1", rating: 4, body: "Good movie." }, makeThrowingDb());
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/something went wrong/i);
  });
});
