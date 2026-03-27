import { NextRequest, NextResponse } from "next/server";
import { getCfEnv } from "@/lib/cf-env";
import { THEATERS, FORMATS, DEFAULT_MOVIE_SLUG } from "@/lib/scraper";

export const runtime = "edge";

interface StatusHistoryRow {
  id: number;
  showtime_id: string;
  movie_slug: string;
  showtime_date: string;
  theater_slug: string;
  format_tag: string;
  showtime_time: string;
  from_status: string | null;
  to_status: string;
  observed_at: string;
}

// Returns status transition history grouped by movie → showtime_date → theater → format.
// Also computes sellout_speed_hours for showtimes that went Sellable → SoldOut.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const movieSlug = url.searchParams.get("movie") ?? DEFAULT_MOVIE_SLUG;

  const env = await getCfEnv();
  const db = env.DB;

  if (!db) {
    // Dev mode: return mock data
    const mock = buildMockResponse();
    return NextResponse.json(mock);
  }

  let rows: StatusHistoryRow[] = [];
  try {
    const { results } = await db
      .prepare(
        `SELECT id, showtime_id, movie_slug, showtime_date, theater_slug, format_tag,
                showtime_time, from_status, to_status, observed_at
         FROM showtime_status_history
         WHERE movie_slug = ?
         ORDER BY observed_at ASC`
      )
      .bind(movieSlug)
      .all<StatusHistoryRow>();
    rows = results;
  } catch (_) {
    // Table may not exist yet on old deployments
    return NextResponse.json({ transitions: [], selloutSpeeds: [], byShowtime: {} });
  }

  // Group transitions by showtime_id
  const byShowtime: Record<
    string,
    {
      showtime_id: string;
      movie_slug: string;
      showtime_date: string;
      theater_slug: string;
      theater_name: string;
      format_tag: string;
      format_label: string;
      showtime_time: string;
      transitions: { from: string | null; to: string; at: string }[];
      sellout_speed_hours: number | null;
    }
  > = {};

  for (const row of rows) {
    if (!byShowtime[row.showtime_id]) {
      const theater = THEATERS.find((t) => t.slug === row.theater_slug);
      const format = FORMATS.find((f) => f.tag === row.format_tag);
      byShowtime[row.showtime_id] = {
        showtime_id: row.showtime_id,
        movie_slug: row.movie_slug,
        showtime_date: row.showtime_date,
        theater_slug: row.theater_slug,
        theater_name: theater?.name ?? row.theater_slug,
        format_tag: row.format_tag,
        format_label: format?.label ?? row.format_tag,
        showtime_time: row.showtime_time,
        transitions: [],
        sellout_speed_hours: null,
      };
    }
    byShowtime[row.showtime_id].transitions.push({
      from: row.from_status,
      to: row.to_status,
      at: row.observed_at,
    });
  }

  // Compute sellout speed: time between first Sellable and first SoldOut observation
  const selloutSpeeds: Array<{
    showtime_id: string;
    theater_name: string;
    format_label: string;
    showtime_date: string;
    showtime_time: string;
    first_available_at: string;
    sold_out_at: string;
    speed_hours: number;
  }> = [];

  for (const entry of Object.values(byShowtime)) {
    const firstSellable = entry.transitions.find(
      (t) => t.from === null && (t.to === "Sellable" || t.to === "AlmostFull")
    );
    const soldOutTransition = entry.transitions.find((t) => t.to === "SoldOut");
    if (firstSellable && soldOutTransition) {
      const firstAt = new Date(firstSellable.at).getTime();
      const soldAt = new Date(soldOutTransition.at).getTime();
      const hours = Math.round(((soldAt - firstAt) / (1000 * 60 * 60)) * 10) / 10;
      entry.sellout_speed_hours = hours;
      selloutSpeeds.push({
        showtime_id: entry.showtime_id,
        theater_name: entry.theater_name,
        format_label: entry.format_label,
        showtime_date: entry.showtime_date,
        showtime_time: entry.showtime_time,
        first_available_at: firstSellable.at,
        sold_out_at: soldOutTransition.at,
        speed_hours: hours,
      });
    }
  }

  // Sort by speed ascending (fastest sellouts first)
  selloutSpeeds.sort((a, b) => a.speed_hours - b.speed_hours);

  return NextResponse.json({
    movie_slug: movieSlug,
    transitions: rows.length,
    byShowtime,
    selloutSpeeds,
  });
}

function buildMockResponse() {
  const now = new Date().toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  return {
    movie_slug: DEFAULT_MOVIE_SLUG,
    transitions: 4,
    byShowtime: {
      "mock-showtime-1": {
        showtime_id: "mock-showtime-1",
        movie_slug: DEFAULT_MOVIE_SLUG,
        showtime_date: "2026-04-03",
        theater_slug: "amc-lincoln-square-13",
        theater_name: "AMC Lincoln Square",
        format_tag: "imax70mm",
        format_label: "IMAX 70mm",
        showtime_time: "7:00 PM",
        transitions: [
          { from: null, to: "Sellable", at: sixHoursAgo },
          { from: "Sellable", to: "AlmostFull", at: twoHoursAgo },
          { from: "AlmostFull", to: "SoldOut", at: now },
        ],
        sellout_speed_hours: 6.0,
      },
    },
    selloutSpeeds: [
      {
        showtime_id: "mock-showtime-1",
        theater_name: "AMC Lincoln Square",
        format_label: "IMAX 70mm",
        showtime_date: "2026-04-03",
        showtime_time: "7:00 PM",
        first_available_at: sixHoursAgo,
        sold_out_at: now,
        speed_hours: 6.0,
      },
    ],
  };
}
