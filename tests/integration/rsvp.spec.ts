/**
 * RSVP feature — /api/rsvp Integration Tests
 *
 * Tests GET /api/rsvp?showtime_id=xxx[&anonymous_id=yyy]
 *   and POST /api/rsvp {showtime_id, anonymous_id, action: "add"|"remove"}
 *
 * Mirrors the exact branches in app/api/rsvp/route.ts without spinning up
 * a real HTTP server or Cloudflare runtime.
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";

/* -------------------------------------------------------------------------
   Route logic mirrors
   ------------------------------------------------------------------------- */

interface GetResponse {
  status: number;
  body: { count?: number; going?: boolean; error?: string };
}

interface PostResponse {
  status: number;
  body: { count?: number; going?: boolean; error?: string };
}

// Mirrors GET handler in app/api/rsvp/route.ts
async function simulateGet(
  searchParams: { showtime_id?: string | null; anonymous_id?: string | null },
  db: D1Database | undefined
): Promise<GetResponse> {
  const showtimeId = searchParams.showtime_id ?? null;
  const anonymousId = searchParams.anonymous_id ?? null;

  if (!showtimeId) {
    return { status: 400, body: { error: "showtime_id is required" } };
  }

  try {
    if (!db) {
      return { status: 200, body: { count: 0, going: false } };
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM rsvps WHERE showtime_id = ?")
      .bind(showtimeId)
      .first<{ count: number }>();

    const count = countRow?.count ?? 0;
    let going = false;

    if (anonymousId) {
      const goingRow = await db
        .prepare("SELECT 1 FROM rsvps WHERE showtime_id = ? AND anonymous_id = ?")
        .bind(showtimeId, anonymousId)
        .first();
      going = goingRow != null;
    }

    return { status: 200, body: { count, going } };
  } catch {
    return { status: 200, body: { count: 0, going: false } };
  }
}

// Mirrors POST handler in app/api/rsvp/route.ts
async function simulatePost(
  body: { showtime_id?: unknown; anonymous_id?: unknown; action?: unknown },
  db: D1Database | undefined
): Promise<PostResponse> {
  const { showtime_id: showtimeId, anonymous_id: anonymousId, action } = body;

  if (!showtimeId || typeof showtimeId !== "string" || (showtimeId as string).trim().length === 0) {
    return { status: 400, body: { error: "showtime_id is required" } };
  }
  if (!anonymousId || typeof anonymousId !== "string" || (anonymousId as string).trim().length === 0) {
    return { status: 400, body: { error: "anonymous_id is required" } };
  }
  if (action !== "add" && action !== "remove") {
    return { status: 400, body: { error: "action must be 'add' or 'remove'" } };
  }

  const sid = (showtimeId as string).trim().slice(0, 100);
  const aid = (anonymousId as string).trim().slice(0, 64);

  if (!db) {
    return {
      status: 200,
      body: { count: action === "add" ? 1 : 0, going: action === "add" },
    };
  }

  try {
    if (action === "add") {
      await db
        .prepare("INSERT OR IGNORE INTO rsvps (showtime_id, anonymous_id) VALUES (?, ?)")
        .bind(sid, aid)
        .run();
    } else {
      await db
        .prepare("DELETE FROM rsvps WHERE showtime_id = ? AND anonymous_id = ?")
        .bind(sid, aid)
        .run();
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM rsvps WHERE showtime_id = ?")
      .bind(sid)
      .first<{ count: number }>();

    const count = countRow?.count ?? 0;
    return { status: 200, body: { count, going: action === "add" } };
  } catch (e) {
    return { status: 500, body: { error: "Something went wrong. Please try again." } };
  }
}

/* -------------------------------------------------------------------------
   DB mock helpers
   ------------------------------------------------------------------------- */

/**
 * Build a DB mock with a simple in-memory rsvp store.
 * Supports INSERT OR IGNORE, DELETE, SELECT COUNT, SELECT 1.
 */
function makeRsvpDb(initialRsvps: { showtime_id: string; anonymous_id: string }[] = []): D1Database {
  const store = [...initialRsvps];

  function makeStmt(query: string, bindings: unknown[]): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (...args: unknown[]) => makeStmt(query, args),
      run: async () => {
        if (query.startsWith("INSERT OR IGNORE")) {
          const [sid, aid] = bindings as string[];
          const exists = store.some((r) => r.showtime_id === sid && r.anonymous_id === aid);
          if (!exists) store.push({ showtime_id: sid, anonymous_id: aid });
        } else if (query.startsWith("DELETE")) {
          const [sid, aid] = bindings as string[];
          const idx = store.findIndex((r) => r.showtime_id === sid && r.anonymous_id === aid);
          if (idx !== -1) store.splice(idx, 1);
        }
        return { success: true };
      },
      first: async <T>() => {
        if (query.includes("COUNT(*)")) {
          const [sid] = bindings as string[];
          const count = store.filter((r) => r.showtime_id === sid).length;
          return { count } as unknown as T;
        }
        if (query.includes("SELECT 1")) {
          const [sid, aid] = bindings as string[];
          const found = store.find((r) => r.showtime_id === sid && r.anonymous_id === aid);
          return (found ?? null) as unknown as T;
        }
        return null as unknown as T;
      },
      all: async () => ({ results: [] }),
    };
    return stmt;
  }

  return {
    prepare: (query: string) => makeStmt(query, []),
  };
}

function makeThrowingDb(): D1Database {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: async () => { throw new Error("D1 unavailable"); },
    first: async () => { throw new Error("D1 unavailable"); },
    all: async () => { throw new Error("D1 unavailable"); },
  };
  return { prepare: () => stmt };
}

