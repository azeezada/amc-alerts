/**
 * Email open/click tracking — /api/track Integration Tests
 *
 * Tests GET /api/track?type=open&email=xxx&run_id=xxx  (tracking pixel)
 *   and GET /api/track?type=click&email=xxx&run_id=xxx&url=<encoded>  (click redirect)
 *
 * Also tests that buildEmailHtml() embeds tracking pixel and wraps links when
 * email+runId are provided.
 *
 * Mirrors the exact branches in app/api/track/route.ts without spinning up
 * a real HTTP server or Cloudflare runtime.
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";
import { buildEmailHtml } from "@/lib/email";
import type { DateResult } from "@/lib/scraper";

/* -------------------------------------------------------------------------
   1x1 transparent GIF bytes (matches TRACKING_PIXEL in route.ts)
   ------------------------------------------------------------------------- */

const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

/* -------------------------------------------------------------------------
   Route logic mirrors
   ------------------------------------------------------------------------- */

interface EventRecord {
  event_type: "open" | "click";
  email: string;
  run_id: string | null;
  url: string | null;
}

interface TrackResponse {
  status: number;
  contentType?: string;
  cacheControl?: string;
  body?: Uint8Array | { error: string };
  redirectUrl?: string;
}

// Mirrors recordEvent() in route.ts
async function recordEvent(
  db: D1Database | undefined,
  eventType: "open" | "click",
  email: string,
  runId: string | null,
  url: string | null
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        "INSERT INTO email_events (event_type, email, run_id, url) VALUES (?, ?, ?, ?)"
      )
      .bind(eventType, email, runId, url)
      .run();
  } catch {
    // silently ignore
  }
}

// Mirrors GET handler in route.ts
async function simulateGet(
  searchParams: {
    type?: string | null;
    email?: string | null;
    run_id?: string | null;
    url?: string | null;
  },
  db: D1Database | undefined
): Promise<TrackResponse> {
  const type = searchParams.type ?? null;
  const email = searchParams.email ?? "";
  const runId = searchParams.run_id ?? null;
  const url = searchParams.url ?? null;

  if (type === "open") {
    await recordEvent(db, "open", email, runId, null);
    return {
      status: 200,
      contentType: "image/gif",
      cacheControl: "no-store, no-cache, must-revalidate",
      body: TRACKING_PIXEL,
    };
  }

  if (type === "click" && url) {
    await recordEvent(db, "click", email, runId, url);
    let decoded: string;
    try {
      decoded = decodeURIComponent(url);
      const parsed = new URL(decoded);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { status: 400, body: { error: "Invalid URL" } };
      }
    } catch {
      return { status: 400, body: { error: "Invalid URL" } };
    }
    return { status: 302, redirectUrl: decoded };
  }

  return { status: 400, body: { error: "Bad request" } };
}

/* -------------------------------------------------------------------------
   DB mock helpers
   ------------------------------------------------------------------------- */

function makeTrackingDb(store: EventRecord[] = []): D1Database {
  function makeStmt(query: string, bindings: unknown[]): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (...args: unknown[]) => makeStmt(query, args),
      run: async () => {
        if (query.startsWith("INSERT INTO email_events")) {
          const [eventType, email, runId, url] = bindings as [
            "open" | "click",
            string,
            string | null,
            string | null,
          ];
          store.push({ event_type: eventType, email, run_id: runId, url });
        }
        return { success: true };
      },
      first: async <T>() => null as unknown as T,
      all: async () => ({ results: [] }),
    };
    return stmt;
  }
  return { prepare: (query: string) => makeStmt(query, []) };
}

function makeThrowingDb(): D1Database {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: async () => {
      throw new Error("D1 unavailable");
    },
    first: async () => {
      throw new Error("D1 unavailable");
    },
    all: async () => {
      throw new Error("D1 unavailable");
    },
  };
  return { prepare: () => stmt };
}

/* =========================================================================
   Open tracking tests
   ========================================================================= */

