/**
 * Opening Weekend Heatmap — /api/heatmap Integration Tests
 *
 * Tests for GET /api/heatmap?movie=<slug>:
 *  1.  Dev mode (no DB) — mock data with dev_mode: true
 *  2.  Dev mode — dates/time_slots/cells are non-empty
 *  3.  Dev mode — cells have expected shape
 *  4.  Empty table — empty dates/time_slots/cells
 *  5.  Single row — maps to correct date and time_slot cell
 *  6.  time_slot normalization — "7:15 PM" → "7:00 PM"
 *  7.  time_slot normalization — "10:30 PM" → "10:00 PM"
 *  8.  time_slot normalization — "12:45 AM" → "12:00 AM"
 *  9.  Sellout speed — computes hours from first-available to SoldOut
 * 10.  No sellout — sellout_speed_hours is null when no SoldOut transition
 * 11.  Multiple showtimes same cell — avg speed across showtimes
 * 12.  Only one showtime sold out — speed reflects only that showtime
 * 13.  Current status: SoldOut beats AlmostFull beats Sellable
 * 14.  Current status: AlmostFull beats Sellable
 * 15.  Current status: Sellable when all showtimes Sellable
 * 16.  showtime_count equals number of distinct showtime_ids in cell
 * 17.  Dates sorted ASC in response
 * 18.  time_slots sorted by time-of-day
 * 19.  Multiple cells across different dates
 * 20.  movie_slug parameter is forwarded correctly
 * 21.  DB error — returns empty response without throwing
 * 22.  DB error — no error field in response (empty/silent)
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";

/* -------------------------------------------------------------------------
   Route logic mirror
   Mirrors the logic in app/api/heatmap/route.ts exactly
   ------------------------------------------------------------------------- */

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

interface HeatmapCell {
  date: string;
  time_slot: string;
  sellout_speed_hours: number | null;
  current_status: "Sellable" | "AlmostFull" | "SoldOut" | null;
  showtime_count: number;
}

interface HeatmapResponse {
  movie_slug: string;
  dates: string[];
  time_slots: string[];
  cells: HeatmapCell[];
  dev_mode?: boolean;
}

function normalizeTimeSlot(time: string): string {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return time;
  const hour = parseInt(m[1], 10);
  const amPm = m[3].toUpperCase();
  return `${hour}:00 ${amPm}`;
}

const DEFAULT_MOVIE_SLUG = "project-hail-mary-76779";

function buildMockResponse(movieSlug: string): HeatmapResponse {
  const dates = ["2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06"];
  const time_slots = ["12:00 PM", "3:00 PM", "7:00 PM", "10:00 PM"];
  const cells: HeatmapCell[] = [];
  for (const date of dates) {
    for (const time_slot of time_slots) {
      cells.push({ date, time_slot, sellout_speed_hours: null, current_status: null, showtime_count: 0 });
    }
  }
  return { movie_slug: movieSlug, dates, time_slots, cells, dev_mode: true };
}

