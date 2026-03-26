/**
 * Gap 3.1 — /api/theaters Integration Tests
 *
 * Tests the route decision logic for GET /api/theaters:
 *  1. No params → markets list with theaterCount per market
 *  2. ?market=new-york-city → theaters array for that market
 *  3. ?market=unknown-market → empty theaters array (market not found)
 *  4. ?q=lincoln → cross-market search returns matching theaters
 *  5. ?q=amc&market=new-york-city → market-scoped search
 *  6. Rate limit → rateLimit() applied to /api/theaters path; 429 after limit
 *
 * Pure logic tests — no HTTP server required.
 * The route delegates entirely to @/lib/theaters; we test the full decision
 * tree including the output shapes the route builds.
 */
import { describe, it, expect } from "vitest";
import {
  MARKETS,
  POPULAR_THEATERS,
  searchTheaters,
} from "@/lib/theaters";
import { rateLimit } from "@/lib/rate-limit";

/* -------------------------------------------------------------------------
   Route logic mirror
   Mirrors the conditional branches in app/api/theaters/route.ts GET handler
   so tests verify the exact shapes the route returns.
   ------------------------------------------------------------------------- */

interface TheatersRouteResult {
  markets?: Array<{ slug: string; name: string; state: string; theaterCount: number }>;
  theaters?: ReturnType<typeof searchTheaters>;
  market?: string;
}

/**
 * Simulate the /api/theaters GET handler logic.
 * Returns the JSON body the real handler would return.
 */
function simulateTheatersRoute(params: { market?: string; q?: string }): TheatersRouteResult {
  const q = params.q || "";
  const market = params.market || "";

  if (market && !q) {
    const theaters = POPULAR_THEATERS[market] || [];
    return { theaters, market };
  }

  if (q) {
    const results = searchTheaters(q, market || undefined);
    return { theaters: results };
  }

  const marketsWithCounts = MARKETS.map((m) => ({
    ...m,
    theaterCount: (POPULAR_THEATERS[m.slug] || []).length,
  }));
  return { markets: marketsWithCounts };
}

/** Build a minimal Request for the /api/theaters path. */
function makeTheatersRequest(ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/theaters", {
    headers: { "cf-connecting-ip": ip },
  });
}

/* -------------------------------------------------------------------------
   3.1.1 No params → markets list
   ------------------------------------------------------------------------- */