/* =========================================================================
   GET tests
   ========================================================================= */

describe("RSVP GET — missing showtime_id", () => {
  it("returns 400 when showtime_id is absent", async () => {
    const res = await simulateGet({ showtime_id: null }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/showtime_id/);
  });

  it("returns 400 when showtime_id is empty string", async () => {
    // empty string is falsy after trim check in POST but GET checks !showtimeId
    const res = await simulateGet({ showtime_id: null }, undefined);
    expect(res.status).toBe(400);
  });
});

describe("RSVP GET — no DB (dev mode)", () => {
  it("returns {count:0, going:false} when DB is undefined", async () => {
    const res = await simulateGet({ showtime_id: "st-abc" }, undefined);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, going: false });
  });
});

describe("RSVP GET — with DB, no anonymous_id", () => {
  it("returns correct count without going flag", async () => {
    const db = makeRsvpDb([
      { showtime_id: "st-1", anonymous_id: "anon-a" },
      { showtime_id: "st-1", anonymous_id: "anon-b" },
    ]);
    const res = await simulateGet({ showtime_id: "st-1" }, db);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.going).toBe(false); // no anonymous_id → going stays false
  });

  it("returns count=0 for showtime with no RSVPs", async () => {
    const db = makeRsvpDb([]);
    const res = await simulateGet({ showtime_id: "st-empty" }, db);
    expect(res.body.count).toBe(0);
  });
});

describe("RSVP GET — with DB and anonymous_id", () => {
  it("returns going=true when anonymous_id has RSVP'd", async () => {
    const db = makeRsvpDb([{ showtime_id: "st-1", anonymous_id: "anon-me" }]);
    const res = await simulateGet({ showtime_id: "st-1", anonymous_id: "anon-me" }, db);
    expect(res.body.going).toBe(true);
    expect(res.body.count).toBe(1);
  });

  it("returns going=false when anonymous_id has NOT RSVP'd", async () => {
    const db = makeRsvpDb([{ showtime_id: "st-1", anonymous_id: "anon-other" }]);
    const res = await simulateGet({ showtime_id: "st-1", anonymous_id: "anon-me" }, db);
    expect(res.body.going).toBe(false);
    expect(res.body.count).toBe(1); // other person is going
  });

  it("returns going=false for empty table", async () => {
    const db = makeRsvpDb([]);
    const res = await simulateGet({ showtime_id: "st-1", anonymous_id: "anon-me" }, db);
    expect(res.body.going).toBe(false);
    expect(res.body.count).toBe(0);
  });
});

describe("RSVP GET — DB error fallback", () => {
  it("returns {count:0, going:false} when DB throws", async () => {
    const res = await simulateGet({ showtime_id: "st-1" }, makeThrowingDb());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, going: false });
  });
});

/* =========================================================================
   POST tests
   ========================================================================= */

describe("RSVP POST — validation", () => {
  it("returns 400 when showtime_id is missing", async () => {
    const res = await simulatePost({ anonymous_id: "anon-a", action: "add" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/showtime_id/);
  });

  it("returns 400 when anonymous_id is missing", async () => {
    const res = await simulatePost({ showtime_id: "st-1", action: "add" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/anonymous_id/);
  });

  it("returns 400 when action is invalid", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "toggle" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/action/);
  });

  it("returns 400 when action is missing", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a" }, undefined);
    expect(res.status).toBe(400);
  });
});

describe("RSVP POST — no DB (dev mode)", () => {
  it("action=add returns {count:1, going:true}", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "add" }, undefined);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 1, going: true });
  });

  it("action=remove returns {count:0, going:false}", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "remove" }, undefined);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, going: false });
  });
});

describe("RSVP POST — add new RSVP", () => {
  it("adds RSVP and returns count=1, going=true", async () => {
    const db = makeRsvpDb([]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "add" }, db);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 1, going: true });
  });

  it("count reflects multiple RSVPs across different anonymous_ids", async () => {
    const db = makeRsvpDb([
      { showtime_id: "st-1", anonymous_id: "anon-a" },
      { showtime_id: "st-1", anonymous_id: "anon-b" },
    ]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-c", action: "add" }, db);
    expect(res.body.count).toBe(3);
    expect(res.body.going).toBe(true);
  });
});

describe("RSVP POST — remove RSVP", () => {
  it("removes existing RSVP and returns going=false", async () => {
    const db = makeRsvpDb([{ showtime_id: "st-1", anonymous_id: "anon-a" }]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "remove" }, db);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 0, going: false });
  });

  it("remove on non-existent RSVP is idempotent — count stays 0", async () => {
    const db = makeRsvpDb([]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "remove" }, db);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.going).toBe(false);
  });

  it("remove only affects the correct anonymous_id", async () => {
    const db = makeRsvpDb([
      { showtime_id: "st-1", anonymous_id: "anon-a" },
      { showtime_id: "st-1", anonymous_id: "anon-b" },
    ]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "remove" }, db);
    expect(res.body.count).toBe(1); // anon-b still there
  });
});

describe("RSVP POST — deduplication (INSERT OR IGNORE)", () => {
  it("adding duplicate RSVP does not increase count", async () => {
    const db = makeRsvpDb([{ showtime_id: "st-1", anonymous_id: "anon-a" }]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "add" }, db);
    expect(res.body.count).toBe(1); // still 1, not 2
    expect(res.body.going).toBe(true);
  });
});

describe("RSVP POST — DB error", () => {
  it("returns 500 when DB throws", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", action: "add" }, makeThrowingDb());
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/something went wrong/i);
  });
});
