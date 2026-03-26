/**
 * Phase 5: Subscriber Notification Scoping Tests
 *
 * Tests the logic that filters which subscribers receive notifications based on
 * their movie_slug, theater_slugs, and dates preferences.
 *
 * These test the pure notification-filtering logic extracted from /api/check.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_MOVIE_SLUG, THEATERS } from "@/lib/scraper";
import { DateResult } from "@/lib/scraper";

/* -------------------------------------------------------------------------
   Extracted logic from /api/check for unit testing
   ------------------------------------------------------------------------- */

interface MockSubscriber {
  email: string;
  dates: string; // JSON array
  movie_slug: string | null;
  movie_title: string | null;
  theater_slugs: string | null; // JSON array or null
}

/** Mirror of the check route's per-subscriber filtering logic */
function shouldNotifySubscriber(
  sub: MockSubscriber,
  newlyAvailableByTheater: Record<string, DateResult[]>,
  checkedMovieSlug: string
): { notify: boolean; relevantDates: DateResult[]; theaterName: string } {
  const subMovieSlug = sub.movie_slug || DEFAULT_MOVIE_SLUG;
  if (subMovieSlug !== checkedMovieSlug) {
    return { notify: false, relevantDates: [], theaterName: "" };
  }

  const subTheaterSlugs: string[] = sub.theater_slugs ? JSON.parse(sub.theater_slugs) : [];
  const relevantTheaterSlugs =
    subTheaterSlugs.length === 0
      ? Object.keys(newlyAvailableByTheater)
      : subTheaterSlugs.filter((slug) => newlyAvailableByTheater[slug]?.length > 0);

  if (relevantTheaterSlugs.length === 0) {
    return { notify: false, relevantDates: [], theaterName: "" };
  }

  const subDates: string[] = JSON.parse(sub.dates || "[]");
  const relevantDates: DateResult[] = [];
  for (const theaterSlug of relevantTheaterSlugs) {
    for (const dr of newlyAvailableByTheater[theaterSlug] || []) {
      if (subDates.length === 0 || subDates.includes(dr.date)) {
        relevantDates.push(dr);
      }
    }
  }

  if (relevantDates.length === 0) {
    return { notify: false, relevantDates: [], theaterName: "" };
  }

  const theaterName =
    relevantTheaterSlugs.length === 1
      ? (THEATERS.find((t) => t.slug === relevantTheaterSlugs[0])?.name ?? relevantTheaterSlugs[0])
      : `${relevantTheaterSlugs.length} AMC theaters`;

  return { notify: true, relevantDates, theaterName };
}

/* -------------------------------------------------------------------------
   Fixtures
   ------------------------------------------------------------------------- */

function makeDateResult(date: string, showtimeIds: string[] = ["101"]): DateResult {
  return {
    date,
    available: showtimeIds.length > 0,
    showtimes: showtimeIds.map((id) => ({
      id,
      time: "7:00",
      amPm: "PM",
      status: "Sellable",
      url: `https://www.amctheatres.com/showtimes/${id}`,
    })),
  };
}

const LINCOLN_SLUG = "amc-lincoln-square-13";
const EMPIRE_SLUG = "amc-empire-25";
const KIPS_SLUG = "amc-kips-bay-15";

/* -------------------------------------------------------------------------
   5.1 Movie Slug Filtering
   ------------------------------------------------------------------------- */

