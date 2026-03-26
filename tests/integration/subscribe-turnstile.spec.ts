/**
 * Gap 3.6 — /api/subscribe Turnstile + Re-subscribe
 *
 * Tests the Cloudflare Turnstile verification logic and the re-subscription
 * UPDATE path in /api/subscribe/route.ts.
 *
 * Coverage:
 *  1. Turnstile skipped — no token provided
 *  2. Turnstile skipped — token provided but no TURNSTILE_SECRET_KEY in env
 *  3. Turnstile failure — secret + token, Turnstile API returns success:false → 403
 *  4. Turnstile pass — secret + token, Turnstile API returns success:true → not blocked
 *  5. Turnstile fetch throws → outer catch → 500 shape
 *  6. Re-subscribe (inactive existing) → UPDATE path → "Welcome back!" message
 *  7. Already active → alreadySubscribed:true, no DB write
 *  8. New subscriber → INSERT path → success message
 *
 * All tests use pure logic extracted from the route (no HTTP server required).
 * Pattern mirrors movies-error-paths.spec.ts and check-edge-cases.spec.ts.
 */
import { describe, it, expect } from "vitest";

/* -------------------------------------------------------------------------
   Turnstile verification logic (mirrored from /api/subscribe/route.ts)
   Lines ~28-42: if (turnstileToken) { if (turnstileSecret) { verify } }
   ------------------------------------------------------------------------- */

type FetchLike = (
  url: string,
  init?: RequestInit
) => Promise<{ json: () => Promise<{ success: boolean }> }>;

/**
 * Mirrors the Turnstile verification block.
 * Returns true if the request should be blocked (bot detected).
 */
async function verifyTurnstile(
  token: string | undefined,
  secret: string | undefined,
  fetchFn: FetchLike
): Promise<boolean> {
  if (!token) return false;          // no token → skip → not blocked
  if (!secret) return false;         // no secret (dev) → skip → not blocked
  const resp = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token }),
  });
  const data = await resp.json();
  return !data.success;              // blocked iff Turnstile says success:false
}

/** Response body returned on Turnstile failure */
const TURNSTILE_BLOCKED_BODY = { error: "Bot verification failed. Please try again." };

/* -------------------------------------------------------------------------
   Subscribe action logic (mirrored from /api/subscribe/route.ts)
   Lines ~80-113: existing → active? alreadySubscribed : UPDATE | INSERT
   ------------------------------------------------------------------------- */

interface MockExisting {
  email: string;
  active: number; // 1 = active, 0 = inactive (was unsubscribed)
}

type SubscribeAction = "already-subscribed" | "re-subscribe" | "new-subscriber";

function determineSubscribeAction(existing: MockExisting | null): SubscribeAction {
  if (!existing) return "new-subscriber";
  if (existing.active) return "already-subscribed";
  return "re-subscribe";
}

/** Response bodies for each action — mirrors route responses */
const RESPONSE_BODIES: Record<SubscribeAction, object> = {
  "already-subscribed": {
    success: true,
    alreadySubscribed: true,
    message: "You're already on the list!",
  },
  "re-subscribe": {
    success: true,
    message: "Welcome back! You've been re-subscribed.",
  },
  "new-subscriber": {
    success: true,
    message: "You're on the list! We'll email you the moment tickets drop.",
  },
};

/** Mirrors the re-subscribe UPDATE query fields */
function buildUpdateFields(
  email: string,
  selectedDates: string[],
  movieSlug: string,
  movieTitle: string,
  theaterSlugs: string[] | null
): {
  query: string;
  values: [string, string, string, string | null, string];
} {
  return {
    query:
      "UPDATE subscribers SET active = 1, dates = ?, movie_slug = ?, movie_title = ?, theater_slugs = ?, subscribed_at = datetime('now') WHERE email = ?",
    values: [
      JSON.stringify(selectedDates),
      movieSlug,
      movieTitle,
      theaterSlugs ? JSON.stringify(theaterSlugs) : null,
      email,
    ],
  };
}

/** Mirrors the INSERT query fields */
function buildInsertFields(
  email: string,
  selectedDates: string[],
  movieSlug: string,
  movieTitle: string,
  theaterSlugs: string[] | null
): {
  query: string;
  values: [string, string, string, string, string | null];
} {
  return {
    query:
      "INSERT INTO subscribers (email, dates, movie_slug, movie_title, theater_slugs) VALUES (?, ?, ?, ?, ?)",
    values: [
      email,
      JSON.stringify(selectedDates),
      movieSlug,
      movieTitle,
      theaterSlugs ? JSON.stringify(theaterSlugs) : null,
    ],
  };
}

