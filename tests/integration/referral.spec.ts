/**
 * Referral system — /api/referral/[code] + subscribe refCode Integration Tests
 *
 * Tests:
 *   GET /api/referral/<code>
 *     - invalid code format → 400
 *     - dev mode (no DB) → 200 with placeholder data
 *     - code not found → 404
 *     - code found → 200 with masked email + referral count
 *     - masking: first char + *** + @domain
 *     - referral_count counts only active subscribers with referred_by = code
 *
 *   subscribe POST referral tracking (mirrors route logic)
 *     - new subscriber gets a referral_code (8 hex chars)
 *     - valid refCode is stored as referred_by
 *     - invalid refCode is ignored (referred_by = null)
 *     - re-subscribe keeps existing referral_code
 *     - already-active subscriber returns existing referral_code
 */
import { describe, it, expect } from "vitest";
import type { D1PreparedStatement, D1Database } from "@/lib/cf-env";

/* -------------------------------------------------------------------------
   Route logic mirrors
   ------------------------------------------------------------------------- */

interface ReferralGetResponse {
  status: number;
  body: {
    valid?: boolean;
    referralCode?: string;
    referrerEmail?: string;
    movieSlug?: string;
    movieTitle?: string;
    referralCount?: number;
    error?: string;
  };
}

/** Mirrors GET /api/referral/[code] in app/api/referral/[code]/route.ts */
async function simulateReferralGet(
  code: string,
  db: D1Database | undefined
): Promise<ReferralGetResponse> {
  if (!code || !/^[a-f0-9]{8}$/.test(code)) {
    return { status: 400, body: { error: "Invalid referral code" } };
  }

  if (!db) {
    return {
      status: 200,
      body: {
        valid: true,
        referralCode: code,
        movieSlug: "project-hail-mary-76779",
        movieTitle: "Project Hail Mary",
        referralCount: 0,
      },
    };
  }

  const row = await db
    .prepare(
      "SELECT email, movie_slug, movie_title, active, (SELECT COUNT(*) FROM subscribers WHERE referred_by = s.referral_code AND active = 1) AS referral_count FROM subscribers s WHERE referral_code = ?"
    )
    .bind(code)
    .first<{
      email: string;
      movie_slug: string;
      movie_title: string;
      active: number;
      referral_count: number;
    }>();

  if (!row) {
    return { status: 404, body: { error: "Referral code not found" } };
  }

  const [localPart, domain] = row.email.split("@");
  const maskedEmail = localPart.slice(0, 1) + "***@" + domain;

  return {
    status: 200,
    body: {
      valid: true,
      referralCode: code,
      referrerEmail: maskedEmail,
      movieSlug: row.movie_slug,
      movieTitle: row.movie_title,
      referralCount: row.referral_count,
    },
  };
}

interface SubscribeResponse {
  status: number;
  body: {
    success?: boolean;
    referralCode?: string;
    alreadySubscribed?: boolean;
    message?: string;
    error?: string;
  };
}

interface Subscriber {
  email: string;
  active: number;
  referral_code: string | null;
  referred_by: string | null;
  movie_slug?: string;
  movie_title?: string;
  referral_count?: number;
}

/** Mirrors subscribe POST logic for the referral-specific branches */
async function simulateSubscribeReferral(
  body: { email: string; dates: string[]; refCode?: string },
  db: D1Database | undefined
): Promise<{ response: SubscribeResponse; storedReferredBy: string | null; storedReferralCode: string }> {
  const { email, dates, refCode } = body;
  const subReferredBy = refCode && /^[a-z0-9]{8}$/.test(refCode) ? refCode : null;
  const newReferralCode = "aabbccdd"; // fixed for testing

  if (!db) {
    return {
      response: { status: 200, body: { success: true, referralCode: newReferralCode } },
      storedReferredBy: subReferredBy,
      storedReferralCode: newReferralCode,
    };
  }

  const existing = await db
    .prepare("SELECT email, active, referral_code FROM subscribers WHERE email = ?")
    .bind(email)
    .first<{ email: string; active: number; referral_code: string | null }>();

  if (existing) {
    if (existing.active) {
      return {
        response: {
          status: 200,
          body: {
            success: true,
            alreadySubscribed: true,
            referralCode: existing.referral_code || null,
            message: "You're already on the list!",
          },
        },
        storedReferredBy: null,
        storedReferralCode: existing.referral_code || newReferralCode,
      };
    } else {
      const keepCode = existing.referral_code || newReferralCode;
      await db
        .prepare("UPDATE subscribers SET active = 1, referral_code = COALESCE(referral_code, ?) WHERE email = ?")
        .bind(newReferralCode, email)
        .run();
      return {
        response: {
          status: 200,
          body: { success: true, referralCode: keepCode, message: "Welcome back! You've been re-subscribed." },
        },
        storedReferredBy: null,
        storedReferralCode: keepCode,
      };
    }
  }

  await db
    .prepare("INSERT INTO subscribers (email, dates, referral_code, referred_by) VALUES (?, ?, ?, ?)")
    .bind(email, JSON.stringify(dates), newReferralCode, subReferredBy)
    .run();

  return {
    response: { status: 200, body: { success: true, referralCode: newReferralCode } },
    storedReferredBy: subReferredBy,
    storedReferralCode: newReferralCode,
  };
}

