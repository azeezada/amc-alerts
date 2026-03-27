import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

const MAX_BODY_LENGTH = 1000;

interface ReviewRow {
  id: number;
  movie_slug: string;
  anonymous_id: string;
  rating: number;
  body: string;
  created_at: string;
}

// GET /api/reviews?movie_slug=xxx[&limit=N]
// Returns { reviews: ReviewRow[], total: N }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const movieSlug = searchParams.get("movie_slug");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "20", 10) || 20, 100);

  if (!movieSlug) {
    return NextResponse.json({ error: "movie_slug is required" }, { status: 400 });
  }

  try {
    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ reviews: [], total: 0 });
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

    return NextResponse.json({ reviews: rows.results ?? [], total });
  } catch {
    return NextResponse.json({ reviews: [], total: 0 });
  }
}

// POST /api/reviews
// Body: { movie_slug: string, anonymous_id: string, rating: number (1-5), body: string }
// Returns { id: N, created: bool } or { updated: bool } if existing review replaced
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      movie_slug?: string;
      anonymous_id?: string;
      rating?: number;
      body?: string;
    };

    const { movie_slug: movieSlug, anonymous_id: anonymousId, rating, body: reviewBody } = body;

    if (!movieSlug || typeof movieSlug !== "string" || movieSlug.trim().length === 0) {
      return NextResponse.json({ error: "movie_slug is required" }, { status: 400 });
    }
    if (!anonymousId || typeof anonymousId !== "string" || anonymousId.trim().length === 0) {
      return NextResponse.json({ error: "anonymous_id is required" }, { status: 400 });
    }
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be an integer 1–5" }, { status: 400 });
    }
    if (!reviewBody || typeof reviewBody !== "string" || reviewBody.trim().length === 0) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const slug = movieSlug.trim().slice(0, 200);
    const aid = anonymousId.trim().slice(0, 64);
    const sanitizedBody = reviewBody.trim().slice(0, MAX_BODY_LENGTH);

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ id: 0, created: true });
    }

    // Check if this anonymous_id already has a review for this movie (upsert)
    const existing = await db
      .prepare("SELECT id FROM reviews WHERE movie_slug = ? AND anonymous_id = ?")
      .bind(slug, aid)
      .first<{ id: number }>();

    if (existing) {
      await db
        .prepare(
          "UPDATE reviews SET rating = ?, body = ?, created_at = datetime('now') WHERE movie_slug = ? AND anonymous_id = ?"
        )
        .bind(rating, sanitizedBody, slug, aid)
        .run();
      return NextResponse.json({ id: existing.id, updated: true });
    }

    const result = await db
      .prepare(
        "INSERT INTO reviews (movie_slug, anonymous_id, rating, body) VALUES (?, ?, ?, ?)"
      )
      .bind(slug, aid, rating, sanitizedBody)
      .run();

    // D1 run() result may include lastRowId — use a follow-up query for reliability
    const newRow = await db
      .prepare("SELECT id FROM reviews WHERE movie_slug = ? AND anonymous_id = ?")
      .bind(slug, aid)
      .first<{ id: number }>();

    if (!result.success) {
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    return NextResponse.json({ id: newRow?.id ?? 0, created: true }, { status: 201 });
  } catch (e) {
    console.error("Reviews POST error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
