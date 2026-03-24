// AMC Showtime Scraper — multi-theater, multi-format
// Uses AMC SSR HTML parsing — confirmed working via research

export interface Showtime {
  id: string;
  time: string;
  amPm: string;
  status: "Sellable" | "AlmostFull" | "SoldOut" | string;
  url: string;
}

export interface DateResult {
  date: string;
  available: boolean;
  showtimes: Showtime[];
  error?: string;
}

export interface StatusResult {
  dates: Record<string, DateResult>;
  checkedAt: string;
}

export interface TheaterFormatResult {
  dates: Record<string, DateResult>;
}

export interface TheaterResult {
  name: string;
  neighborhood: string;
  formats: Record<string, TheaterFormatResult>;
}

export interface MultiStatusResult {
  theaters: Record<string, TheaterResult>;
  checkedAt: string;
}

/* -------------------------------------------------------------------------
   Config
   ------------------------------------------------------------------------- */

export const THEATERS = [
  { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square", neighborhood: "Upper West Side" },
  { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Midtown" },
  { slug: "amc-kips-bay-15", name: "AMC Kips Bay 15", neighborhood: "Kips Bay" },
];

export const FORMATS = [
  { tag: "imax70mm", label: "IMAX 70mm", priority: 1 },
  { tag: "dolbycinema", label: "Dolby Cinema", priority: 2 },
  { tag: "imax", label: "IMAX", priority: 3 },
];

const MARKET_SLUG = "new-york-city";
const MOVIE_SLUG = "project-hail-mary-76779";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

export const TARGET_DATES = [
  "2026-04-01",
  "2026-04-02",
  "2026-04-03",
  "2026-04-04",
  "2026-04-05",
];

export function formatDateNice(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/* -------------------------------------------------------------------------
   Fetch
   ------------------------------------------------------------------------- */

async function fetchPage(date: string, theaterSlug: string): Promise<string | null> {
  const url = `https://www.amctheatres.com/movie-theatres/${MARKET_SLUG}/${theaterSlug}/showtimes?date=${date}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.error(`HTTP ${resp.status} for ${theaterSlug}/${date}`);
      return null;
    }
    return await resp.text();
  } catch (e) {
    console.error(`Fetch error for ${theaterSlug}/${date}:`, e);
    return null;
  }
}

/* -------------------------------------------------------------------------
   Parse
   ------------------------------------------------------------------------- */

/**
 * Extract showtimes for a given format tag from AMC's SSR HTML.
 *
 * The HTML contains anchor tags like:
 *   <a aria-describedby="...imax70mm..." id="140840268" href="/showtimes/140840268">
 *     11:00<!-- -->am
 *
 * For standard IMAX (tag="imax"), we exclude IMAX 70mm entries.
 */
function extractFormatShowtimes(html: string, formatTag: string): Showtime[] {
  const showtimes: Showtime[] = [];
  const seen = new Set<string>();
  const isStandardImax = formatTag === "imax";

  const anchorRegex =
    /<a[^>]+aria-describedby="([^"]*)"[^>]*id="(\d+)"[^>]*href="\/showtimes\/(\d+)"[^>]*>([\d:]+)<!--\s*-->(am|pm)/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const describedBy = match[1].toLowerCase();

    if (!describedBy.includes(formatTag)) continue;
    // Standard IMAX should not match IMAX 70mm entries
    if (isStandardImax && describedBy.includes("imax70mm")) continue;

    const id = match[3];
    const time = match[4];
    const amPm = match[5].toUpperCase();

    if (seen.has(id)) continue;
    seen.add(id);

    // Look for sr-only span in the next 250 chars for status
    const afterPos = match.index + match[0].length;
    const afterChunk = html.slice(afterPos, afterPos + 250);
    const srMatch = afterChunk.match(
      /<span[^>]*class="sr-only">([^<]*)<\/span>/i
    );
    const srOnly = srMatch ? srMatch[1].toLowerCase() : "";

    let status: Showtime["status"] = "Sellable";
    if (srOnly.includes("sold out") || srOnly.includes("unavailable")) {
      status = "SoldOut";
    } else if (srOnly.includes("almost full")) {
      status = "AlmostFull";
    }

    showtimes.push({
      id,
      time,
      amPm,
      status,
      url: `https://www.amctheatres.com/showtimes/${id}`,
    });
  }

  // Sort by time (12-hour aware)
  return showtimes.sort((a, b) => {
    const toMins = (s: Showtime) => {
      const [h, m] = s.time.split(":").map(Number);
      const h24 =
        s.amPm === "PM" && h !== 12
          ? h + 12
          : h === 12 && s.amPm === "AM"
          ? 0
          : h;
      return h24 * 60 + (m || 0);
    };
    return toMins(a) - toMins(b);
  });
}

/* -------------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------------- */

/** Check a single date at a specific theater+format (backward-compat defaults). */
export async function checkDate(
  date: string,
  theaterSlug = "amc-lincoln-square-13",
  formatTag = "imax70mm"
): Promise<DateResult> {
  const html = await fetchPage(date, theaterSlug);
  if (!html) {
    return { date, available: false, showtimes: [], error: "Fetch failed" };
  }

  if (!html.includes(MOVIE_SLUG)) {
    return { date, available: false, showtimes: [] };
  }

  if (!html.toLowerCase().includes(formatTag)) {
    return { date, available: false, showtimes: [] };
  }

  const showtimes = extractFormatShowtimes(html, formatTag);
  return {
    date,
    available: showtimes.length > 0,
    showtimes,
  };
}

/** Check all dates for a single theater+format (backward-compat). */
export async function checkAllDates(
  theaterSlug = "amc-lincoln-square-13",
  formatTag = "imax70mm"
): Promise<StatusResult> {
  const results: Record<string, DateResult> = {};

  for (const date of TARGET_DATES) {
    results[date] = await checkDate(date, theaterSlug, formatTag);
    await new Promise((r) => setTimeout(r, 1000));
  }

  return {
    dates: results,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Fan out across all THEATERS × TARGET_DATES, fetching each page ONCE
 * and extracting all FORMATS from the same HTML.
 * Adds 200ms delay between page fetches to avoid hammering AMC.
 */
export async function checkAllTheatersAndFormats(): Promise<MultiStatusResult> {
  const theaterResults: Record<string, TheaterResult> = {};

  for (const theater of THEATERS) {
    theaterResults[theater.slug] = {
      name: theater.name,
      neighborhood: theater.neighborhood,
      formats: {},
    };

    // Initialize format containers
    for (const format of FORMATS) {
      theaterResults[theater.slug].formats[format.tag] = { dates: {} };
    }

    // Fetch each date page ONCE, extract all formats from the same HTML
    for (const date of TARGET_DATES) {
      const html = await fetchPage(date, theater.slug);

      for (const format of FORMATS) {
        const container = theaterResults[theater.slug].formats[format.tag].dates;

        if (!html) {
          container[date] = { date, available: false, showtimes: [], error: "Fetch failed" };
        } else if (!html.includes(MOVIE_SLUG)) {
          container[date] = { date, available: false, showtimes: [] };
        } else if (!html.toLowerCase().includes(format.tag)) {
          container[date] = { date, available: false, showtimes: [] };
        } else {
          const showtimes = extractFormatShowtimes(html, format.tag);
          container[date] = { date, available: showtimes.length > 0, showtimes };
        }
      }

      // Polite delay between page fetches (200ms)
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return {
    theaters: theaterResults,
    checkedAt: new Date().toISOString(),
  };
}
