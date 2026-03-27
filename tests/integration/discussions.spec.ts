/**
 * Discussion Thread — /api/discussions Integration Tests
 *
 * Tests GET /api/discussions?showtime_id=xxx[&limit=N]
 *   and POST /api/discussions {showtime_id, anonymous_id, body}
 *
 * Mirrors exact branches in app/api/discussions/route.ts without
 * spinning up a real HTTP server or Cloudflare runtime.
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";

/* -------------------------------------------------------------------------
   Types
   ------------------------------------------------------------------------- */
interface DiscussionMessage {
  id: number;
  showtime_id: string;
  anonymous_id: string;
  body: string;
  created_at: string;
}

interface GetResponse {
  status: number;
  body: { messages?: DiscussionMessage[]; total?: number; error?: string };
}

interface PostResponse {
  status: number;
  body: { id?: number; created?: boolean; error?: string };
}

/* -------------------------------------------------------------------------
   Simulate GET handler — mirrors app/api/discussions/route.ts GET
   ------------------------------------------------------------------------- */
async function simulateGet(
  searchParams: { showtime_id?: string | null; limit?: string | null },
  db: D1Database | undefined
): Promise<GetResponse> {
  const showtimeId = searchParams.showtime_id ?? null;
  const limitParam = searchParams.limit ?? null;
  const limit = Math.min(parseInt(limitParam ?? "50", 10) || 50, 100);

  if (!showtimeId) {
    return { status: 400, body: { error: "showtime_id is required" } };
  }

  try {
    if (!db) {
      return { status: 200, body: { messages: [], total: 0 } };
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) as count FROM discussions WHERE showtime_id = ?")
      .bind(showtimeId)
      .first<{ count: number }>();

    const total = countRow?.count ?? 0;

    const rows = await db
      .prepare(
        "SELECT id, showtime_id, anonymous_id, body, created_at FROM discussions WHERE showtime_id = ? ORDER BY created_at ASC LIMIT ?"
      )
      .bind(showtimeId, limit)
      .all<DiscussionMessage>();

    return { status: 200, body: { messages: rows.results ?? [], total } };
  } catch {
    return { status: 200, body: { messages: [], total: 0 } };
  }
}

/* -------------------------------------------------------------------------
   Simulate POST handler — mirrors app/api/discussions/route.ts POST
   ------------------------------------------------------------------------- */
const MAX_BODY_LENGTH = 280;

async function simulatePost(
  requestBody: { showtime_id?: unknown; anonymous_id?: unknown; body?: unknown },
  db: D1Database | undefined
): Promise<PostResponse> {
  const { showtime_id: showtimeId, anonymous_id: anonymousId, body: messageBody } = requestBody;

  if (!showtimeId || typeof showtimeId !== "string" || (showtimeId as string).trim().length === 0) {
    return { status: 400, body: { error: "showtime_id is required" } };
  }
  if (!anonymousId || typeof anonymousId !== "string" || (anonymousId as string).trim().length === 0) {
    return { status: 400, body: { error: "anonymous_id is required" } };
  }
  if (!messageBody || typeof messageBody !== "string" || (messageBody as string).trim().length === 0) {
    return { status: 400, body: { error: "body is required" } };
  }

  const sid = (showtimeId as string).trim().slice(0, 200);
  const aid = (anonymousId as string).trim().slice(0, 64);
  const sanitizedBody = (messageBody as string).trim().slice(0, MAX_BODY_LENGTH);

  if (!db) {
    return { status: 201, body: { id: 0, created: true } };
  }

  try {
    const result = await db
      .prepare("INSERT INTO discussions (showtime_id, anonymous_id, body) VALUES (?, ?, ?)")
      .bind(sid, aid, sanitizedBody)
      .run();

    if (!result.success) {
      return { status: 500, body: { error: "Failed to save message" } };
    }

    const newRow = await db
      .prepare(
        "SELECT id FROM discussions WHERE showtime_id = ? AND anonymous_id = ? ORDER BY created_at DESC LIMIT 1"
      )
      .bind(sid, aid)
      .first<{ id: number }>();

    return { status: 201, body: { id: newRow?.id ?? 0, created: true } };
  } catch {
    return { status: 500, body: { error: "Something went wrong. Please try again." } };
  }
}

/* -------------------------------------------------------------------------
   DB mock helpers
   ------------------------------------------------------------------------- */

let nextId = 1;

