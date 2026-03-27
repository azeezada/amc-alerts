import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      name?: string;
      hostName?: string;
      hostEmail?: string;
      movieSlug?: string;
      movieTitle?: string;
      theaterSlugs?: string[];
      votedShowtimes?: string[];
    };
    const { name, hostName, hostEmail, movieSlug, movieTitle, theaterSlugs, votedShowtimes } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }
    if (!hostName || typeof hostName !== "string" || hostName.trim().length === 0) {
      return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    }

    const groupId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const groupName = name.trim().slice(0, 100);
    const guestName = hostName.trim().slice(0, 80);
    const guestEmail = hostEmail?.trim() || null;
    const gMovieSlug = movieSlug || "project-hail-mary-76779";
    const gMovieTitle = movieTitle || "Project Hail Mary";
    const gTheaterSlugs = theaterSlugs && theaterSlugs.length > 0 ? JSON.stringify(theaterSlugs) : null;
    const gVotedShowtimes = JSON.stringify(
      Array.isArray(votedShowtimes) ? votedShowtimes.slice(0, 50) : []
    );

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      // Dev mode
      return NextResponse.json({
        success: true,
        groupId,
        inviteUrl: `/group/${groupId}`,
        message: "[DEV] Group created (no DB)",
      });
    }

    await db
      .prepare(
        "INSERT INTO groups (id, name, host_name, host_email, movie_slug, movie_title, theater_slugs) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(groupId, groupName, guestName, guestEmail, gMovieSlug, gMovieTitle, gTheaterSlugs)
      .run();

    await db
      .prepare(
        "INSERT INTO group_members (group_id, member_name, voted_showtimes) VALUES (?, ?, ?)"
      )
      .bind(groupId, guestName, gVotedShowtimes)
      .run();

    return NextResponse.json({
      success: true,
      groupId,
      inviteUrl: `/group/${groupId}`,
    });
  } catch (e) {
    console.error("Group create error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
