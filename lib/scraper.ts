// AMC Showtime Scraper — multi-theater, multi-format
// Uses AMC SSR HTML parsing — confirmed working via research

import { getMarketForTheater } from "@/lib/theaters";

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

export interface MovieInfo {
  slug: string;
  title: string;
  formats: string[];
  poster?: string;
  description?: string;
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

const DEFAULT_MARKET_SLUG = "new-york-city";
export const DEFAULT_MOVIE_SLUG = "project-hail-mary-76779";

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

/**
 * Format a Date as YYYY-MM-DD using local time (not UTC).
 * Using toISOString().split("T")[0] is a common mistake — it converts to
 * UTC first, so 11:30 PM EST becomes the next day's date.
 */
export function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Generate an array of YYYY-MM-DD strings from start to end (inclusive).
 */
export function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  while (s <= e) {
    dates.push(toDateStr(s));
    s.setDate(s.getDate() + 1);
  }
  return dates;
}

/* -------------------------------------------------------------------------
   Fetch
   ------------------------------------------------------------------------- */

export async function fetchPage(date: string, theaterSlug: string, marketSlug?: string): Promise<string | null> {
  const market = marketSlug || getMarketForTheater(theaterSlug) || DEFAULT_MARKET_SLUG;
  const url = `https://www.amctheatres.com/movie-theatres/${market}/${theaterSlug}/showtimes?date=${date}`;
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
 */
export function extractFormatShowtimes(html: string, formatTag: string): Showtime[] {
  const showtimes: Showtime[] = [];
  const seen = new Set<string>();
  const isStandardImax = formatTag === "imax";

  const anchorRegex =
    /<a[^>]+aria-describedby="([^"]*)"[^>]*id="(\d+)"[^>]*href="\/showtimes\/(\d+)"[^>]*>([\d:]+)<!--\s*-->(am|pm)/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const describedBy = match[1].toLowerCase();

    if (!describedBy.includes(formatTag)) continue;
    if (isStandardImax && describedBy.includes("imax70mm")) continue;

    const id = match[3];
    const time = match[4];
    const amPm = match[5].toUpperCase();

    if (seen.has(id)) continue;
    seen.add(id);

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

/**
 * Extract the HTML slice that belongs to a specific movie's section.
 *
 * AMC showtimes pages render multiple movies sequentially. Each movie section
 * begins where its `/movies/{slug}` link first appears and ends just before
 * the next *different* movie's link. Scoping to this slice prevents showtime
 * anchors from other movies (which may share the same format tag) from being
 * included in results for the wrong movie.
 *
 * Returns null if the movie slug is not found in the HTML.
 */
export function extractMovieSection(html: string, movieSlug: string): string | null {
  const movieLinkRegex = /href="\/movies\/([a-z0-9-]+)"/gi;

  interface Occurrence { slug: string; index: number }
  const occurrences: Occurrence[] = [];
  let m: RegExpExecArray | null;
  while ((m = movieLinkRegex.exec(html)) !== null) {
    occurrences.push({ slug: m[1], index: m.index });
  }

  // Find the first occurrence of our target movie
  const firstTarget = occurrences.find((o) => o.slug === movieSlug);
  if (!firstTarget) return null;

  const sectionStart = firstTarget.index;

  // Section ends just before the first *different* movie link that appears
  // after our section starts.
  let sectionEnd = html.length;
  for (const occ of occurrences) {
    if (occ.index > sectionStart && occ.slug !== movieSlug) {
      sectionEnd = occ.index;
      break;
    }
  }

  return html.slice(sectionStart, sectionEnd);
}

/**
 * Extract ALL movies from an AMC showtimes page.
 * AMC pages have movie sections with links like /movies/{slug}
 */
export function extractMoviesFromPage(html: string): MovieInfo[] {
  const movies: MovieInfo[] = [];
  const seen = new Set<string>();

  const movieLinkRegex = /<a[^>]*href="\/movies\/([a-z0-9-]+)"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = movieLinkRegex.exec(html)) !== null) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    seen.add(slug);

    const title = match[2].trim();
    if (!title || title.length < 2) continue;

    // Find formats by scanning nearby HTML
    const sectionStart = Math.max(0, match.index - 500);
    const sectionEnd = Math.min(html.length, match.index + 5000);
    const section = html.slice(sectionStart, sectionEnd).toLowerCase();

    const formats: string[] = [];
    if (section.includes("imax70mm")) formats.push("imax70mm");
    if (section.includes("dolbycinema")) formats.push("dolbycinema");
    if (section.includes("imax") && !formats.includes("imax70mm")) formats.push("imax");
    if (formats.includes("imax70mm")) {
      const imaxMatches = section.match(/imax(?!70mm)/g);
      if (imaxMatches && imaxMatches.length > 0) formats.push("imax");
    }
    if (formats.length === 0) formats.push("standard");

    movies.push({ slug, title, formats });
  }

  return movies;
}

/* -------------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------------- */

/** Check a single date at a specific theater+format. */
export async function checkDate(
  date: string,
  theaterSlug = "amc-lincoln-square-13",
  formatTag = "imax70mm",
  movieSlug = DEFAULT_MOVIE_SLUG
): Promise<DateResult> {
  const html = await fetchPage(date, theaterSlug);
  if (!html) {
    return { date, available: false, showtimes: [], error: "Fetch failed" };
  }

  // Scope to the target movie's section to avoid mixing showtimes from other movies.
  const section = extractMovieSection(html, movieSlug);
  if (!section) {
    return { date, available: false, showtimes: [] };
  }

  if (!section.toLowerCase().includes(formatTag)) {
    return { date, available: false, showtimes: [] };
  }

  const showtimes = extractFormatShowtimes(section, formatTag);
  return {
    date,
    available: showtimes.length > 0,
    showtimes,
  };
}

/**
 * Fan out across theaters × dates, fetching each page ONCE
 * and extracting all formats from the same HTML.
 * Now accepts optional parameters for dynamic usage.
 */
export async function checkAllTheatersAndFormats(opts?: {
  theaters?: { slug: string; name: string; neighborhood: string }[];
  dates?: string[];
  movieSlug?: string;
  formats?: { tag: string; label: string; priority: number }[];
}): Promise<MultiStatusResult> {
  const theaterList = opts?.theaters || THEATERS;
  const dateList = opts?.dates || TARGET_DATES;
  const movieSlug = opts?.movieSlug || DEFAULT_MOVIE_SLUG;
  const formatList = opts?.formats || FORMATS;

  const theaterResults: Record<string, TheaterResult> = {};

  for (const theater of theaterList) {
    theaterResults[theater.slug] = {
      name: theater.name,
      neighborhood: theater.neighborhood,
      formats: {},
    };

    for (const format of formatList) {
      theaterResults[theater.slug].formats[format.tag] = { dates: {} };
    }

    for (const date of dateList) {
      const html = await fetchPage(date, theater.slug);

      for (const format of formatList) {
        const container = theaterResults[theater.slug].formats[format.tag].dates;

        if (!html) {
          container[date] = { date, available: false, showtimes: [], error: "Fetch failed" };
        } else {
          // Scope to the target movie's section so we never return another
          // movie's showtimes even when they share the same format tag.
          const section = extractMovieSection(html, movieSlug);
          if (!section || !section.toLowerCase().includes(format.tag)) {
            container[date] = { date, available: false, showtimes: [] };
          } else {
            const showtimes = extractFormatShowtimes(section, format.tag);
            container[date] = { date, available: showtimes.length > 0, showtimes };
          }
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return {
    theaters: theaterResults,
    checkedAt: new Date().toISOString(),
  };
}