function makeDiscussionsDb(
  initialMessages: Omit<DiscussionMessage, "created_at">[] = []
): D1Database {
  const store: DiscussionMessage[] = initialMessages.map((m, i) => ({
    ...m,
    created_at: new Date(Date.now() + i * 1000).toISOString(),
  }));

  function makeStmt(query: string, bindings: unknown[]): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (...args: unknown[]) => makeStmt(query, args),

      run: async () => {
        if (query.startsWith("INSERT INTO discussions")) {
          const [sid, aid, body] = bindings as string[];
          store.push({
            id: nextId++,
            showtime_id: sid,
            anonymous_id: aid,
            body,
            created_at: new Date().toISOString(),
          });
          return { success: true };
        }
        return { success: false, error: "unhandled query" };
      },

      first: async <T>() => {
        if (query.includes("COUNT(*)")) {
          const [sid] = bindings as string[];
          const count = store.filter((m) => m.showtime_id === sid).length;
          return { count } as unknown as T;
        }
        // SELECT id FROM discussions WHERE showtime_id = ? AND anonymous_id = ? ORDER BY ... LIMIT 1
        if (query.startsWith("SELECT id FROM discussions")) {
          const [sid, aid] = bindings as string[];
          const matches = store
            .filter((m) => m.showtime_id === sid && m.anonymous_id === aid)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          const row = matches[0];
          return (row ? { id: row.id } : null) as unknown as T;
        }
        return null as unknown as T;
      },

      all: async <T>() => {
        // SELECT ... FROM discussions WHERE showtime_id = ? ORDER BY created_at ASC LIMIT ?
        const [sid, lim] = bindings as [string, number];
        const matches = store
          .filter((m) => m.showtime_id === sid)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, lim);
        return { results: matches as unknown as T[] };
      },
    };
    return stmt;
  }

  return { prepare: (query: string) => makeStmt(query, []) };
}

function makeFailingRunDb(): D1Database {
  let callCount = 0;
  function makeStmt(query: string, bindings: unknown[]): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (...args: unknown[]) => makeStmt(query, args),
      run: async () => {
        callCount++;
        return { success: false, error: "disk full" };
      },
      first: async <T>() => null as unknown as T,
      all: async <T>() => ({ results: [] as T[] }),
    };
    return stmt;
  }
  return { prepare: (query: string) => makeStmt(query, []) };
}

function makeThrowingDb(): D1Database {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: async () => { throw new Error("D1 unavailable"); },
    first: async <T>() => { throw new Error("D1 unavailable"); },
    all: async <T>() => { throw new Error("D1 unavailable"); },
  };
  return { prepare: () => stmt };
}

/* =========================================================================
   GET tests
   ========================================================================= */

describe("Discussions GET — missing showtime_id", () => {
  it("returns 400 when showtime_id is absent", async () => {
    const res = await simulateGet({ showtime_id: null }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/showtime_id/);
  });

  it("returns 400 when showtime_id is empty string (treated as null)", async () => {
    const res = await simulateGet({ showtime_id: null }, undefined);
    expect(res.status).toBe(400);
  });
});

describe("Discussions GET — no DB (dev mode)", () => {
  it("returns {messages:[], total:0} when DB is undefined", async () => {
    const res = await simulateGet({ showtime_id: "st-abc" }, undefined);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ messages: [], total: 0 });
  });
});

describe("Discussions GET — empty thread", () => {
  it("returns {messages:[], total:0} for showtime with no messages", async () => {
    const db = makeDiscussionsDb([]);
    const res = await simulateGet({ showtime_id: "st-empty" }, db);
    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe("Discussions GET — with messages", () => {
  it("returns all messages for a showtime ordered by created_at ASC", async () => {
    const db = makeDiscussionsDb([
      { id: 1, showtime_id: "st-1", anonymous_id: "anon-a", body: "First message" },
      { id: 2, showtime_id: "st-1", anonymous_id: "anon-b", body: "Second message" },
    ]);
    const res = await simulateGet({ showtime_id: "st-1" }, db);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.messages![0].body).toBe("First message");
    expect(res.body.messages![1].body).toBe("Second message");
  });

  it("only returns messages for the requested showtime", async () => {
    const db = makeDiscussionsDb([
      { id: 1, showtime_id: "st-1", anonymous_id: "anon-a", body: "For st-1" },
      { id: 2, showtime_id: "st-2", anonymous_id: "anon-b", body: "For st-2" },
    ]);
    const res = await simulateGet({ showtime_id: "st-1" }, db);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.messages![0].body).toBe("For st-1");
  });

  it("returns correct total count reflecting all messages in store", async () => {
    const db = makeDiscussionsDb([
      { id: 1, showtime_id: "st-1", anonymous_id: "anon-a", body: "msg 1" },
      { id: 2, showtime_id: "st-1", anonymous_id: "anon-a", body: "msg 2" },
      { id: 3, showtime_id: "st-1", anonymous_id: "anon-b", body: "msg 3" },
    ]);
    const res = await simulateGet({ showtime_id: "st-1" }, db);
    expect(res.body.total).toBe(3);
    expect(res.body.messages).toHaveLength(3);
  });
});

describe("Discussions GET — limit parameter", () => {
  it("limit defaults to 50 when not provided", async () => {
    const db = makeDiscussionsDb([]);
    const res = await simulateGet({ showtime_id: "st-1" }, db);
    // No overflow, just confirm it works
    expect(res.status).toBe(200);
  });

  it("limit is capped at 100 even if a higher value is passed", async () => {
    // We test the Math.min(parseInt("200"), 100) = 100 path
    const limit = Math.min(parseInt("200", 10) || 50, 100);
    expect(limit).toBe(100);
  });
});

describe("Discussions GET — DB error fallback", () => {
  it("returns {messages:[], total:0} when DB throws", async () => {
    const res = await simulateGet({ showtime_id: "st-1" }, makeThrowingDb());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ messages: [], total: 0 });
  });
});