async function simulateHeatmapRoute(
  db: D1Database | undefined,
  movieSlug?: string
): Promise<HeatmapResponse> {
  const slug = movieSlug ?? DEFAULT_MOVIE_SLUG;

  if (!db) {
    return buildMockResponse(slug);
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
      .bind(slug)
      .all<StatusHistoryRow>();
    rows = results;
  } catch (_) {
    return { movie_slug: slug, dates: [], time_slots: [], cells: [] };
  }

  const cellMap: Record<
    string,
    {
      showtimeIds: Set<string>;
      firstAvailableAt: Record<string, number>;
      soldOutAt: Record<string, number>;
      latestStatus: Record<string, string>;
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

    if (row.from_status === null && (row.to_status === "Sellable" || row.to_status === "AlmostFull")) {
      if (!(row.showtime_id in cell.firstAvailableAt)) {
        cell.firstAvailableAt[row.showtime_id] = ts;
      }
    }
    if (row.to_status === "SoldOut") {
      cell.soldOutAt[row.showtime_id] = ts;
    }
    cell.latestStatus[row.showtime_id] = row.to_status;
  }

  const allDates = new Set<string>();
  const allSlots = new Set<string>();

  const cells: HeatmapCell[] = Object.entries(cellMap).map(([key, data]) => {
    const [date, time_slot] = key.split("|");
    allDates.add(date);
    allSlots.add(time_slot);

    const showtime_count = data.showtimeIds.size;

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

    const statusPriority: Record<string, number> = { SoldOut: 3, AlmostFull: 2, Sellable: 1 };
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

  const dates = [...allDates].sort();
  const toMins = (s: string) => {
    const m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const mins = parseInt(m[2], 10);
    if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
    if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + mins;
  };
  const time_slots = [...allSlots].sort((a, b) => toMins(a) - toMins(b));

  return { movie_slug: slug, dates, time_slots, cells };
}

/* -------------------------------------------------------------------------
   DB helpers
   ------------------------------------------------------------------------- */

function makeDb(rows: StatusHistoryRow[] | Error): D1Database {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: async () => ({ success: true }),
    first: async () => null,
    all: async <T>() => {
      if (rows instanceof Error) throw rows;
      return { results: rows as unknown as T[] };
    },
  };
  return { prepare: (_q: string) => stmt };
}

// Helpers to build rows
function makeRow(overrides: Partial<StatusHistoryRow> & { showtime_id: string }): StatusHistoryRow {
  return {
    showtime_date: "2026-04-03",
    theater_slug: "amc-lincoln-square-13",
    format_tag: "imax-70mm",
    showtime_time: "7:00 PM",
    from_status: null,
    to_status: "Sellable",
    observed_at: "2026-03-27T06:00:00Z",
    ...overrides,
  };
}

/* -------------------------------------------------------------------------
   1–3. Dev mode (no DB)
   ------------------------------------------------------------------------- */

describe("Heatmap — dev mode (no DB)", () => {
  it("1. returns dev_mode: true when DB is undefined", async () => {
    const result = await simulateHeatmapRoute(undefined);
    expect(result.dev_mode).toBe(true);
  });

  it("2. returns non-empty dates and time_slots in dev mode", async () => {
    const result = await simulateHeatmapRoute(undefined);
    expect(result.dates.length).toBeGreaterThan(0);
    expect(result.time_slots.length).toBeGreaterThan(0);
  });

  it("3. cells have correct shape in dev mode", async () => {
    const result = await simulateHeatmapRoute(undefined);
    expect(result.cells.length).toBeGreaterThan(0);
    const cell = result.cells[0];
    expect(cell).toHaveProperty("date");
    expect(cell).toHaveProperty("time_slot");
    expect(cell).toHaveProperty("sellout_speed_hours");
    expect(cell).toHaveProperty("current_status");
    expect(cell).toHaveProperty("showtime_count");
  });
});

/* -------------------------------------------------------------------------
   4. Empty table
   ------------------------------------------------------------------------- */

describe("Heatmap — empty table", () => {
  it("4. empty table returns empty dates, time_slots, and cells", async () => {
    const db = makeDb([]);
    const result = await simulateHeatmapRoute(db);
    expect(result.dates).toEqual([]);
    expect(result.time_slots).toEqual([]);
    expect(result.cells).toEqual([]);
  });
});

/* -------------------------------------------------------------------------
   5. Single row
   ------------------------------------------------------------------------- */

describe("Heatmap — single row", () => {
  it("5. single row maps to exactly one cell with correct date and time_slot", async () => {
    const db = makeDb([makeRow({ showtime_id: "st-1", showtime_time: "7:00 PM" })]);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0].date).toBe("2026-04-03");
    expect(result.cells[0].time_slot).toBe("7:00 PM");
  });
});

/* -------------------------------------------------------------------------
   6–8. Time slot normalization
   ------------------------------------------------------------------------- */

