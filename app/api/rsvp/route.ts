import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

// GET /api/rsvp?showtime_id=xxx[&anonymous_id=yyy]
// Returns { count: N, going: bool }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showtimeId = searchParams.get("showtime_id");
  const anonymousId = searchParams.get("anonymous_id") ?? null;

  if (!showtimeId) {
    return NextResponse.json({ error: "showtime_id is required" }, { status: 400 });
  }

  try {
    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ count: 0, going: false });
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM rsvps WHERE showtime_id = ?")
      .bind(showtimeId)
      .first<{ count: number }>();

    const count = countRow?.count ?? 0;
    let going = false;

    if (anonymousId) {
      const goingRow = await db
        .prepare("SELECT 1 FROM rsvps WHERE showtime_id = ? AND anonymous_id = ?")
        .bind(showtimeId, anonymousId)
        .first();
      going = goingRow != null;
    }

    return NextResponse.json({ count, going });
  } catch {
    return NextResponse.json({ count: 0, going: false });
  }
}

// POST /api/rsvp
// Body: { showtime_id: string, anonymous_id: string, action: "add" | "remove" }
// Returns { count: N, going: bool }
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      showtime_id?: string;
      anonymous_id?: string;
      action?: string;
    };

    const { showtime_id: showtimeId, anonymous_id: anonymousId, action } = body;

    if (!showtimeId || typeof showtimeId !== "string" || showtimeId.trim().length === 0) {
      return NextResponse.json({ error: "showtime_id is required" }, { status: 400 });
    }
    if (!anonymousId || typeof anonymousId !== "string" || anonymousId.trim().length === 0) {
      return NextResponse.json({ error: "anonymous_id is required" }, { status: 400 });
    }
    if (action !== "add" && action !== "remove") {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }

    // Sanitize inputs
    const sid = showtimeId.trim().slice(0, 100);
    const aid = anonymousId.trim().slice(0, 64);

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ count: action === "add" ? 1 : 0, going: action === "add" });
    }

    if (action === "add") {
      await db
        .prepare(
          "INSERT OR IGNORE INTO rsvps (showtime_id, anonymous_id) VALUES (?, ?)"
        )
        .bind(sid, aid)
        .run();
    } else {
      await db
        .prepare("DELETE FROM rsvps WHERE showtime_id = ? AND anonymous_id = ?")
        .bind(sid, aid)
        .run();
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM rsvps WHERE showtime_id = ?")
      .bind(sid)
      .first<{ count: number }>();

    const count = countRow?.count ?? 0;
    const going = action === "add";

    return NextResponse.json({ count, going });
  } catch (e) {
    console.error("RSVP error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