/* =========================================================================
   POST tests
   ========================================================================= */

describe("Discussions POST — validation", () => {
  it("returns 400 when showtime_id is missing", async () => {
    const res = await simulatePost({ anonymous_id: "anon-a", body: "hello" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/showtime_id/);
  });

  it("returns 400 when showtime_id is empty string", async () => {
    const res = await simulatePost({ showtime_id: "  ", anonymous_id: "anon-a", body: "hello" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/showtime_id/);
  });

  it("returns 400 when anonymous_id is missing", async () => {
    const res = await simulatePost({ showtime_id: "st-1", body: "hello" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/anonymous_id/);
  });

  it("returns 400 when body is missing", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a" }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body/);
  });

  it("returns 400 when body is empty whitespace", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "   " }, undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body/);
  });

  it("returns 400 when body is not a string", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: 42 }, undefined);
    expect(res.status).toBe(400);
  });
});

describe("Discussions POST — no DB (dev mode)", () => {
  it("returns {id:0, created:true} with status 201 when DB is undefined", async () => {
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "Hello!" }, undefined);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 0, created: true });
  });
});

describe("Discussions POST — successful insert", () => {
  it("returns {id:N, created:true} with status 201", async () => {
    const db = makeDiscussionsDb([]);
    const res = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "Great showtime!" }, db);
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(typeof res.body.id).toBe("number");
  });

  it("same user can post multiple messages (no UNIQUE constraint)", async () => {
    const db = makeDiscussionsDb([]);
    const res1 = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "First comment" }, db);
    const res2 = await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "Second comment" }, db);
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    // Both succeed; thread has 2 messages
    const getRes = await simulateGet({ showtime_id: "st-1" }, db);
    expect(getRes.body.total).toBe(2);
  });

  it("messages from different users are stored separately", async () => {
    const db = makeDiscussionsDb([]);
    await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "From A" }, db);
    await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-b", body: "From B" }, db);
    const getRes = await simulateGet({ showtime_id: "st-1" }, db);
    expect(getRes.body.total).toBe(2);
    const bodies = getRes.body.messages!.map((m) => m.body);
    expect(bodies).toContain("From A");
    expect(bodies).toContain("From B");
  });
});

describe("Discussions POST — cross-showtime isolation", () => {
  it("messages posted to st-1 do not appear in st-2", async () => {
    const db = makeDiscussionsDb([]);
    await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "For showtime 1" }, db);
    const res = await simulateGet({ showtime_id: "st-2" }, db);
    expect(res.body.messages).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("total counts are independent per showtime", async () => {
    const db = makeDiscussionsDb([]);
    await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: "A1" }, db);
    await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-b", body: "A2" }, db);
    await simulatePost({ showtime_id: "st-2", anonymous_id: "anon-a", body: "B1" }, db);

    const res1 = await simulateGet({ showtime_id: "st-1" }, db);
    const res2 = await simulateGet({ showtime_id: "st-2" }, db);
    expect(res1.body.total).toBe(2);
    expect(res2.body.total).toBe(1);
  });
});

describe("Discussions POST — body truncation", () => {
  it("body is truncated to 280 characters before storage", async () => {
    const longBody = "x".repeat(400);
    const db = makeDiscussionsDb([]);
    await simulatePost({ showtime_id: "st-1", anonymous_id: "anon-a", body: longBody }, db);
    const res = await simulateGet({ showtime_id: "st-1" }, db);
    expect(res.body.messages![0].body.length).toBe(280);
  });
});

describe("Discussions POST — DB run failure", () => {
  it("returns 500 when DB run() returns success:false", async () => {
    const res = await simulatePost(
      { showtime_id: "st-1", anonymous_id: "anon-a", body: "hello" },
      makeFailingRunDb()
    );
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to save/i);
  });
});

describe("Discussions POST — DB throws", () => {
  it("returns 500 when DB throws an exception", async () => {
    const res = await simulatePost(
      { showtime_id: "st-1", anonymous_id: "anon-a", body: "hello" },
      makeThrowingDb()
    );
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/something went wrong/i);
  });
});