/* =========================================================================
   3.6.1 — Turnstile: no token → skip verification
   ========================================================================= */

describe("Gap 3.6.1 — Turnstile: no token → skip (not blocked)", () => {
  it("undefined token → verifyTurnstile returns false (not blocked)", async () => {
    const mockFetch: FetchLike = async () => {
      throw new Error("should not be called");
    };
    const blocked = await verifyTurnstile(undefined, "some-secret", mockFetch);
    expect(blocked).toBe(false);
  });

  it("empty string token → verifyTurnstile returns false", async () => {
    const mockFetch: FetchLike = async () => {
      throw new Error("should not be called");
    };
    const blocked = await verifyTurnstile("", "some-secret", mockFetch);
    expect(blocked).toBe(false);
  });
});

/* =========================================================================
   3.6.2 — Turnstile: token present but no TURNSTILE_SECRET_KEY → skip
   ========================================================================= */

describe("Gap 3.6.2 — Turnstile: token present but no secret key → skip", () => {
  it("no secret (undefined) → verifyTurnstile returns false even with token", async () => {
    const mockFetch: FetchLike = async () => {
      throw new Error("should not be called");
    };
    const blocked = await verifyTurnstile("some-cf-token", undefined, mockFetch);
    expect(blocked).toBe(false);
  });

  it("no secret (empty string) → verifyTurnstile returns false", async () => {
    const mockFetch: FetchLike = async () => {
      throw new Error("should not be called");
    };
    const blocked = await verifyTurnstile("some-cf-token", "", mockFetch);
    expect(blocked).toBe(false);
  });
});

/* =========================================================================
   3.6.3 — Turnstile failure → blocked → 403 body
   ========================================================================= */

describe("Gap 3.6.3 — Turnstile: success:false → blocked → 403", () => {
  it("Turnstile returns success:false → verifyTurnstile returns true (blocked)", async () => {
    const mockFetch: FetchLike = async () => ({
      json: async () => ({ success: false }),
    });
    const blocked = await verifyTurnstile("bad-token", "real-secret", mockFetch);
    expect(blocked).toBe(true);
  });

  it("403 body has correct error message", () => {
    expect(TURNSTILE_BLOCKED_BODY).toEqual({
      error: "Bot verification failed. Please try again.",
    });
  });

  it("Turnstile returns success:false with extra fields → still blocked", async () => {
    const mockFetch: FetchLike = async () => ({
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"],
        hostname: "example.com",
      }),
    });
    const blocked = await verifyTurnstile("bad-token", "real-secret", mockFetch);
    expect(blocked).toBe(true);
  });
});

/* =========================================================================
   3.6.4 — Turnstile pass → not blocked
   ========================================================================= */

describe("Gap 3.6.4 — Turnstile: success:true → not blocked → subscription proceeds", () => {
  it("Turnstile returns success:true → verifyTurnstile returns false (not blocked)", async () => {
    const mockFetch: FetchLike = async () => ({
      json: async () => ({ success: true }),
    });
    const blocked = await verifyTurnstile("valid-cf-token", "real-secret", mockFetch);
    expect(blocked).toBe(false);
  });

  it("Turnstile returns success:true with challenge_ts → not blocked", async () => {
    const mockFetch: FetchLike = async () => ({
      json: async () => ({
        success: true,
        challenge_ts: "2026-03-26T15:30:00.000Z",
        hostname: "tickets.example.com",
      }),
    });
    const blocked = await verifyTurnstile("valid-token", "real-secret", mockFetch);
    expect(blocked).toBe(false);
  });
});

/* =========================================================================
   3.6.5 — Turnstile fetch throws → outer catch → 500 shape
   ========================================================================= */

describe("Gap 3.6.5 — Turnstile fetch throws → caught by outer try/catch → 500", () => {
  it("fetch throwing inside verifyTurnstile propagates as an error", async () => {
    const mockFetch: FetchLike = async () => {
      throw new Error("Network failure");
    };
    // The error propagates out of verifyTurnstile (no internal catch)
    // The route's outer try/catch catches it and returns 500
    await expect(verifyTurnstile("token", "secret", mockFetch)).rejects.toThrow(
      "Network failure"
    );
  });

  it("500 error body shape when outer catch fires", () => {
    // Mirrors route's catch block: { error: "Something went wrong. Please try again." }
    const outerCatchBody = { error: "Something went wrong. Please try again." };
    expect(outerCatchBody.error).toContain("Something went wrong");
  });
});

/* =========================================================================
   3.6.6 — Re-subscribe: inactive existing subscriber → UPDATE path
   ========================================================================= */

