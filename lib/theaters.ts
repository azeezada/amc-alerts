// Curated AMC theater database by market

export interface TheaterInfo {
  slug: string;
  name: string;
  neighborhood: string;
  hasImax70mm: boolean;
}

export interface Market {
  slug: string;
  name: string;
  state: string;
}

export const MARKETS: Market[] = [
  { slug: "new-york-city", name: "New York City", state: "NY" },
  { slug: "los-angeles", name: "Los Angeles", state: "CA" },
  { slug: "chicago", name: "Chicago", state: "IL" },
  { slug: "san-francisco", name: "San Francisco", state: "CA" },
  { slug: "dallas-fort-worth", name: "Dallas-Fort Worth", state: "TX" },
  { slug: "boston", name: "Boston", state: "MA" },
  { slug: "washington-d-c", name: "Washington D.C.", state: "DC" },
  { slug: "philadelphia", name: "Philadelphia", state: "PA" },
  { slug: "houston", name: "Houston", state: "TX" },
  { slug: "atlanta", name: "Atlanta", state: "GA" },
  { slug: "seattle", name: "Seattle", state: "WA" },
  { slug: "miami", name: "Miami", state: "FL" },
  { slug: "phoenix", name: "Phoenix", state: "AZ" },
  { slug: "denver", name: "Denver", state: "CO" },
];

export const POPULAR_THEATERS: Record<string, TheaterInfo[]> = {
  "new-york-city": [
    { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side", hasImax70mm: true },
    { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Times Square", hasImax70mm: false },
    { slug: "amc-kips-bay-15", name: "AMC Kips Bay 15", neighborhood: "Kips Bay", hasImax70mm: false },
    { slug: "amc-34th-street-14", name: "AMC 34th Street 14", neighborhood: "Herald Square", hasImax70mm: false },
    { slug: "amc-village-7", name: "AMC Village 7", neighborhood: "Greenwich Village", hasImax70mm: false },
    { slug: "amc-84th-street-6", name: "AMC 84th Street 6", neighborhood: "Upper West Side", hasImax70mm: false },
  ],
  "los-angeles": [
    { slug: "amc-century-city-15", name: "AMC Century City 15", neighborhood: "Century City", hasImax70mm: true },
    { slug: "amc-burbank-16", name: "AMC Burbank 16", neighborhood: "Burbank", hasImax70mm: false },
    { slug: "amc-grove-14", name: "AMC The Grove 14", neighborhood: "The Grove", hasImax70mm: false },
    { slug: "amc-santa-monica-7", name: "AMC Santa Monica 7", neighborhood: "Santa Monica", hasImax70mm: false },
    { slug: "amc-universal-citywalk-stadium-19", name: "AMC Universal CityWalk 19", neighborhood: "Universal City", hasImax70mm: true },
  ],
  "chicago": [
    { slug: "amc-river-east-21", name: "AMC River East 21", neighborhood: "Streeterville", hasImax70mm: false },
    { slug: "amc-navy-pier-imax", name: "AMC Navy Pier IMAX", neighborhood: "Navy Pier", hasImax70mm: true },
    { slug: "amc-block-37", name: "AMC Block 37", neighborhood: "Loop", hasImax70mm: false },
  ],
  "san-francisco": [
    { slug: "amc-metreon-16", name: "AMC Metreon 16", neighborhood: "SoMa", hasImax70mm: true },
    { slug: "amc-kabuki-8", name: "AMC Kabuki 8", neighborhood: "Japantown", hasImax70mm: false },
  ],
  "dallas-fort-worth": [
    { slug: "amc-northpark-15", name: "AMC NorthPark 15", neighborhood: "NorthPark", hasImax70mm: true },
    { slug: "amc-grapevine-mills-30", name: "AMC Grapevine Mills 30", neighborhood: "Grapevine", hasImax70mm: false },
  ],
  "boston": [
    { slug: "amc-boston-common-19", name: "AMC Boston Common 19", neighborhood: "Boston Common", hasImax70mm: true },
    { slug: "amc-assembly-row-12", name: "AMC Assembly Row 12", neighborhood: "Somerville", hasImax70mm: false },
  ],
  "washington-d-c": [
    { slug: "amc-georgetown-14", name: "AMC Georgetown 14", neighborhood: "Georgetown", hasImax70mm: false },
    { slug: "amc-tysons-corner-16", name: "AMC Tysons Corner 16", neighborhood: "Tysons Corner", hasImax70mm: true },
  ],
  "philadelphia": [
    { slug: "amc-cherry-hill-24", name: "AMC Cherry Hill 24", neighborhood: "Cherry Hill", hasImax70mm: false },
    { slug: "amc-neshaminy-24", name: "AMC Neshaminy 24", neighborhood: "Bensalem", hasImax70mm: false },
  ],
  "houston": [
    { slug: "amc-gulf-pointe-30", name: "AMC Gulf Pointe 30", neighborhood: "South Houston", hasImax70mm: true },
    { slug: "amc-studio-30", name: "AMC Studio 30", neighborhood: "Dunvale", hasImax70mm: false },
  ],
  "atlanta": [
    { slug: "amc-phipps-plaza-14", name: "AMC Phipps Plaza 14", neighborhood: "Buckhead", hasImax70mm: false },
    { slug: "amc-southlake-24", name: "AMC Southlake 24", neighborhood: "Morrow", hasImax70mm: false },
  ],
  "seattle": [
    { slug: "amc-pacific-place-11", name: "AMC Pacific Place 11", neighborhood: "Downtown", hasImax70mm: false },
    { slug: "amc-seattle-10", name: "AMC Seattle 10", neighborhood: "Downtown", hasImax70mm: false },
  ],
  "miami": [
    { slug: "amc-aventura-24", name: "AMC Aventura 24", neighborhood: "Aventura", hasImax70mm: true },
    { slug: "amc-sunset-place-24", name: "AMC Sunset Place 24", neighborhood: "South Miami", hasImax70mm: false },
  ],
  "phoenix": [
    { slug: "amc-arizona-center-24", name: "AMC Arizona Center 24", neighborhood: "Downtown", hasImax70mm: false },
    { slug: "amc-esplanade-14", name: "AMC Esplanade 14", neighborhood: "Phoenix", hasImax70mm: false },
  ],
  "denver": [
    { slug: "amc-flatiron-crossing-14", name: "AMC Flatiron Crossing 14", neighborhood: "Broomfield", hasImax70mm: false },
    { slug: "amc-westminster-promenade-24", name: "AMC Westminster 24", neighborhood: "Westminster", hasImax70mm: false },
  ],
};

/** Search theaters across all markets by name query */
export function searchTheaters(query: string, marketSlug?: string): TheaterInfo[] {
  const q = query.toLowerCase();
  const markets = marketSlug ? [marketSlug] : Object.keys(POPULAR_THEATERS);

  const results: TheaterInfo[] = [];
  for (const market of markets) {
    const theaters = POPULAR_THEATERS[market];
    if (!theaters) continue;
    for (const t of theaters) {
      if (
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.neighborhood.toLowerCase().includes(q)
      ) {
        results.push(t);
      }
    }
  }
  return results;
}

/** Get market slug for a theater */
export function getMarketForTheater(theaterSlug: string): string | null {
  for (const [market, theaters] of Object.entries(POPULAR_THEATERS)) {
    if (theaters.some((t) => t.slug === theaterSlug)) return market;
  }
  return null;
}
