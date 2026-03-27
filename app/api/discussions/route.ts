import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

const MAX_BODY_LENGTH = 280;

interface DiscussionMessage {
  id: number;
  showtime_id: string;
  anonymous_id: string;
  body: string;
  created_at: string;
}

// GET /api/discussions?showtime_id=xxx[&limit=N]
// Returns { messages: DiscussionMessage[], total: N }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showtimeId = searchParams.get("showtime_id");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam ?? "50", 10) || 50, 100);

  if (!showtimeId) {
    return NextResponse.json({ error: "showtime_id is required" }, { status: 400 });
  }

  try {
    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ messages: [], total: 0 });
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM discussions WHERE showtime_id = ?")
      .bind(showtimeId)
      .first<{ count: number }>();

    const total = countRow?.count ?? 0;

    const rows = await db
      .prepare(
        "SELECT id, showtime_id, anonymous_id, body, created_at FROM discussions WHERE showtime_id = ? ORDER BY created_at ASC LIMIT ?"
      )
      .bind(showtimeId, limit)
      .all<DiscussionMessage>();

    return NextResponse.json({ messages: rows.results ?? [], total });
  } catch {
    return NextResponse.json({ messages: [], total: 0 });
  }
}

// POST /api/discussions
// Body: { showtime_id: string, anonymous_id: string, body: string }
// Returns { id: N, created: true }
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      showtime_id?: string;
      anonymous_id?: string;
      body?: string;
    };

    const { showtime_id: showtimeId, anonymous_id: anonymousId, body: messageBody } = body;

    if (!showtimeId || typeof showtimeId !== "string" || showtimeId.trim().length === 0) {
      return NextResponse.json({ error: "showtime_id is required" }, { status: 400 });
    }
    if (!anonymousId || typeof anonymousId !== "string" || anonymousId.trim().length === 0) {
      return NextResponse.json({ error: "anonymous_id is required" }, { status: 400 });
    }
    if (!messageBody || typeof messageBody !== "string" || messageBody.trim().length === 0) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    const sid = showtimeId.trim().slice(0, 200);
    const aid = anonymousId.trim().slice(0, 64);
    const sanitizedBody = messageBody.trim().slice(0, MAX_BODY_LENGTH);

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ id: 0, created: true }, { status: 201 });
    }

    const result = await db
      .prepare(
        "INSERT INTO discussions (showtime_id, anonymous_id, body) VALUES (?, ?, ?)"
      )
      .bind(sid, aid, sanitizedBody)
      .run();

    if (!result.success) {
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }

    // D1 follow-up SELECT for reliable ID retrieval
    const newRow = await db
      .prepare(
        "SELECT id FROM discussions WHERE showtime_id = ? AND anonymous_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .bind(sid, aid)
      .first<{ id: number }>();

    return NextResponse.json({ id: newRow?.id ?? 0, created: true }, { status: 201 });
  } catch (e) {
    console.error("Discussions POST error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