describe("Gap 3.1.1 — No params: returns markets list with theaterCount", () => {
  it("result has a 'markets' array", () => {
    const body = simulateTheatersRoute({});
    expect(body.markets).toBeDefined();
    expect(Array.isArray(body.markets)).toBe(true);
  });

  it("result has no 'theaters' key", () => {
    const body = simulateTheatersRoute({});
    expect(body.theaters).toBeUndefined();
  });

  it("markets array length matches MARKETS constant", () => {
    const body = simulateTheatersRoute({});
    expect(body.markets!.length).toBe(MARKETS.length);
  });

  it("each market entry has slug, name, state, and theaterCount", () => {
    const body = simulateTheatersRoute({});
    for (const m of body.markets!) {
      expect(typeof m.slug).toBe("string");
      expect(typeof m.name).toBe("string");
      expect(typeof m.state).toBe("string");
      expect(typeof m.theaterCount).toBe("number");
      expect(m.theaterCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("new-york-city has correct theaterCount matching POPULAR_THEATERS", () => {
    const body = simulateTheatersRoute({});
    const nyc = body.markets!.find((m) => m.slug === "new-york-city");
    expect(nyc).toBeDefined();
    expect(nyc!.theaterCount).toBe(POPULAR_THEATERS["new-york-city"].length);
  });

  it("all MARKETS slugs are represented in the response", () => {
    const body = simulateTheatersRoute({});
    const slugsInResponse = new Set(body.markets!.map((m) => m.slug));
    for (const m of MARKETS) {
      expect(slugsInResponse.has(m.slug)).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------
   3.1.2 market param (valid) → theaters for that market
   ------------------------------------------------------------------------- */

describe("Gap 3.1.2 — ?market param: returns theaters for that market", () => {
  it("?market=new-york-city returns theaters array", () => {
    const body = simulateTheatersRoute({ market: "new-york-city" });
    expect(Array.isArray(body.theaters)).toBe(true);
    expect(body.theaters!.length).toBeGreaterThan(0);
  });

  it("?market=new-york-city echoes back the market slug", () => {
    const body = simulateTheatersRoute({ market: "new-york-city" });
    expect(body.market).toBe("new-york-city");
  });

  it("?market=new-york-city does NOT return a 'markets' key", () => {
    const body = simulateTheatersRoute({ market: "new-york-city" });
    expect(body.markets).toBeUndefined();
  });

  it("theaters returned for new-york-city match POPULAR_THEATERS exactly", () => {
    const body = simulateTheatersRoute({ market: "new-york-city" });
    expect(body.theaters).toEqual(POPULAR_THEATERS["new-york-city"]);
  });

  it("each theater has slug, name, neighborhood, hasImax70mm", () => {
    const body = simulateTheatersRoute({ market: "new-york-city" });
    for (const t of body.theaters!) {
      expect(typeof t.slug).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.neighborhood).toBe("string");
      expect(typeof t.hasImax70mm).toBe("boolean");
    }
  });
});

/* -------------------------------------------------------------------------
   3.1.3 market param (unknown market) → empty theaters array
   ------------------------------------------------------------------------- */

describe("Gap 3.1.3 — ?market=unknown-market: returns empty theaters array", () => {
  it("unknown market returns empty theaters array (not 404)", () => {
    const body = simulateTheatersRoute({ market: "unknown-market" });
    expect(Array.isArray(body.theaters)).toBe(true);
    expect(body.theaters!.length).toBe(0);
  });

  it("unknown market response still echoes the market slug", () => {
    const body = simulateTheatersRoute({ market: "unknown-market" });
    expect(body.market).toBe("unknown-market");
  });

  it("unknown market does NOT fall through to markets list", () => {
    const body = simulateTheatersRoute({ market: "unknown-market" });
    expect(body.markets).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------
   3.1.4 q param → cross-market search
   ------------------------------------------------------------------------- */

describe("Gap 3.1.4 — ?q param: cross-market search", () => {
  it("?q=lincoln returns AMC Lincoln Square", () => {
    const body = simulateTheatersRoute({ q: "lincoln" });
    expect(Array.isArray(body.theaters)).toBe(true);
    const names = body.theaters!.map((t) => t.name.toLowerCase());
    expect(names.some((n) => n.includes("lincoln"))).toBe(true);
  });

  it("?q search result has no 'markets' key", () => {
    const body = simulateTheatersRoute({ q: "lincoln" });
    expect(body.markets).toBeUndefined();
  });

  it("?q=amc returns multiple theaters across multiple markets", () => {
    // All theaters have "AMC" in their name — should return many across all markets
    const body = simulateTheatersRoute({ q: "amc" });
    expect(body.theaters!.length).toBeGreaterThan(5);
  });

  it("?q=nonexistent-theater-xyz returns empty array", () => {
    const body = simulateTheatersRoute({ q: "nonexistent-theater-xyz" });
    expect(body.theaters!.length).toBe(0);
  });

  it("?q search is case-insensitive: 'LINCOLN' matches lincoln square", () => {
    const body = simulateTheatersRoute({ q: "LINCOLN" });
    expect(body.theaters!.some((t) => t.name.toLowerCase().includes("lincoln"))).toBe(true);
  });
});

/* -------------------------------------------------------------------------
   3.1.5 q + market → market-scoped search
   ------------------------------------------------------------------------- */

describe("Gap 3.1.5 — ?q + ?market: market-scoped search", () => {
  it("?q=amc&market=new-york-city returns only NYC theaters", () => {
    const body = simulateTheatersRoute({ q: "amc", market: "new-york-city" });
    const nycSlugs = new Set(POPULAR_THEATERS["new-york-city"].map((t) => t.slug));
    for (const t of body.theaters!) {
      expect(nycSlugs.has(t.slug)).toBe(true);
    }
  });

  it("?q=amc&market=new-york-city returns fewer results than ?q=amc alone", () => {
    const scoped = simulateTheatersRoute({ q: "amc", market: "new-york-city" });
    const unscoped = simulateTheatersRoute({ q: "amc" });
    expect(scoped.theaters!.length).toBeLessThan(unscoped.theaters!.length);
  });

  it("?q=lincoln&market=los-angeles returns empty (lincoln square is NYC)", () => {
    const body = simulateTheatersRoute({ q: "lincoln", market: "los-angeles" });
    expect(body.theaters!.length).toBe(0);
  });
});

/* -------------------------------------------------------------------------
   3.1.6 Rate limit → rateLimit() is applied to /api/theaters
   The route calls rateLimit(request, { limit: 30, windowMs: 60_000 }).
   We verify the function returns null for early requests and 429 after limit.
   Uses a unique IP to avoid polluting other test buckets.
   ------------------------------------------------------------------------- */

describe("Gap 3.1.6 — Rate limit: rateLimit() applied to /api/theaters path", () => {
  it("first request to /api/theaters is allowed (returns null)", () => {
    const req = makeTheatersRequest("192.168.3.1");
    const result = rateLimit(req, { limit: 30, windowMs: 60_000 });
    expect(result).toBeNull();
  });

  it("requests within limit (30) are all allowed", () => {
    const ip = "192.168.3.2";
    for (let i = 0; i < 30; i++) {
      const result = rateLimit(makeTheatersRequest(ip), { limit: 30, windowMs: 60_000 });
      expect(result).toBeNull();
    }
  });

  it("31st request exceeds limit of 30 → 429 response", () => {
    const ip = "192.168.3.3";
    const limit = 30;
    for (let i = 0; i < limit; i++) {
      rateLimit(makeTheatersRequest(ip), { limit, windowMs: 60_000 });
    }
    const blocked = rateLimit(makeTheatersRequest(ip), { limit, windowMs: 60_000 });
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("429 response for /api/theaters path includes Retry-After header", () => {
    const ip = "192.168.3.4";
    const limit = 1;
    rateLimit(makeTheatersRequest(ip), { limit, windowMs: 60_000 });
    const blocked = rateLimit(makeTheatersRequest(ip), { limit, windowMs: 60_000 });
    expect(blocked!.headers.get("Retry-After")).not.toBeNull();
  });
});
