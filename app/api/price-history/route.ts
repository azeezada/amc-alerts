import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";

interface PriceHistoryRow {
  observed_at: string;
  movie_slug: string;
  showtime_date: string;
  theater_slug: string;
  format_tag: string;
  promo: string | null;
  showtime_count: number;
}

interface ChartPoint {
  observed_at: string;
  showtime_count: number;
  promo: string | null;
}

interface FormatSeries {
  format_tag: string;
  points: ChartPoint[];
}

interface TheaterSeries {
  theater_slug: string;
  formats: FormatSeries[];
}

interface MovieChart {
  movie_slug: string;
  theaters: TheaterSeries[];
  current_promos: string[];
  first_observed: string | null;
  last_observed: string | null;
  total_observations: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const movieSlug = searchParams.get("movieSlug");

  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  if (!db) {
    // Dev mode: return mock chart data
    return NextResponse.json({
      charts: [
        {
          movie_slug: movieSlug ?? "project-hail-mary-76779",
          theaters: [
            {
              theater_slug: "amc-lincoln-square-13",
              formats: [
                {
                  format_tag: "imax-70mm",
                  points: [
                    { observed_at: "2026-03-27T06:00:00Z", showtime_count: 3, promo: "20% OFF" },
                    { observed_at: "2026-03-27T06:15:00Z", showtime_count: 3, promo: "20% OFF" },
                    { observed_at: "2026-03-27T06:30:00Z", showtime_count: 2, promo: null },
                  ],
                },
              ],
            },
          ],
          current_promos: ["20% OFF"],
          first_observed: "2026-03-27T06:00:00Z",
          last_observed: "2026-03-27T06:30:00Z",
          total_observations: 3,
        },
      ],
      devMode: true,
    });
  }

  try {
    const query = movieSlug
      ? `SELECT observed_at, movie_slug, showtime_date, theater_slug, format_tag, promo, showtime_count
         FROM price_history
         WHERE movie_slug = ?
         ORDER BY observed_at ASC
         LIMIT 1000`
      : `SELECT observed_at, movie_slug, showtime_date, theater_slug, format_tag, promo, showtime_count
         FROM price_history
         ORDER BY observed_at ASC
         LIMIT 1000`;

    const stmt = movieSlug ? db.prepare(query).bind(movieSlug) : db.prepare(query);
    const { results } = await stmt.all<PriceHistoryRow>();

    // Group by movie_slug → theater_slug → format_tag
    const byMovie: Record<string, Record<string, Record<string, ChartPoint[]>>> = {};
    for (const row of results) {
      if (!byMovie[row.movie_slug]) byMovie[row.movie_slug] = {};
      if (!byMovie[row.movie_slug][row.theater_slug]) byMovie[row.movie_slug][row.theater_slug] = {};
      if (!byMovie[row.movie_slug][row.theater_slug][row.format_tag]) {
        byMovie[row.movie_slug][row.theater_slug][row.format_tag] = [];
      }
      byMovie[row.movie_slug][row.theater_slug][row.format_tag].push({
        observed_at: row.observed_at,
        showtime_count: row.showtime_count,
        promo: row.promo,
      });
    }

    const charts: MovieChart[] = Object.entries(byMovie).map(([slug, theaters]) => {
      const allPoints = Object.values(theaters).flatMap((formats) =>
        Object.values(formats).flat()
      );
      const promos = [...new Set(allPoints.map((p) => p.promo).filter(Boolean))] as string[];
      const timestamps = allPoints.map((p) => p.observed_at).sort();

      return {
        movie_slug: slug,
        theaters: Object.entries(theaters).map(([theaterSlug, formats]) => ({
          theater_slug: theaterSlug,
          formats: Object.entries(formats).map(([formatTag, points]) => ({
            format_tag: formatTag,
            points,
          })),
        })),
        current_promos: promos,
        first_observed: timestamps[0] ?? null,
        last_observed: timestamps[timestamps.length - 1] ?? null,
        total_observations: allPoints.length,
      };
    });

    return NextResponse.json({ charts });
  } catch (e) {
    // price_history table may not exist yet on old deployments
    return NextResponse.json({ charts: [], error: String(e) });
  }
}
