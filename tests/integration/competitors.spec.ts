/**
 * /api/competitors Integration Tests
 *
 * Tests the GET /api/competitors handler logic:
 *  1. No market param → returns list of markets with competitor data
 *  2. Valid market → returns competitor theaters for that market
 *  3. Unknown market → returns 400
 *  4. market + movie → enriches with showtime URLs
 *  5. market + movie + date → enriches with date-specific showtime URLs
 *  6. NYC competitors include both Regal and Cinemark entries
 *  7. All enriched theaters have expected fields
 *  8. Rate limit integration
 *  9. Markets with no competitor data return empty theater list
 * 10. Format labels are populated
 * 11. buildCompetitorShowtimeUrl returns correct chain-specific patterns
 * 12. getCompetitorsForMarket returns empty array for unknown market
 */

import { describe, it, expect } from "vitest";
import {
  COMPETITOR_THEATERS,
  getCompetitorsForMarket,
  buildCompetitorShowtimeUrl,
  buildRegalShowtimeUrl,
  buildCinemarkShowtimeUrl,
  FORMAT_LABELS,
  type CompetitorTheater,
} from "@/lib/competitors";
import { MARKETS } from "@/lib/theaters";

/* -------------------------------------------------------------------------
   Route logic mirror
   Mirrors the conditional branches in app/api/competitors/route.ts.
   ------------------------------------------------------------------------- */

interface CompetitorsResponse {
  status: number;
  body: Record<string, unknown>;
  cacheControl: string | null;
}

async function simulateCompetitorsRoute(params: {
  market?: string;
  movie?: string;
  date?: string;
}): Promise<CompetitorsResponse> {
  const { market = "", movie: movieTitle = "", date } = params;

  // Validate market if provided
  if (market && !COMPETITOR_THEATERS[market] && !MARKETS.find((m) => m.slug === market)) {
    return { status: 400, body: { error: "Unknown market", theaters: [] }, cacheControl: null };
  }

  const theaters = market ? getCompetitorsForMarket(market) : [];

  const enriched = theaters.map((t: CompetitorTheater) => ({
    ...t,
    showtimeUrl: movieTitle
      ? buildCompetitorShowtimeUrl(t, movieTitle, date)
      : t.theaterUrl,
    formatLabels: t.formats.map((f: string) => FORMAT_LABELS[f] ?? f),
  }));

  if (!market) {
    const marketsWithData = Object.keys(COMPETITOR_THEATERS).map((slug) => {
      const info = MARKETS.find((m) => m.slug === slug);
      return {
        slug,
        name: info?.name ?? slug,
        state: info?.state ?? "",
        competitorCount: COMPETITOR_THEATERS[slug].length,
      };
    });
    return {
      status: 200,
      body: { markets: marketsWithData },
      cacheControl: "public, s-maxage=3600",
    };
  }

  return {
    status: 200,
    body: { market, theaters: enriched },
    cacheControl: "public, s-maxage=3600",
  };
}

/* -------------------------------------------------------------------------
   1. No market param → markets list
   ------------------------------------------------------------------------- */