describe("Track GET — open pixel, no DB (dev mode)", () => {
  it("returns status 200 with image/gif content type", async () => {
    const res = await simulateGet({ type: "open", email: "u@test.com", run_id: "run-1" }, undefined);
    expect(res.status).toBe(200);
    expect(res.contentType).toBe("image/gif");
  });

  it("returns Cache-Control: no-store", async () => {
    const res = await simulateGet({ type: "open", email: "u@test.com", run_id: "run-1" }, undefined);
    expect(res.cacheControl).toContain("no-store");
  });

  it("response body is the 1x1 GIF bytes", async () => {
    const res = await simulateGet({ type: "open", email: "u@test.com", run_id: "run-1" }, undefined);
    expect(res.body).toBeInstanceOf(Uint8Array);
    expect((res.body as Uint8Array).length).toBe(TRACKING_PIXEL.length);
  });

  it("does not throw when DB is undefined", async () => {
    await expect(
      simulateGet({ type: "open" }, undefined)
    ).resolves.toMatchObject({ status: 200 });
  });
});

describe("Track GET — open pixel, with DB", () => {
  it("records open event with email and run_id", async () => {
    const events: EventRecord[] = [];
    const db = makeTrackingDb(events);
    await simulateGet({ type: "open", email: "alice@example.com", run_id: "run-abc" }, db);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "open",
      email: "alice@example.com",
      run_id: "run-abc",
      url: null,
    });
  });

  it("url is null for open events (not a click)", async () => {
    const events: EventRecord[] = [];
    const db = makeTrackingDb(events);
    await simulateGet({ type: "open", email: "bob@example.com", run_id: "r1", url: "https://ignored.com" }, db);
    expect(events[0].url).toBeNull();
  });

  it("email defaults to empty string when not provided", async () => {
    const events: EventRecord[] = [];
    const db = makeTrackingDb(events);
    await simulateGet({ type: "open", run_id: "r1" }, db);
    expect(events[0].email).toBe("");
  });

  it("run_id is null when not provided", async () => {
    const events: EventRecord[] = [];
    const db = makeTrackingDb(events);
    await simulateGet({ type: "open", email: "x@test.com" }, db);
    expect(events[0].run_id).toBeNull();
  });
});

describe("Track GET — open pixel, DB error", () => {
  it("silently ignores DB error and still returns pixel", async () => {
    const res = await simulateGet({ type: "open", email: "u@test.com", run_id: "r1" }, makeThrowingDb());
    expect(res.status).toBe(200);
    expect(res.contentType).toBe("image/gif");
  });
});

/* =========================================================================
   Click tracking tests
   ========================================================================= */

describe("Track GET — click redirect, no DB (dev mode)", () => {
  it("returns 302 redirect to the destination URL", async () => {
    const target = "https://www.amctheatres.com/showtimes";
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent(target) },
      undefined
    );
    expect(res.status).toBe(302);
    expect(res.redirectUrl).toBe(target);
  });

  it("decodes percent-encoded URL before redirecting", async () => {
    const target = "https://www.amctheatres.com/movies/hail-mary?location=lincoln%20square";
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent(target) },
      undefined
    );
    expect(res.status).toBe(302);
    expect(res.redirectUrl).toBe(target);
  });

  it("does not throw when DB is undefined", async () => {
    await expect(
      simulateGet(
        { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("https://amctheatres.com") },
        undefined
      )
    ).resolves.toMatchObject({ status: 302 });
  });
});

describe("Track GET — click redirect, with DB", () => {
  it("records click event with email, run_id, and url", async () => {
    const events: EventRecord[] = [];
    const db = makeTrackingDb(events);
    const target = "https://www.amctheatres.com/showtimes/imax";
    await simulateGet(
      { type: "click", email: "carol@test.com", run_id: "run-xyz", url: encodeURIComponent(target) },
      db
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "click",
      email: "carol@test.com",
      run_id: "run-xyz",
    });
  });

  it("stores the raw (encoded) url value in the DB", async () => {
    const events: EventRecord[] = [];
    const db = makeTrackingDb(events);
    const encoded = encodeURIComponent("https://amctheatres.com/path?a=1&b=2");
    await simulateGet({ type: "click", email: "d@test.com", run_id: "r1", url: encoded }, db);
    expect(events[0].url).toBe(encoded);
  });
});