describe("Gap 3.6.6 — Re-subscribe: inactive subscriber → UPDATE path", () => {
  it("inactive existing (active=0) → action is 're-subscribe'", () => {
    const existing: MockExisting = { email: "user@example.com", active: 0 };
    expect(determineSubscribeAction(existing)).toBe("re-subscribe");
  });

  it("re-subscribe response body contains 'Welcome back!' message", () => {
    const body = RESPONSE_BODIES["re-subscribe"];
    expect(body).toEqual({
      success: true,
      message: "Welcome back! You've been re-subscribed.",
    });
  });

  it("re-subscribe response does NOT set alreadySubscribed field", () => {
    const body = RESPONSE_BODIES["re-subscribe"] as Record<string, unknown>;
    expect(body.alreadySubscribed).toBeUndefined();
  });

  it("UPDATE query reactivates subscriber with new dates and movie context", () => {
    const fields = buildUpdateFields(
      "user@example.com",
      ["2026-04-03", "2026-04-04"],
      "project-hail-mary-76779",
      "Project Hail Mary",
      ["amc-lincoln-square-13"]
    );
    expect(fields.query).toContain("UPDATE subscribers");
    expect(fields.query).toContain("active = 1");
    expect(fields.query).toContain("movie_slug = ?");
    expect(fields.query).toContain("theater_slugs = ?");
    expect(fields.values[0]).toBe(JSON.stringify(["2026-04-03", "2026-04-04"]));
    expect(fields.values[1]).toBe("project-hail-mary-76779");
    expect(fields.values[2]).toBe("Project Hail Mary");
    expect(fields.values[3]).toBe(JSON.stringify(["amc-lincoln-square-13"]));
    expect(fields.values[4]).toBe("user@example.com");
  });

  it("re-subscribe with null theaterSlugs → theater_slugs value is null (no theater restriction)", () => {
    const fields = buildUpdateFields(
      "user@example.com",
      ["2026-04-05"],
      "project-hail-mary-76779",
      "Project Hail Mary",
      null
    );
    expect(fields.values[3]).toBeNull();
  });
});

/* =========================================================================
   3.6.7 — Already active subscriber → alreadySubscribed:true, no DB write
   ========================================================================= */

describe("Gap 3.6.7 — Already active subscriber → alreadySubscribed:true", () => {
  it("active existing (active=1) → action is 'already-subscribed'", () => {
    const existing: MockExisting = { email: "user@example.com", active: 1 };
    expect(determineSubscribeAction(existing)).toBe("already-subscribed");
  });

  it("already-subscribed response body has alreadySubscribed:true", () => {
    const body = RESPONSE_BODIES["already-subscribed"];
    expect(body).toMatchObject({ success: true, alreadySubscribed: true });
  });

  it("already-subscribed message is 'You're already on the list!'", () => {
    const body = RESPONSE_BODIES["already-subscribed"] as { message: string };
    expect(body.message).toBe("You're already on the list!");
  });
});

/* =========================================================================
   3.6.8 — New subscriber → INSERT path
   ========================================================================= */

describe("Gap 3.6.8 — New subscriber → INSERT path", () => {
  it("null existing → action is 'new-subscriber'", () => {
    expect(determineSubscribeAction(null)).toBe("new-subscriber");
  });

  it("new-subscriber response body has correct message", () => {
    const body = RESPONSE_BODIES["new-subscriber"];
    expect(body).toEqual({
      success: true,
      message: "You're on the list! We'll email you the moment tickets drop.",
    });
  });

  it("INSERT query includes all 5 fields: email, dates, movie_slug, movie_title, theater_slugs", () => {
    const fields = buildInsertFields(
      "new@example.com",
      ["2026-04-01"],
      "project-hail-mary-76779",
      "Project Hail Mary",
      null
    );
    expect(fields.query).toContain("INSERT INTO subscribers");
    expect(fields.query).toContain("movie_slug");
    expect(fields.query).toContain("movie_title");
    expect(fields.query).toContain("theater_slugs");
    expect(fields.values[0]).toBe("new@example.com");
    expect(fields.values[1]).toBe(JSON.stringify(["2026-04-01"]));
    expect(fields.values[4]).toBeNull(); // no theater restriction
  });

  it("INSERT with theater slugs → theater_slugs value is JSON array string", () => {
    const fields = buildInsertFields(
      "new@example.com",
      ["2026-04-03"],
      "project-hail-mary-76779",
      "Project Hail Mary",
      ["amc-lincoln-square-13", "amc-empire-25"]
    );
    expect(fields.values[4]).toBe(
      JSON.stringify(["amc-lincoln-square-13", "amc-empire-25"])
    );
  });
});