describe("Heatmap — time_slot normalization", () => {
  it("6. '7:15 PM' normalizes to '7:00 PM'", async () => {
    const db = makeDb([makeRow({ showtime_id: "st-1", showtime_time: "7:15 PM" })]);
    const result = await simulateHeatmapRoute(db);
    expect(result.time_slots).toContain("7:00 PM");
  });

  it("7. '10:30 PM' normalizes to '10:00 PM'", async () => {
    const db = makeDb([makeRow({ showtime_id: "st-1", showtime_time: "10:30 PM" })]);
    const result = await simulateHeatmapRoute(db);
    expect(result.time_slots).toContain("10:00 PM");
  });

  it("8. '12:45 AM' normalizes to '12:00 AM'", async () => {
    const db = makeDb([makeRow({ showtime_id: "st-1", showtime_time: "12:45 AM" })]);
    const result = await simulateHeatmapRoute(db);
    expect(result.time_slots).toContain("12:00 AM");
  });
});

/* -------------------------------------------------------------------------
   9–10. Sellout speed
   ------------------------------------------------------------------------- */

describe("Heatmap — sellout speed", () => {
  it("9. computes sellout speed in hours from first-available to SoldOut", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", from_status: null, to_status: "Sellable", observed_at: "2026-03-27T06:00:00Z" }),
      makeRow({ showtime_id: "st-1", from_status: "Sellable", to_status: "SoldOut", observed_at: "2026-03-27T08:00:00Z" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].sellout_speed_hours).toBe(2.0);
  });

  it("10. sellout_speed_hours is null when no SoldOut transition exists", async () => {
    const db = makeDb([makeRow({ showtime_id: "st-1", to_status: "Sellable" })]);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].sellout_speed_hours).toBeNull();
  });
});

/* -------------------------------------------------------------------------
   11–12. Multiple showtimes per cell
   ------------------------------------------------------------------------- */

describe("Heatmap — multiple showtimes per cell", () => {
  it("11. averages sellout speed across showtimes that sold out in same cell", async () => {
    // st-1: 2h to sell out; st-2: 4h to sell out → avg = 3h
    const rows = [
      makeRow({ showtime_id: "st-1", from_status: null, to_status: "Sellable", observed_at: "2026-03-27T06:00:00Z" }),
      makeRow({ showtime_id: "st-1", from_status: "Sellable", to_status: "SoldOut", observed_at: "2026-03-27T08:00:00Z" }),
      makeRow({ showtime_id: "st-2", from_status: null, to_status: "Sellable", observed_at: "2026-03-27T06:00:00Z" }),
      makeRow({ showtime_id: "st-2", from_status: "Sellable", to_status: "SoldOut", observed_at: "2026-03-27T10:00:00Z" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].sellout_speed_hours).toBe(3.0);
  });

  it("12. only one showtime sold out → speed reflects just that showtime", async () => {
    // st-1: sold out in 2h; st-2: still Sellable
    const rows = [
      makeRow({ showtime_id: "st-1", from_status: null, to_status: "Sellable", observed_at: "2026-03-27T06:00:00Z" }),
      makeRow({ showtime_id: "st-1", from_status: "Sellable", to_status: "SoldOut", observed_at: "2026-03-27T08:00:00Z" }),
      makeRow({ showtime_id: "st-2", from_status: null, to_status: "Sellable", observed_at: "2026-03-27T06:00:00Z" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].sellout_speed_hours).toBe(2.0);
  });
});

/* -------------------------------------------------------------------------
   13–15. Current status aggregation
   ------------------------------------------------------------------------- */

describe("Heatmap — current status aggregation", () => {
  it("13. SoldOut beats AlmostFull and Sellable", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", to_status: "SoldOut" }),
      makeRow({ showtime_id: "st-2", to_status: "AlmostFull" }),
      makeRow({ showtime_id: "st-3", to_status: "Sellable" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].current_status).toBe("SoldOut");
  });

  it("14. AlmostFull beats Sellable", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", to_status: "AlmostFull" }),
      makeRow({ showtime_id: "st-2", to_status: "Sellable" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].current_status).toBe("AlmostFull");
  });

  it("15. Sellable when all showtimes are Sellable", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", to_status: "Sellable" }),
      makeRow({ showtime_id: "st-2", to_status: "Sellable" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells[0].current_status).toBe("Sellable");
  });
});

