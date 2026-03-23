// AMC IMAX 70mm Showtime Scraper
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

const THEATER_SLUG = "amc-lincoln-square-13";
const MARKET_SLUG = "new-york-city";
const FORMAT_TAG = "imax70mm";
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

async function fetchPage(date: string): Promise<string | null> {
  const url = `https://www.amctheatres.com/movie-theatres/${MARKET_SLUG}/${THEATER_SLUG}/showtimes?date=${date}`;
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
      console.error(`HTTP ${resp.status} for ${date}`);
      return null;
    }
    return await resp.text();
  } catch (e) {
    console.error(`Fetch error for ${date}:`, e);
    return null;
  }
}

/**
 * Parse IMAX 70mm showtimes from AMC's SSR HTML.
 *
 * The HTML contains anchor tags like:
 *   <a aria-describedby="...imax70mm..." id="140840268" href="/showtimes/140840268">
 *     11:00<!-- -->am<!-- --> <span class="sr-only">UP TO 15% OFF, Almost Full</span>
 *   </a>
 *
 * Status is derived from the sr-only span text.
 */
function extractImax70mmShowtimes(html: string): Showtime[] {
  const showtimes: Showtime[] = [];
  const seen = new Set<string>();

  // Match anchor tags that have imax70mm in their aria-describedby
  const anchorRegex =
    /<a[^>]+aria-describedby="([^"]*imax70mm[^"]*)"[^>]*id="(\d+)"[^>]*href="\/showtimes\/(\d+)"[^>]*>([\d:]+)<!--\s*-->(am|pm)/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const id = match[3];
    const time = match[4];
    const amPm = match[5].toUpperCase();

    if (seen.has(id)) continue;
    seen.add(id);

    // Look for sr-only span in the next 200 chars for status
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

export async function checkDate(date: string): Promise<DateResult> {
  const html = await fetchPage(date);
  if (!html) {
    return { date, available: false, showtimes: [], error: "Fetch failed" };
  }

  if (!html.includes(MOVIE_SLUG)) {
    return { date, available: false, showtimes: [] };
  }

  if (!html.toLowerCase().includes(FORMAT_TAG)) {
    return { date, available: false, showtimes: [] };
  }

  const showtimes = extractImax70mmShowtimes(html);
  return {
    date,
    available: showtimes.length > 0,
    showtimes,
  };
}

export async function checkAllDates(): Promise<StatusResult> {
  const results: Record<string, DateResult> = {};

  for (const date of TARGET_DATES) {
    results[date] = await checkDate(date);
    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  return {
    dates: results,
    checkedAt: new Date().toISOString(),
  };
}