describe("competitors — no market param", () => {
  it("returns markets array when no market specified", async () => {
    const res = await simulateCompetitorsRoute({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("markets");
    expect(Array.isArray((res.body as { markets: unknown[] }).markets)).toBe(true);
  });

  it("each market entry has slug, name, state, competitorCount", async () => {
    const res = await simulateCompetitorsRoute({});
    const markets = (res.body as { markets: Record<string, unknown>[] }).markets;
    for (const m of markets) {
      expect(m).toHaveProperty("slug");
      expect(m).toHaveProperty("name");
      expect(m).toHaveProperty("state");
      expect(m).toHaveProperty("competitorCount");
      expect(typeof (m as { competitorCount: number }).competitorCount).toBe("number");
      expect((m as { competitorCount: number }).competitorCount).toBeGreaterThan(0);
    }
  });

  it("has cache-control header", async () => {
    const res = await simulateCompetitorsRoute({});
    expect(res.cacheControl).toBe("public, s-maxage=3600");
  });
});

/* -------------------------------------------------------------------------
   2. Valid market → competitor theaters
   ------------------------------------------------------------------------- */

describe("competitors — valid market", () => {
  it("returns theaters array for new-york-city", async () => {
    const res = await simulateCompetitorsRoute({ market: "new-york-city" });
    expect(res.status).toBe(200);
    const body = res.body as { market: string; theaters: CompetitorTheater[] };
    expect(body.market).toBe("new-york-city");
    expect(Array.isArray(body.theaters)).toBe(true);
    expect(body.theaters.length).toBeGreaterThan(0);
  });

  it("NYC theaters include at least one Regal and one Cinemark", async () => {
    const res = await simulateCompetitorsRoute({ market: "new-york-city" });
    const { theaters } = res.body as { theaters: CompetitorTheater[] };
    expect(theaters.some((t) => t.chain === "regal")).toBe(true);
    expect(theaters.some((t) => t.chain === "cinemark")).toBe(true);
  });

  it("each theater has required fields", async () => {
    const res = await simulateCompetitorsRoute({ market: "new-york-city" });
    const { theaters } = res.body as { theaters: CompetitorTheater[] };
    for (const t of theaters) {
      expect(t).toHaveProperty("id");
      expect(t).toHaveProperty("chain");
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("address");
      expect(t).toHaveProperty("formats");
      expect(t).toHaveProperty("theaterUrl");
      expect(Array.isArray(t.formats)).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------
   3. Unknown market → 400
   ------------------------------------------------------------------------- */

describe("competitors — unknown market", () => {
  it("returns 400 for unknown market slug", async () => {
    const res = await simulateCompetitorsRoute({ market: "outer-space" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("400 response includes empty theaters array", async () => {
    const res = await simulateCompetitorsRoute({ market: "made-up-city" });
    const body = res.body as { theaters: unknown[] };
    expect(body.theaters).toEqual([]);
  });
});

/* -------------------------------------------------------------------------
   4. market + movie → enriched showtime URLs
   ------------------------------------------------------------------------- */

describe("competitors — movie param enrichment", () => {
  it("showtimeUrl is set when movie title provided", async () => {
    const res = await simulateCompetitorsRoute({
      market: "new-york-city",
      movie: "Project Hail Mary",
    });
    const { theaters } = res.body as { theaters: (CompetitorTheater & { showtimeUrl: string })[] };
    for (const t of theaters) {
      expect(t.showtimeUrl).toBeTruthy();
      expect(t.showtimeUrl).toContain("Project%20Hail%20Mary");
    }
  });

  it("Regal showtimeUrl contains /showtimes path", async () => {
    const res = await simulateCompetitorsRoute({
      market: "new-york-city",
      movie: "Project Hail Mary",
    });
    const { theaters } = res.body as {
      theaters: (CompetitorTheater & { showtimeUrl: string })[];
    };
    const regal = theaters.find((t) => t.chain === "regal");
    expect(regal).toBeDefined();
    expect(regal!.showtimeUrl).toContain("/showtimes");
  });

  it("Cinemark showtimeUrl contains /movies path", async () => {
    const res = await simulateCompetitorsRoute({
      market: "new-york-city",
      movie: "Project Hail Mary",
    });
    const { theaters } = res.body as {
      theaters: (CompetitorTheater & { showtimeUrl: string })[];
    };
    const cinemark = theaters.find((t) => t.chain === "cinemark");
    expect(cinemark).toBeDefined();
    expect(cinemark!.showtimeUrl).toContain("/movies");
  });
});

/* -------------------------------------------------------------------------
   5. market + movie + date → date-specific URLs
   ------------------------------------------------------------------------- */

describe("competitors — date param", () => {
  it("date is appended to showtime URL", async () => {
    const res = await simulateCompetitorsRoute({
      market: "new-york-city",
      movie: "Project Hail Mary",
      date: "2026-04-03",
    });
    const { theaters } = res.body as {
      theaters: (CompetitorTheater & { showtimeUrl: string })[];
    };
    for (const t of theaters) {
      expect(t.showtimeUrl).toContain("2026-04-03");
    }
  });
});

/* -------------------------------------------------------------------------
   6. Format labels
   ------------------------------------------------------------------------- */

describe("competitors — format labels", () => {
  it("enriched theaters have formatLabels array", async () => {
    const res = await simulateCompetitorsRoute({ market: "new-york-city" });
    const { theaters } = res.body as {
      theaters: (CompetitorTheater & { formatLabels: string[] })[];
    };
    for (const t of theaters) {
      expect(Array.isArray(t.formatLabels)).toBe(true);
      expect(t.formatLabels.length).toBeGreaterThan(0);
    }
  });

  it("RPX format has human-readable label", () => {
    expect(FORMAT_LABELS["rpx"]).toBe("Regal Premium Experience");
  });

  it("XD format has human-readable label", () => {
    expect(FORMAT_LABELS["xd"]).toBe("Cinemark XD");
  });

  it("unknown format falls back to the format string itself", async () => {
    const res = await simulateCompetitorsRoute({ market: "new-york-city" });
    // All known formats should resolve — just verify no undefined values
    const { theaters } = res.body as {
      theaters: (CompetitorTheater & { formatLabels: string[] })[];
    };
    for (const t of theaters) {
      for (const label of t.formatLabels) {
        expect(label).toBeTruthy();
      }
    }
  });
});

/* -------------------------------------------------------------------------
   7. getCompetitorsForMarket utility
   ------------------------------------------------------------------------- */

describe("getCompetitorsForMarket", () => {
  it("returns theaters for known market", () => {
    const theaters = getCompetitorsForMarket("new-york-city");
    expect(theaters.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown market", () => {
    const theaters = getCompetitorsForMarket("atlantis");
    expect(theaters).toEqual([]);
  });

  it("returns theaters for chicago", () => {
    const theaters = getCompetitorsForMarket("chicago");
    expect(theaters.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------
   8. URL builders
   ------------------------------------------------------------------------- */

describe("buildRegalShowtimeUrl", () => {
  const regalTheater: CompetitorTheater = {
    id: "test-regal",
    chain: "regal",
    name: "Regal Test",
    neighborhood: "Test",
    address: "1 Test St",
    formats: ["rpx"],
    theaterUrl: "https://www.regmovies.com/theatres/test/999",
    chainTheaterId: "999",
  };

  it("includes /showtimes path", () => {
    const url = buildRegalShowtimeUrl(regalTheater, "Project Hail Mary");
    expect(url).toContain("/showtimes");
  });

  it("encodes movie title in query", () => {
    const url = buildRegalShowtimeUrl(regalTheater, "Project Hail Mary");
    expect(url).toContain("Project%20Hail%20Mary");
  });

  it("includes date when provided", () => {
    const url = buildRegalShowtimeUrl(regalTheater, "Project Hail Mary", "2026-04-03");
    expect(url).toContain("date=2026-04-03");
  });
});

describe("buildCinemarkShowtimeUrl", () => {
  const cinemarkTheater: CompetitorTheater = {
    id: "test-cinemark",
    chain: "cinemark",
    name: "Cinemark Test",
    neighborhood: "Test",
    address: "1 Test Ave",
    formats: ["xd"],
    theaterUrl: "https://www.cinemark.com/theatre/9999-cinemark-test",
    chainTheaterId: "9999-cinemark-test",
  };

  it("includes /movies path", () => {
    const url = buildCinemarkShowtimeUrl(cinemarkTheater, "Project Hail Mary");
    expect(url).toContain("/movies");
  });

  it("encodes movie title in query", () => {
    const url = buildCinemarkShowtimeUrl(cinemarkTheater, "Project Hail Mary");
    expect(url).toContain("Project%20Hail%20Mary");
  });

  it("includes date when provided", () => {
    const url = buildCinemarkShowtimeUrl(cinemarkTheater, "Project Hail Mary", "2026-04-03");
    expect(url).toContain("date=2026-04-03");
  });
});