/* -------------------------------------------------------------------------
   DB mock helpers
   ------------------------------------------------------------------------- */

function makeReferralDb(subscribers: Subscriber[]): D1Database {
  const store: Subscriber[] = [...subscribers];

  function makeStmt(query: string, bindings: unknown[]): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (...args: unknown[]) => makeStmt(query, args),
      run: async () => {
        if (query.startsWith("INSERT INTO subscribers")) {
          const [email, dates, referral_code, referred_by] = bindings as string[];
          store.push({ email, active: 1, referral_code, referred_by, movie_slug: "project-hail-mary-76779", movie_title: "Project Hail Mary" });
        } else if (query.startsWith("UPDATE subscribers")) {
          // UPDATE ... SET active = 1, referral_code = COALESCE(referral_code, ?) WHERE email = ?
          const [newCode, email] = bindings as string[];
          const sub = store.find((s) => s.email === email);
          if (sub) {
            sub.active = 1;
            if (!sub.referral_code) sub.referral_code = newCode;
          }
        }
        return { success: true };
      },
      first: async <T>() => {
        // SELECT ... FROM subscribers s WHERE referral_code = ?
        if (query.includes("WHERE referral_code =")) {
          const [code] = bindings as string[];
          const sub = store.find((s) => s.referral_code === code);
          if (!sub) return null as unknown as T;
          const referralCount = store.filter((s) => s.referred_by === code && s.active === 1).length;
          return {
            email: sub.email,
            movie_slug: sub.movie_slug || "project-hail-mary-76779",
            movie_title: sub.movie_title || "Project Hail Mary",
            active: sub.active,
            referral_count: referralCount,
          } as unknown as T;
        }
        // SELECT email, active, referral_code FROM subscribers WHERE email = ?
        if (query.includes("WHERE email =")) {
          const [email] = bindings as string[];
          const sub = store.find((s) => s.email === email);
          return (sub ?? null) as unknown as T;
        }
        return null as unknown as T;
      },
      all: async () => ({ results: [] }),
    };
    return stmt;
  }

  return { prepare: (query: string) => makeStmt(query, []) };
}

/* =========================================================================
   GET /api/referral/[code] tests
   ========================================================================= */

describe("GET /api/referral — invalid code format", () => {
  it("returns 400 for empty code", async () => {
    const res = await simulateReferralGet("", undefined);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid referral code/i);
  });

  it("returns 400 for code that is too short (7 chars)", async () => {
    const res = await simulateReferralGet("abcdef1", undefined);
    expect(res.status).toBe(400);
  });

  it("returns 400 for code that is too long (9 chars)", async () => {
    const res = await simulateReferralGet("abcdef123", undefined);
    expect(res.status).toBe(400);
  });

  it("returns 400 for code with non-hex characters", async () => {
    const res = await simulateReferralGet("gggggggg", undefined);
    expect(res.status).toBe(400);
  });

  it("returns 400 for code with uppercase hex (route requires lowercase)", async () => {
    const res = await simulateReferralGet("ABCDEF12", undefined);
    expect(res.status).toBe(400);
  });

  it("accepts valid 8-char lowercase hex code", async () => {
    const res = await simulateReferralGet("abcdef12", undefined);
    expect(res.status).toBe(200); // dev mode returns 200
  });
});

describe("GET /api/referral — dev mode (no DB)", () => {
  it("returns 200 with placeholder data when DB is undefined", async () => {
    const res = await simulateReferralGet("abcdef12", undefined);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.referralCode).toBe("abcdef12");
    expect(res.body.movieSlug).toBe("project-hail-mary-76779");
    expect(res.body.movieTitle).toBe("Project Hail Mary");
    expect(res.body.referralCount).toBe(0);
  });

  it("does not include referrerEmail in dev mode", async () => {
    const res = await simulateReferralGet("abcdef12", undefined);
    expect(res.body.referrerEmail).toBeUndefined();
  });
});