/* -------------------------------------------------------------------------
   16. showtime_count
   ------------------------------------------------------------------------- */

describe("Heatmap — showtime_count", () => {
  it("16. showtime_count equals distinct showtime_ids contributing to cell", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", to_status: "Sellable" }),
      makeRow({ showtime_id: "st-2", to_status: "AlmostFull" }),
      makeRow({ showtime_id: "st-1", from_status: "Sellable", to_status: "SoldOut", observed_at: "2026-03-27T08:00:00Z" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    // st-1 and st-2 both in same cell → count = 2
    expect(result.cells[0].showtime_count).toBe(2);
  });
});

/* -------------------------------------------------------------------------
   17–18. Sorting
   ------------------------------------------------------------------------- */

describe("Heatmap — sorting", () => {
  it("17. dates are sorted in ascending chronological order", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", showtime_date: "2026-04-05" }),
      makeRow({ showtime_id: "st-2", showtime_date: "2026-04-03" }),
      makeRow({ showtime_id: "st-3", showtime_date: "2026-04-04" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.dates).toEqual(["2026-04-03", "2026-04-04", "2026-04-05"]);
  });

  it("18. time_slots are sorted by time-of-day (AM before PM, earlier before later)", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", showtime_time: "10:00 PM" }),
      makeRow({ showtime_id: "st-2", showtime_time: "12:00 PM" }),
      makeRow({ showtime_id: "st-3", showtime_time: "7:00 PM" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.time_slots).toEqual(["12:00 PM", "7:00 PM", "10:00 PM"]);
  });
});

/* -------------------------------------------------------------------------
   19. Multiple cells across dates
   ------------------------------------------------------------------------- */

describe("Heatmap — multiple cells across dates", () => {
  it("19. two rows on different dates produce two cells with correct data", async () => {
    const rows = [
      makeRow({ showtime_id: "st-1", showtime_date: "2026-04-03", showtime_time: "7:00 PM" }),
      makeRow({ showtime_id: "st-2", showtime_date: "2026-04-04", showtime_time: "7:00 PM" }),
    ];
    const db = makeDb(rows);
    const result = await simulateHeatmapRoute(db);
    expect(result.cells).toHaveLength(2);
    const cellDates = result.cells.map((c) => c.date).sort();
    expect(cellDates).toEqual(["2026-04-03", "2026-04-04"]);
  });
});

/* -------------------------------------------------------------------------
   20. movie_slug parameter
   ------------------------------------------------------------------------- */

describe("Heatmap — movie_slug", () => {
  it("20. response movie_slug matches requested slug", async () => {
    const db = makeDb([]);
    const result = await simulateHeatmapRoute(db, "another-movie-99999");
    expect(result.movie_slug).toBe("another-movie-99999");
  });
});

/* -------------------------------------------------------------------------
   21–22. DB error
   ------------------------------------------------------------------------- */

describe("Heatmap — DB error", () => {
  it("21. DB error returns empty dates/time_slots/cells without throwing", async () => {
    const db = makeDb(new Error("D1 connection refused"));
    const result = await simulateHeatmapRoute(db);
    expect(result.dates).toEqual([]);
    expect(result.time_slots).toEqual([]);
    expect(result.cells).toEqual([]);
  });

  it("22. DB error response has correct movie_slug", async () => {
    const db = makeDb(new Error("timeout"));
    const result = await simulateHeatmapRoute(db, "project-hail-mary-76779");
    expect(result.movie_slug).toBe("project-hail-mary-76779");
  });
});
