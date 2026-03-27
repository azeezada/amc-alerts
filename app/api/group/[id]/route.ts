import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

interface GroupRow {
  id: string;
  name: string;
  host_name: string;
  host_email: string | null;
  movie_slug: string;
  movie_title: string;
  theater_slugs: string | null;
  created_at: string;
}

interface MemberRow {
  id: number;
  group_id: string;
  member_name: string;
  voted_showtimes: string;
  joined_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = params;
  if (!id || !/^[a-f0-9]{12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
  }

  try {
    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({
        group: {
          id,
          name: "Dev Group",
          host_name: "Dev Host",
          movie_slug: "project-hail-mary-76779",
          movie_title: "Project Hail Mary",
          theater_slugs: null,
          created_at: new Date().toISOString(),
        },
        members: [],
      });
    }

    const group = await db
      .prepare("SELECT * FROM groups WHERE id = ?")
      .bind(id)
      .first<GroupRow>();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const { results: members } = await db
      .prepare("SELECT * FROM group_members WHERE group_id = ? ORDER BY joined_at ASC")
      .bind(id)
      .all<MemberRow>();

    const parsedMembers = members.map((m) => ({
      id: m.id,
      name: m.member_name,
      votedShowtimes: (() => {
        try { return JSON.parse(m.voted_showtimes) as string[]; } catch { return []; }
      })(),
      joinedAt: m.joined_at,
    }));

    // Compute showtime vote counts
    const voteCounts: Record<string, number> = {};
    for (const m of parsedMembers) {
      for (const s of m.votedShowtimes) {
        voteCounts[s] = (voteCounts[s] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        hostName: group.host_name,
        movieSlug: group.movie_slug,
        movieTitle: group.movie_title,
        theaterSlugs: group.theater_slugs
          ? (() => { try { return JSON.parse(group.theater_slugs!) as string[]; } catch { return null; } })()
          : null,
        createdAt: group.created_at,
      },
      members: parsedMembers,
      voteCounts,
      memberCount: parsedMembers.length,
    });
  } catch (e) {
    console.error("Group GET error:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { id } = params;
  if (!id || !/^[a-f0-9]{12}$/.test(id)) {
    return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      memberName?: string;
      votedShowtimes?: string[];
    };
    const { memberName, votedShowtimes } = body;

    if (!memberName || typeof memberName !== "string" || memberName.trim().length === 0) {
      return NextResponse.json({ error: "Your name is required" }, { status: 400 });
    }

    const name = memberName.trim().slice(0, 80);
    const votes = JSON.stringify(
      Array.isArray(votedShowtimes) ? votedShowtimes.slice(0, 50) : []
    );

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json({ success: true, message: "[DEV] Vote recorded (no DB)" });
    }

    // Check group exists
    const group = await db
      .prepare("SELECT id FROM groups WHERE id = ?")
      .bind(id)
      .first<{ id: string }>();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Upsert: if member with same name exists in group, update their vote
    const existing = await db
      .prepare("SELECT id FROM group_members WHERE group_id = ? AND member_name = ?")
      .bind(id, name)
      .first<{ id: number }>();

    if (existing) {
      await db
        .prepare("UPDATE group_members SET voted_showtimes = ? WHERE id = ?")
        .bind(votes, existing.id)
        .run();
    } else {
      await db
        .prepare("INSERT INTO group_members (group_id, member_name, voted_showtimes) VALUES (?, ?, ?)")
        .bind(id, name, votes)
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Group POST error:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