describe("GET /api/referral — code not found", () => {
  it("returns 404 when no subscriber has that referral_code", async () => {
    const db = makeReferralDb([]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 404 for a different code than what's in the DB", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 1, referral_code: "11223344", referred_by: null }]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/referral — code found", () => {
  it("returns 200 with valid:true and referralCode", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 1, referral_code: "aabbccdd", referred_by: null }]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.referralCode).toBe("aabbccdd");
  });

  it("returns movieSlug and movieTitle from the subscriber record", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 1, referral_code: "aabbccdd", referred_by: null, movie_slug: "project-hail-mary-76779", movie_title: "Project Hail Mary" }]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.body.movieSlug).toBe("project-hail-mary-76779");
    expect(res.body.movieTitle).toBe("Project Hail Mary");
  });

  it("masks email: first char + *** + @domain", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 1, referral_code: "aabbccdd", referred_by: null }]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.body.referrerEmail).toBe("a***@example.com");
  });

  it("masks short local part correctly (single char)", async () => {
    const db = makeReferralDb([{ email: "a@b.com", active: 1, referral_code: "aabbccdd", referred_by: null }]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.body.referrerEmail).toBe("a***@b.com");
  });

  it("referralCount is 0 when no one has been referred yet", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 1, referral_code: "aabbccdd", referred_by: null }]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.body.referralCount).toBe(0);
  });

  it("referralCount reflects active subscribers with referred_by = code", async () => {
    const db = makeReferralDb([
      { email: "alice@example.com", active: 1, referral_code: "aabbccdd", referred_by: null },
      { email: "bob@example.com", active: 1, referral_code: "11223344", referred_by: "aabbccdd" },
      { email: "carol@example.com", active: 1, referral_code: "55667788", referred_by: "aabbccdd" },
    ]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.body.referralCount).toBe(2);
  });

  it("inactive referred subscribers are NOT counted", async () => {
    const db = makeReferralDb([
      { email: "alice@example.com", active: 1, referral_code: "aabbccdd", referred_by: null },
      { email: "bob@example.com", active: 0, referral_code: "11223344", referred_by: "aabbccdd" },
    ]);
    const res = await simulateReferralGet("aabbccdd", db);
    expect(res.body.referralCount).toBe(0);
  });
});

/* =========================================================================
   Subscribe POST — referral code generation and tracking
   ========================================================================= */

describe("Subscribe referral — refCode validation", () => {
  it("valid 8-char alphanumeric refCode is stored as referred_by", async () => {
    const db = makeReferralDb([]);
    const result = await simulateSubscribeReferral({ email: "bob@example.com", dates: ["2026-04-01"], refCode: "aabbccdd" }, db);
    expect(result.response.status).toBe(200);
    expect(result.storedReferredBy).toBe("aabbccdd");
  });

  it("invalid refCode (non-alphanumeric) → referred_by is null", async () => {
    const db = makeReferralDb([]);
    const result = await simulateSubscribeReferral({ email: "bob@example.com", dates: ["2026-04-01"], refCode: "ABCDEF12" }, db);
    expect(result.storedReferredBy).toBeNull();
  });

  it("invalid refCode (too short) → referred_by is null", async () => {
    const db = makeReferralDb([]);
    const result = await simulateSubscribeReferral({ email: "bob@example.com", dates: ["2026-04-01"], refCode: "abc" }, db);
    expect(result.storedReferredBy).toBeNull();
  });

  it("missing refCode → referred_by is null", async () => {
    const db = makeReferralDb([]);
    const result = await simulateSubscribeReferral({ email: "bob@example.com", dates: ["2026-04-01"] }, db);
    expect(result.storedReferredBy).toBeNull();
  });
});

describe("Subscribe referral — referral_code generation", () => {
  it("new subscriber receives a referralCode in response", async () => {
    const db = makeReferralDb([]);
    const result = await simulateSubscribeReferral({ email: "bob@example.com", dates: ["2026-04-01"] }, db);
    expect(result.response.body.referralCode).toBeTruthy();
    expect(typeof result.response.body.referralCode).toBe("string");
  });

  it("dev mode: new subscriber gets referralCode even without DB", async () => {
    const result = await simulateSubscribeReferral({ email: "bob@example.com", dates: ["2026-04-01"] }, undefined);
    expect(result.response.body.referralCode).toBeTruthy();
  });
});

describe("Subscribe referral — already active subscriber", () => {
  it("returns existing referral_code for already-active subscriber", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 1, referral_code: "existcode", referred_by: null }]);
    const result = await simulateSubscribeReferral({ email: "alice@example.com", dates: ["2026-04-01"] }, db);
    expect(result.response.body.referralCode).toBe("existcode");
    expect(result.response.body.alreadySubscribed).toBe(true);
  });
});

describe("Subscribe referral — re-subscribe keeps existing referral_code", () => {
  it("inactive subscriber with existing code: re-subscribe keeps the code", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 0, referral_code: "existcode", referred_by: null }]);
    const result = await simulateSubscribeReferral({ email: "alice@example.com", dates: ["2026-04-01"] }, db);
    expect(result.storedReferralCode).toBe("existcode");
    expect(result.response.body.referralCode).toBe("existcode");
  });

  it("inactive subscriber without code: re-subscribe assigns a new code", async () => {
    const db = makeReferralDb([{ email: "alice@example.com", active: 0, referral_code: null, referred_by: null }]);
    const result = await simulateSubscribeReferral({ email: "alice@example.com", dates: ["2026-04-01"] }, db);
    expect(result.storedReferralCode).toBeTruthy();
  });
});
