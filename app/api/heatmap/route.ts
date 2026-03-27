import { NextRequest, NextResponse } from "next/server";
import { getCfEnv } from "@/lib/cf-env";
import { DEFAULT_MOVIE_SLUG } from "@/lib/scraper";

export const runtime = "edge";

interface StatusHistoryRow {
  showtime_id: string;
  showtime_date: string;
  theater_slug: string;
  format_tag: string;
  showtime_time: string;
  from_status: string | null;
  to_status: string;
  observed_at: string;
}

export interface HeatmapCell {
  date: string;
  time_slot: string;
  // null = no data, otherwise hours from first-available to SoldOut
  sellout_speed_hours: number | null;
  // current status for cells that haven't sold out
  current_status: "Sellable" | "AlmostFull" | "SoldOut" | null;
  showtime_count: number;
}

export interface HeatmapResponse {
  movie_slug: string;
  dates: string[];
  time_slots: string[];
  cells: HeatmapCell[];
  dev_mode?: boolean;
}

// Normalize time strings like "7:00 PM", "10:30 AM" → bucket into hour slots
function normalizeTimeSlot(time: string): string {
  // Already a clean slot like "7:00 PM"
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return time;
  const hour = parseInt(m[1], 10);
  const amPm = m[3].toUpperCase();
  return `${hour}:00 ${amPm}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const movieSlug = url.searchParams.get("movie") ?? DEFAULT_MOVIE_SLUG;

  const env = await getCfEnv();
  const db = env.DB;

  if (!db) {
    return NextResponse.json(buildMockResponse(movieSlug));
  }

  let rows: StatusHistoryRow[] = [];
  try {
    const { results } = await db
      .prepare(
        `SELECT showtime_id, showtime_date, theater_slug, format_tag, showtime_time,
                from_status, to_status, observed_at
         FROM showtime_status_history
         WHERE movie_slug = ?
         ORDER BY observed_at ASC`
      )
      .bind(movieSlug)
      .all<StatusHistoryRow>();
    rows = results;
  } catch (_) {
    return NextResponse.json({
      movie_slug: movieSlug,
      dates: [],
      time_slots: [],
      cells: [],
    } satisfies HeatmapResponse);
  }

  // Group by (showtime_date, time_slot) across all theaters/formats
  // A cell represents one date×time combination; we aggregate sellout speed across all theaters
  const cellMap: Record<
    string, // "date|time_slot"
    {
      showtimeIds: Set<string>;
      firstAvailableAt: Record<string, number>; // showtime_id → timestamp ms
      soldOutAt: Record<string, number>; // showtime_id → timestamp ms
      latestStatus: Record<string, string>; // showtime_id → last known status
    }
  > = {};

  for (const row of rows) {
    const slot = normalizeTimeSlot(row.showtime_time);
    const key = `${row.showtime_date}|${slot}`;
    if (!cellMap[key]) {
      cellMap[key] = {
        showtimeIds: new Set(),
        firstAvailableAt: {},
        soldOutAt: {},
        latestStatus: {},
      };
    }
    const cell = cellMap[key];
    cell.showtimeIds.add(row.showtime_id);

    const ts = new Date(row.observed_at).getTime();

    // Track when each showtime first became available
    if (row.from_status === null && (row.to_status === "Sellable" || row.to_status === "AlmostFull")) {
      if (!(row.showtime_id in cell.firstAvailableAt)) {
        cell.firstAvailableAt[row.showtime_id] = ts;
      }
    }

    // Track when each showtime sold out
    if (row.to_status === "SoldOut") {
      cell.soldOutAt[row.showtime_id] = ts;
    }

    // Track latest status per showtime
    cell.latestStatus[row.showtime_id] = row.to_status;
  }

  // Compute cells
  const allDates = new Set<string>();
  const allSlots = new Set<string>();

  const cells: HeatmapCell[] = Object.entries(cellMap).map(([key, data]) => {
    const [date, time_slot] = key.split("|");
    allDates.add(date);
    allSlots.add(time_slot);

    const showtime_count = data.showtimeIds.size;

    // Compute average sellout speed across showtimes that sold out
    const speeds: number[] = [];
    for (const id of data.showtimeIds) {
      const firstAt = data.firstAvailableAt[id];
      const soldAt = data.soldOutAt[id];
      if (firstAt !== undefined && soldAt !== undefined) {
        speeds.push((soldAt - firstAt) / (1000 * 60 * 60));
      }
    }

    const sellout_speed_hours =
      speeds.length > 0
        ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10
        : null;

    // Determine aggregate current status (worst = most urgent)
    const statusPriority: Record<string, number> = {
      SoldOut: 3,
      AlmostFull: 2,
      Sellable: 1,
    };
    let worstStatus: string | null = null;
    let worstPriority = 0;
    for (const s of Object.values(data.latestStatus)) {
      const p = statusPriority[s] ?? 0;
      if (p > worstPriority) {
        worstPriority = p;
        worstStatus = s;
      }
    }

    return {
      date,
      time_slot,
      sellout_speed_hours,
      current_status: (worstStatus as HeatmapCell["current_status"]) ?? null,
      showtime_count,
    };
  });

  // Sort dates and slots
  const dates = [...allDates].sort();
  const time_slots = [...allSlots].sort((a, b) => {
    // Sort by hour: "7:00 AM" < "10:00 AM" < "7:00 PM" < "10:00 PM"
    const toMins = (s: string) => {
      const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return 0;
      let h = parseInt(m[1], 10);
      const mins = parseInt(m[2], 10);
      if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
      return h * 60 + mins;
    };
    return toMins(a) - toMins(b);
  });

  return NextResponse.json({
    movie_slug: movieSlug,
    dates,
    time_slots,
    cells,
  } satisfies HeatmapResponse);
}

function buildMockResponse(movieSlug: string): HeatmapResponse {
  const dates = ["2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06"];
  const time_slots = ["12:00 PM", "3:00 PM", "7:00 PM", "10:00 PM"];

  const cells: HeatmapCell[] = [];

  // Mock: evening slots on opening day sell out fastest
  const mockData: Record<string, Partial<HeatmapCell>> = {
    "2026-04-03|7:00 PM": {
      sellout_speed_hours: 1.5,
      current_status: "SoldOut",
      showtime_count: 3,
    },
    "2026-04-03|10:00 PM": {
      sellout_speed_hours: 2.0,
      current_status: "SoldOut",
      showtime_count: 2,
    },
    "2026-04-03|3:00 PM": {
      sellout_speed_hours: 4.5,
      current_status: "SoldOut",
      showtime_count: 2,
    },
    "2026-04-03|12:00 PM": {
      sellout_speed_hours: null,
      current_status: "AlmostFull",
      showtime_count: 2,
    },
    "2026-04-04|7:00 PM": {
      sellout_speed_hours: 3.0,
      current_status: "SoldOut",
      showtime_count: 3,
    },
    "2026-04-04|10:00 PM": {
      sellout_speed_hours: null,
      current_status: "AlmostFull",
      showtime_count: 2,
    },
    "2026-04-04|3:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 2,
    },
    "2026-04-04|12:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 2,
    },
    "2026-04-05|7:00 PM": {
      sellout_speed_hours: null,
      current_status: "AlmostFull",
      showtime_count: 2,
    },
    "2026-04-05|10:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 2,
    },
    "2026-04-05|3:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 2,
    },
    "2026-04-05|12:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 1,
    },
    "2026-04-06|7:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 2,
    },
    "2026-04-06|10:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 1,
    },
    "2026-04-06|3:00 PM": {
      sellout_speed_hours: null,
      current_status: "Sellable",
      showtime_count: 1,
    },
    "2026-04-06|12:00 PM": {
      sellout_speed_hours: null,
      current_status: null,
      showtime_count: 0,
    },
  };

  for (const date of dates) {
    for (const time_slot of time_slots) {
      const key = `${date}|${time_slot}`;
      const override = mockData[key] ?? {};
      cells.push({
        date,
        time_slot,
        sellout_speed_hours: override.sellout_speed_hours ?? null,
        current_status: override.current_status ?? null,
        showtime_count: override.showtime_count ?? 0,
      });
    }
  }

  return {
    movie_slug: movieSlug,
    dates,
    time_slots,
    cells,
    dev_mode: true,
  };
}
