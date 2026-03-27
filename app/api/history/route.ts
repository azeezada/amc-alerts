import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";

// Release dates for known movies (YYYY-MM-DD, opening day)
const RELEASE_DATES: Record<string, string> = {
  "project-hail-mary-76779": "2026-04-03",
};

interface HistoryRow {
  movie_slug: string;
  first_on_sale_at: string;
  total_entries: number;
}

interface MovieHistoryEntry {
  movie_slug: string;
  first_on_sale_at: string | null;
  release_date: string | null;
  days_before_release: number | null;
  total_history_entries: number;
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 86400000;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / msPerDay);
}

export async function GET(_request: NextRequest) {
  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  if (!db) {
    // Dev mode: return mock data
    return NextResponse.json({
      movies: [
        {
          movie_slug: "project-hail-mary-76779",
          first_on_sale_at: "2026-03-27T06:00:00Z",
          release_date: "2026-04-03",
          days_before_release: 7,
          total_history_entries: 0,
        },
      ],
      devMode: true,
    });
  }

  try {
    const { results } = await db
      .prepare(
        `SELECT movie_slug,
                MIN(first_seen_at) AS first_on_sale_at,
                COUNT(*) AS total_entries
         FROM ticket_history
         GROUP BY movie_slug`
      )
      .all<HistoryRow>();

    const movies: MovieHistoryEntry[] = results.map((row) => {
      const releaseDate = RELEASE_DATES[row.movie_slug] ?? null;
      const daysBeforeRelease =
        releaseDate && row.first_on_sale_at
          ? daysBetween(row.first_on_sale_at.slice(0, 10), releaseDate)
          : null;
      return {
        movie_slug: row.movie_slug,
        first_on_sale_at: row.first_on_sale_at,
        release_date: releaseDate,
        days_before_release: daysBeforeRelease,
        total_history_entries: row.total_entries,
      };
    });

    return NextResponse.json({ movies });
  } catch (e) {
    // ticket_history table may not exist yet on old deployments
    return NextResponse.json({ movies: [], error: String(e) });
  }
}
