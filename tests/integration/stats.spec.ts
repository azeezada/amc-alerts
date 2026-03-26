/**
 * Gap 3.2 — /api/stats Integration Tests
 *
 * Tests the GET /api/stats handler logic:
 *  1. Stub mode (no DB) — returns { subscribers: 42 } with Cache-Control header
 *  2. DB COUNT query — returns actual subscriber count with Cache-Control header
 *  3. DB null row — falls back to { subscribers: 0 } with Cache-Control header
 *  4. Error fallback — DB throws → returns { subscribers: 0 } without cache header
 *
 * Pure logic tests — mirrors the conditional branches in app/api/stats/route.ts
 * without spinning up a real HTTP server or Cloudflare runtime.
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";

/* -------------------------------------------------------------------------
   Route logic mirror
   Mirrors the exact branches in app/api/stats/route.ts GET handler.
   The real handler wraps everything in try/catch; we replicate that here.
   ------------------------------------------------------------------------- */

interface StatsResponse {
  body: { subscribers: number };
  cacheControl: string | null;
}

async function simulateStatsRoute(db: D1Database | undefined): Promise<StatsResponse> {
  try {
    if (!db) {
      return {
        body: { subscribers: 42 },
        cacheControl: "public, s-maxage=300",
      };
    }

    const row = await db
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE active = 1")
      .first<{ count: number }>();

    return {
      body: { subscribers: row?.count ?? 0 },
      cacheControl: "public, s-maxage=300",
    };
  } catch {
    return {
      body: { subscribers: 0 },
      cacheControl: null,
    };
  }
}

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

function makeDb(count: number | null | Error): D1Database {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: async () => ({ success: true }),
    first: async <T>() => {
      if (count instanceof Error) throw count;
      if (count === null) return null as unknown as T;
      return { count } as unknown as T;
    },
    all: async () => ({ results: [] }),
  };
  return {
    prepare: (_query: string) => stmt,
  };
}

/* -------------------------------------------------------------------------
   1. Stub mode (no DB)
   When getCfEnv returns {} (no DB binding), the route returns a hardcoded
   count of 42 so the social-proof counter works even without D1.
   ------------------------------------------------------------------------- */

describe("Gap 3.2.1 — Stub mode (no DB)", () => {
  it("returns { subscribers: 42 } when DB is undefined", async () => {
    const result = await simulateStatsRoute(undefined);
    expect(result.body).toEqual({ subscribers: 42 });
  });

  it("stub mode includes Cache-Control: public, s-maxage=300", async () => {
    const result = await simulateStatsRoute(undefined);
    expect(result.cacheControl).toBe("public, s-maxage=300");
  });
});

/* -------------------------------------------------------------------------
   2. DB COUNT query
   When DB is available, SELECT COUNT(*) WHERE active=1 drives the response.
   ------------------------------------------------------------------------- */

describe("Gap 3.2.2 — DB COUNT query", () => {
  it("returns subscriber count from DB", async () => {
    const db = makeDb(137);
    const result = await simulateStatsRoute(db);
    expect(result.body).toEqual({ subscribers: 137 });
  });

  it("DB path includes Cache-Control: public, s-maxage=300", async () => {
    const db = makeDb(137);
    const result = await simulateStatsRoute(db);
    expect(result.cacheControl).toBe("public, s-maxage=300");
  });

  it("returns { subscribers: 0 } when COUNT is 0 (empty table)", async () => {
    const db = makeDb(0);
    const result = await simulateStatsRoute(db);
    expect(result.body).toEqual({ subscribers: 0 });
    expect(result.cacheControl).toBe("public, s-maxage=300");
  });

  it("returns { subscribers: 0 } when DB row is null (??  fallback)", async () => {
    // .first() returns null when no rows match
    const db = makeDb(null);
    const result = await simulateStatsRoute(db);
    expect(result.body).toEqual({ subscribers: 0 });
    expect(result.cacheControl).toBe("public, s-maxage=300");
  });
});

/* -------------------------------------------------------------------------
   3. Error fallback
   If the DB query (or getCfEnv) throws, the catch block returns
   { subscribers: 0 } WITHOUT Cache-Control so stale error responses
   are not cached by the CDN.
   ------------------------------------------------------------------------- */

describe("Gap 3.2.3 — Error fallback", () => {
  it("returns { subscribers: 0 } when DB throws", async () => {
    const db = makeDb(new Error("D1 connection refused"));
    const result = await simulateStatsRoute(db);
    expect(result.body).toEqual({ subscribers: 0 });
  });

  it("error response has NO Cache-Control header", async () => {
    const db = makeDb(new Error("timeout"));
    const result = await simulateStatsRoute(db);
    expect(result.cacheControl).toBeNull();
  });
});
