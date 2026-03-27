// Curated competitor theater database — Regal and Cinemark by market

export type Chain = "regal" | "cinemark";

export interface CompetitorTheater {
  id: string; // unique slug within this file
  chain: Chain;
  name: string;
  neighborhood: string;
  address: string;
  /** Formats available at this location */
  formats: string[]; // e.g. ["rpx", "dolby-atmos", "imax", "standard"]
  /** Base URL for this theater's showtimes page */
  theaterUrl: string;
  /** Regal theater ID (numeric string) or Cinemark theater URL slug */
  chainTheaterId: string;
}

export interface CompetitorMarket {
  slug: string;
  name: string;
  theaters: CompetitorTheater[];
}

// ---------------------------------------------------------------------------
// Theater data
// ---------------------------------------------------------------------------

export const COMPETITOR_THEATERS: Record<string, CompetitorTheater[]> = {
  "new-york-city": [
    {
      id: "regal-union-square",
      chain: "regal",
      name: "Regal Union Square",
      neighborhood: "Union Square",
      address: "850 Broadway, New York, NY 10003",
      formats: ["rpx", "4dx", "screenx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-union-square/1022",
      chainTheaterId: "1022",
    },
    {
      id: "regal-battery-park",
      chain: "regal",
      name: "Regal Battery Park",
      neighborhood: "Battery Park City",
      address: "102 North End Ave, New York, NY 10282",
      formats: ["rpx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-battery-park/1076",
      chainTheaterId: "1076",
    },
    {
      id: "cinemark-84th-street",
      chain: "cinemark",
      name: "Cinemark 84th Street",
      neighborhood: "Upper West Side",
      address: "2310 Broadway, New York, NY 10024",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/1064-cinemark-84th-street",
      chainTheaterId: "1064-cinemark-84th-street",
    },
  ],
  "los-angeles": [
    {
      id: "regal-la-live",
      chain: "regal",
      name: "Regal LA Live & 4DX",
      neighborhood: "Downtown LA",
      address: "1000 W Olympic Blvd, Los Angeles, CA 90015",
      formats: ["4dx", "rpx", "screenx", "imax", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-la-live-4dx/6233",
      chainTheaterId: "6233",
    },
    {
      id: "cinemark-century-stadium-25",
      chain: "cinemark",
      name: "Cinemark Century Stadium 25",
      neighborhood: "Orange",
      address: "20 City Blvd W, Orange, CA 92868",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/849-cinemark-century-stadium-25-and-xd",
      chainTheaterId: "849-cinemark-century-stadium-25-and-xd",
    },
    {
      id: "regal-edwards-westpark",
      chain: "regal",
      name: "Regal Edwards West Oaks",
      neighborhood: "Thousand Oaks",
      address: "195 Thousand Oaks Blvd, Thousand Oaks, CA 91360",
      formats: ["rpx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-edwards-thousand-oaks/1002",
      chainTheaterId: "1002",
    },
  ],
  "chicago": [
    {
      id: "regal-city-north",
      chain: "regal",
      name: "Regal City North 14 & IMAX",
      neighborhood: "Rogers Park",
      address: "2600 N Western Ave, Chicago, IL 60647",
      formats: ["imax", "4dx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-city-north-14-imax/2858",
      chainTheaterId: "2858",
    },
    {
      id: "cinemark-chicago",
      chain: "cinemark",
      name: "Cinemark Chicago 62",
      neighborhood: "Galewood",
      address: "7901 W North Ave, Elmwood Park, IL 60707",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/3354-cinemark-chicago-62-and-xd",
      chainTheaterId: "3354-cinemark-chicago-62-and-xd",
    },
  ],
  "san-francisco": [
    {
      id: "regal-hilltop",
      chain: "regal",
      name: "Regal Hilltop 9",
      neighborhood: "Richmond",
      address: "2200 Hilltop Mall Rd, Richmond, CA 94806",
      formats: ["rpx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-hilltop/1010",
      chainTheaterId: "1010",
    },
    {
      id: "cinemark-century-20-daly-city",
      chain: "cinemark",
      name: "Cinemark Century 20 Daly City",
      neighborhood: "Daly City",
      address: "303 Gellert Blvd, Daly City, CA 94015",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/685-century-20-daly-city-and-xd",
      chainTheaterId: "685-century-20-daly-city-and-xd",
    },
  ],
  "dallas-fort-worth": [
    {
      id: "cinemark-legacy-plano",
      chain: "cinemark",
      name: "Cinemark Legacy & XD",
      neighborhood: "Plano",
      address: "7201 Dallas Pkwy, Plano, TX 75024",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/478-cinemark-legacy-and-xd",
      chainTheaterId: "478-cinemark-legacy-and-xd",
    },
    {
      id: "cinemark-west-plano",
      chain: "cinemark",
      name: "Cinemark West Plano & XD",
      neighborhood: "West Plano",
      address: "3800 Dallas Pkwy, Plano, TX 75093",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/3459-cinemark-west-plano-and-xd",
      chainTheaterId: "3459-cinemark-west-plano-and-xd",
    },
  ],
  "boston": [
    {
      id: "regal-fenway-13",
      chain: "regal",
      name: "Regal Fenway & RPX",
      neighborhood: "Fenway",
      address: "201 Brookline Ave, Boston, MA 02215",
      formats: ["rpx", "4dx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-fenway-rpx/6121",
      chainTheaterId: "6121",
    },
    {
      id: "cinemark-north-shore",
      chain: "cinemark",
      name: "Cinemark North Shore & XD",
      neighborhood: "Peabody",
      address: "210 Andover St, Peabody, MA 01960",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/3268-cinemark-north-shore-and-xd",
      chainTheaterId: "3268-cinemark-north-shore-and-xd",
    },
  ],
  "washington-d-c": [
    {
      id: "regal-majestic",
      chain: "regal",
      name: "Regal Majestic & RPX",
      neighborhood: "Silver Spring",
      address: "900 Ellsworth Dr, Silver Spring, MD 20910",
      formats: ["rpx", "standard"],
      theaterUrl: "https://www.regmovies.com/theatres/regal-majestic-rpx/2032",
      chainTheaterId: "2032",
    },
    {
      id: "cinemark-fairfax-corner",
      chain: "cinemark",
      name: "Cinemark Fairfax Corner & XD",
      neighborhood: "Fairfax",
      address: "11901 Grand Commons Ave, Fairfax, VA 22030",
      formats: ["xd", "standard"],
      theaterUrl: "https://www.cinemark.com/theatre/3439-cinemark-fairfax-corner-and-xd",
      chainTheaterId: "3439-cinemark-fairfax-corner-and-xd",
    },
  ],
};

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Build a direct showtime search URL for a Regal theater for a given movie title
 * and optional date.
 */
export function buildRegalShowtimeUrl(theater: CompetitorTheater, movieTitle: string, date?: string): string {
  const encodedTitle = encodeURIComponent(movieTitle);
  const base = `${theater.theaterUrl}/showtimes`;
  if (date) {
    return `${base}?date=${date}&query=${encodedTitle}`;
  }
  return `${base}?query=${encodedTitle}`;
}

/**
 * Build a direct showtime URL for a Cinemark theater for a given movie title
 * and optional date. Cinemark's URLs don't embed movie slugs cleanly, so we
 * link to the theater page with a search query.
 */
export function buildCinemarkShowtimeUrl(theater: CompetitorTheater, movieTitle: string, date?: string): string {
  const encodedTitle = encodeURIComponent(movieTitle);
  const base = theater.theaterUrl;
  if (date) {
    return `${base}/movies?date=${date}&q=${encodedTitle}`;
  }
  return `${base}/movies?q=${encodedTitle}`;
}

/**
 * Build a showtime URL for any competitor theater.
 */
export function buildCompetitorShowtimeUrl(
  theater: CompetitorTheater,
  movieTitle: string,
  date?: string
): string {
  if (theater.chain === "regal") {
    return buildRegalShowtimeUrl(theater, movieTitle, date);
  }
  return buildCinemarkShowtimeUrl(theater, movieTitle, date);
}

/**
 * Return competitor theaters for a given market slug.
 */
export function getCompetitorsForMarket(marketSlug: string): CompetitorTheater[] {
  return COMPETITOR_THEATERS[marketSlug] ?? [];
}

/** Format label lookup for display */
export const FORMAT_LABELS: Record<string, string> = {
  rpx: "Regal Premium Experience",
  "4dx": "4DX",
  screenx: "ScreenX",
  xd: "Cinemark XD",
  imax: "IMAX",
  "dolby-atmos": "Dolby Atmos",
  standard: "Standard",
};