describe("Track GET — click redirect, DB error", () => {
  it("silently ignores DB error and still redirects", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("https://amctheatres.com") },
      makeThrowingDb()
    );
    expect(res.status).toBe(302);
    expect(res.redirectUrl).toBe("https://amctheatres.com");
  });
});

/* =========================================================================
   Click URL validation tests
   ========================================================================= */

describe("Track GET — click URL validation", () => {
  it("rejects javascript: protocol → 400", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("javascript:alert(1)") },
      undefined
    );
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/Invalid URL/i);
  });

  it("rejects ftp: protocol → 400", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("ftp://files.example.com") },
      undefined
    );
    expect(res.status).toBe(400);
  });

  it("rejects data: URI → 400", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("data:text/html,<h1>hi</h1>") },
      undefined
    );
    expect(res.status).toBe(400);
  });

  it("rejects malformed URL → 400", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: "not-a-valid-url" },
      undefined
    );
    expect(res.status).toBe(400);
  });

  it("accepts http: protocol → 302", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("http://amctheatres.com") },
      undefined
    );
    expect(res.status).toBe(302);
  });

  it("accepts https: protocol → 302", async () => {
    const res = await simulateGet(
      { type: "click", email: "u@test.com", run_id: "r1", url: encodeURIComponent("https://amctheatres.com/imax") },
      undefined
    );
    expect(res.status).toBe(302);
  });
});

/* =========================================================================
   Bad request tests
   ========================================================================= */

describe("Track GET — bad request cases", () => {
  it("returns 400 when type is absent", async () => {
    const res = await simulateGet({ email: "u@test.com" }, undefined);
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/Bad request/i);
  });

  it("returns 400 when type is unknown", async () => {
    const res = await simulateGet({ type: "impression" }, undefined);
    expect(res.status).toBe(400);
  });

  it("returns 400 for type=click with no url", async () => {
    const res = await simulateGet({ type: "click", email: "u@test.com", run_id: "r1" }, undefined);
    expect(res.status).toBe(400);
  });

  it("returns 400 for type=click with empty url", async () => {
    const res = await simulateGet({ type: "click", email: "u@test.com", run_id: "r1", url: "" }, undefined);
    expect(res.status).toBe(400);
  });
});

/* =========================================================================
   buildEmailHtml tracking integration
   ========================================================================= */

const sampleDates: DateResult[] = [
  {
    date: "2026-04-03",
    showtimes: [
      { time: "7:00", amPm: "PM", status: "Sellable", url: "https://www.amctheatres.com/buy" },
    ],
  },
];

describe("buildEmailHtml — tracking pixel injection", () => {
  it("includes tracking pixel img tag when email and runId are provided", () => {
    const html = buildEmailHtml(sampleDates, undefined, "test@example.com", undefined, undefined, "run-001");
    expect(html).toContain("/api/track?type=open");
    expect(html).toContain("test%40example.com");
    expect(html).toContain("run-001");
  });

  it("does NOT include tracking pixel when email is absent", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, undefined, undefined, "run-001");
    expect(html).not.toContain("/api/track?type=open");
  });

  it("does NOT include tracking pixel when runId is absent", () => {
    const html = buildEmailHtml(sampleDates, undefined, "test@example.com", undefined, undefined, undefined);
    expect(html).not.toContain("/api/track?type=open");
  });

  it("wraps Buy Tickets links through /api/track when email and runId provided", () => {
    const html = buildEmailHtml(sampleDates, undefined, "test@example.com", undefined, undefined, "run-001");
    expect(html).toContain("/api/track?type=click");
    expect(html).toContain(encodeURIComponent("https://www.amctheatres.com/buy"));
  });

  it("uses direct ticket URL when email is absent (no click wrapping)", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, undefined, undefined, "run-001");
    expect(html).toContain("https://www.amctheatres.com/buy");
    expect(html).not.toContain("/api/track?type=click");
  });

  it("uses direct ticket URL when runId is absent (no click wrapping)", () => {
    const html = buildEmailHtml(sampleDates, undefined, "test@example.com", undefined, undefined, undefined);
    expect(html).not.toContain("/api/track?type=click");
    expect(html).toContain("https://www.amctheatres.com/buy");
  });
});