describe("5.1 Subscriber — movie_slug filtering", () => {
  const newlyAvailableByTheater: Record<string, DateResult[]> = {
    [LINCOLN_SLUG]: [makeDateResult("2026-04-01")],
  };

  it("notifies subscriber whose movie_slug matches the checked movie", () => {
    const sub: MockSubscriber = {
      email: "fan@example.com",
      dates: JSON.stringify(["2026-04-01"]),
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: "Project Hail Mary",
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    expect(result.relevantDates).toHaveLength(1);
  });

  it("skips subscriber subscribed for a different movie", () => {
    const sub: MockSubscriber = {
      email: "mi@example.com",
      dates: JSON.stringify(["2026-04-01"]),
      movie_slug: "mission-impossible-8-12345",
      movie_title: "Mission: Impossible",
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(false);
  });

  it("defaults to DEFAULT_MOVIE_SLUG when movie_slug is null", () => {
    const sub: MockSubscriber = {
      email: "old@example.com",
      dates: JSON.stringify(["2026-04-01"]),
      movie_slug: null,
      movie_title: null,
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
  });
});

/* -------------------------------------------------------------------------
   5.2 Theater Slug Filtering
   ------------------------------------------------------------------------- */

describe("5.2 Subscriber — theater_slugs filtering", () => {
  const newlyAvailableByTheater: Record<string, DateResult[]> = {
    [LINCOLN_SLUG]: [makeDateResult("2026-04-01")],
    [EMPIRE_SLUG]: [makeDateResult("2026-04-02")],
  };

  it("notifies subscriber with no theater preference about all theaters", () => {
    const sub: MockSubscriber = {
      email: "all@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    expect(result.relevantDates).toHaveLength(2);
  });

  it("notifies subscriber whose preferred theater has new showtimes", () => {
    const sub: MockSubscriber = {
      email: "lincoln@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: JSON.stringify([LINCOLN_SLUG]),
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    expect(result.relevantDates).toHaveLength(1);
    expect(result.relevantDates[0].date).toBe("2026-04-01");
  });

  it("skips subscriber whose preferred theater has no new showtimes", () => {
    const sub: MockSubscriber = {
      email: "kips@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: JSON.stringify([KIPS_SLUG]),
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(false);
  });

  it("notifies subscriber with multiple theaters if at least one has new showtimes", () => {
    const sub: MockSubscriber = {
      email: "multi@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: JSON.stringify([LINCOLN_SLUG, KIPS_SLUG]),
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    // Only Lincoln has new showtimes
    expect(result.relevantDates).toHaveLength(1);
  });

  it("returns correct theater name for single theater subscriber", () => {
    const sub: MockSubscriber = {
      email: "lincoln@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: JSON.stringify([LINCOLN_SLUG]),
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.theaterName).toBe("AMC Lincoln Square");
  });

  it("returns multi-theater name string for subscriber watching multiple theaters", () => {
    const sub: MockSubscriber = {
      email: "both@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: null, // all theaters
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.theaterName).toMatch(/2 AMC theaters/);
  });
});

/* -------------------------------------------------------------------------
   5.3 Date Filtering Combined with Theater Filtering
   ------------------------------------------------------------------------- */

describe("5.3 Subscriber — date + theater combined filtering", () => {
  const newlyAvailableByTheater: Record<string, DateResult[]> = {
    [LINCOLN_SLUG]: [makeDateResult("2026-04-01"), makeDateResult("2026-04-02")],
    [EMPIRE_SLUG]: [makeDateResult("2026-04-03")],
  };

  it("only returns dates matching subscriber date preferences", () => {
    const sub: MockSubscriber = {
      email: "apr1@example.com",
      dates: JSON.stringify(["2026-04-01"]),
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: JSON.stringify([LINCOLN_SLUG]),
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    expect(result.relevantDates).toHaveLength(1);
    expect(result.relevantDates[0].date).toBe("2026-04-01");
  });

  it("skips if subscriber dates don't overlap with newly available dates", () => {
    const sub: MockSubscriber = {
      email: "may@example.com",
      dates: JSON.stringify(["2026-05-01"]),
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(false);
  });

  it("subscriber with empty dates gets all newly available dates", () => {
    const sub: MockSubscriber = {
      email: "any@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    // 2 from Lincoln + 1 from Empire = 3
    expect(result.relevantDates).toHaveLength(3);
  });

  it("theater filter takes precedence — subscriber at Empire only sees Empire dates", () => {
    const sub: MockSubscriber = {
      email: "empire@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: JSON.stringify([EMPIRE_SLUG]),
    };
    const result = shouldNotifySubscriber(sub, newlyAvailableByTheater, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(true);
    expect(result.relevantDates).toHaveLength(1);
    expect(result.relevantDates[0].date).toBe("2026-04-03");
  });
});

/* -------------------------------------------------------------------------
   5.4 Edge Cases
   ------------------------------------------------------------------------- */

describe("5.4 Subscriber — edge cases", () => {
  it("handles empty newlyAvailableByTheater — no notifications", () => {
    const sub: MockSubscriber = {
      email: "test@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: null,
    };
    const result = shouldNotifySubscriber(sub, {}, DEFAULT_MOVIE_SLUG);
    expect(result.notify).toBe(false);
  });

  it("handles malformed theater_slugs gracefully — falls back to all theaters", () => {
    // If theater_slugs is valid JSON but an empty array, treat as no preference
    const sub: MockSubscriber = {
      email: "test@example.com",
      dates: "[]",
      movie_slug: DEFAULT_MOVIE_SLUG,
      movie_title: null,
      theater_slugs: "[]",
    };
    const newlyAvailable = { [LINCOLN_SLUG]: [makeDateResult("2026-04-01")] };
    const result = shouldNotifySubscriber(sub, newlyAvailable, DEFAULT_MOVIE_SLUG);
    // Empty array = no preference = notify for all theaters
    expect(result.notify).toBe(true);
  });
});
