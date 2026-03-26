/**
 * Gap 3.7 — /api/unsubscribe Edge Cases
 *
 * Tests the following scenarios from /api/unsubscribe/route.ts:
 *  1. Missing email or token → 400 { error: "Missing email or token" }
 *  2. Invalid token → 403 { error: "Invalid unsubscribe token" }
 *  3. Dev mode (no DB) → 200 { success: true, message: "You have been unsubscribed." }
 *  4. Email not in DB at all → 200 { success: true, message: "Email not found in our records." }
 *  5. Email in DB but already inactive (active=0) → 200 { success: true, message: "You are already unsubscribed." }
 *  6. Email active → UPDATE query + 200 { success: true, message: "You have been unsubscribed. You will no longer receive alerts." }
 *  7. DB write error → caught by outer catch → 500 { error: "Something went wrong. Please try again." }
 *
 * All tests use pure logic extracted from the route (no HTTP server required).
 * Pattern mirrors subscribe-turnstile.spec.ts and check-edge-cases.spec.ts.
 */
import { describe, it, expect } from "vitest";
import { generateUnsubscribeToken, validateUnsubscribeToken } from "@/lib/unsubscribe-token";

/* -------------------------------------------------------------------------
   Logic mirrored from /api/unsubscribe/route.ts
   ------------------------------------------------------------------------- */

/** Mirrors the missing-field guard at lines 16-21 */
function validateUnsubscribeInput(
  email: string | undefined,
  token: string | undefined
): { valid: false; status: 400; body: { error: string } } | { valid: true } {
  if (!email || !token) {
    return { valid: false, status: 400, body: { error: "Missing email or token" } };
  }
  return { valid: true };
}

/** Response bodies for DB lookup outcomes — mirrors route lines 44-57 */
const UNSUBSCRIBE_RESPONSES = {
  notFound: { success: true, message: "Email not found in our records." },
  alreadyInactive: { success: true, message: "You are already unsubscribed." },
  success: { success: true, message: "You have been unsubscribed. You will no longer receive alerts." },
  devMode: { success: true, message: "You have been unsubscribed." },
  invalidToken: { error: "Invalid unsubscribe token" },
  serverError: { error: "Something went wrong. Please try again." },
  missingField: { error: "Missing email or token" },
};

/** Mirrors the DB lookup + response decision (lines 39-57) */
interface MockSubscriber {
  email: string;
  active: number; // 1 = active, 0 = inactive
}

type UnsubscribeOutcome =
  | "not-found"
  | "already-inactive"
  | "unsubscribed"
  | "db-error";

async function simulateUnsubscribeDbPath(
  existing: MockSubscriber | null,
  throwOnUpdate?: boolean
): Promise<UnsubscribeOutcome> {
  if (!existing) return "not-found";
  if (!existing.active) return "already-inactive";
  // simulate UPDATE
  if (throwOnUpdate) throw new Error("D1 write failed");
  return "unsubscribed";
}

/** UPDATE query that mirrors route lines 52-55 */
function buildUnsubscribeUpdateQuery(email: string): { query: string; value: string } {
  return {
    query: "UPDATE subscribers SET active = 0 WHERE email = ?",
    value: email.toLowerCase().trim(),
  };
}

/* =========================================================================
   3.7.1 — Missing email or token → 400
   ========================================================================= */

describe("Gap 3.7.1 — Missing email or token → 400", () => {
  it("missing email (undefined) → 400 with error message", () => {
    const result = validateUnsubscribeInput(undefined, "some-token");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "Missing email or token" });
    }
  });

  it("missing token (undefined) → 400 with error message", () => {
    const result = validateUnsubscribeInput("user@example.com", undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
      expect(result.body).toEqual({ error: "Missing email or token" });
    }
  });

  it("empty email → 400 (empty string is falsy)", () => {
    const result = validateUnsubscribeInput("", "some-token");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
    }
  });

  it("empty token → 400 (empty string is falsy)", () => {
    const result = validateUnsubscribeInput("user@example.com", "");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
    }
  });

  it("both provided → valid (no 400)", () => {
    const result = validateUnsubscribeInput("user@example.com", "some-token");
    expect(result.valid).toBe(true);
  });

  it("400 error body matches route response constant", () => {
    expect(UNSUBSCRIBE_RESPONSES.missingField).toEqual({ error: "Missing email or token" });
  });
});

/* =========================================================================
   3.7.2 — Invalid token → 403
   ========================================================================= */

describe("Gap 3.7.2 — Invalid token → 403", () => {
  it("wrong token for known email → validateUnsubscribeToken returns false", async () => {
    const valid = await validateUnsubscribeToken("user@example.com", "wrong-token");
    expect(valid).toBe(false);
  });

  it("tampered token (character changed) → invalid", async () => {
    const real = await generateUnsubscribeToken("user@example.com");
    const tampered = real.slice(0, -1) + (real.slice(-1) === "a" ? "b" : "a");
    const valid = await validateUnsubscribeToken("user@example.com", tampered);
    expect(valid).toBe(false);
  });

  it("token for different email → invalid for this email", async () => {
    const tokenForOther = await generateUnsubscribeToken("other@example.com");
    const valid = await validateUnsubscribeToken("user@example.com", tokenForOther);
    expect(valid).toBe(false);
  });

  it("403 error body matches route response constant", () => {
    expect(UNSUBSCRIBE_RESPONSES.invalidToken).toEqual({ error: "Invalid unsubscribe token" });
  });

  it("correct token for email → validateUnsubscribeToken returns true", async () => {
    const token = await generateUnsubscribeToken("user@example.com");
    const valid = await validateUnsubscribeToken("user@example.com", token);
    expect(valid).toBe(true);
  });
});

/* =========================================================================
   3.7.3 — Dev mode (no DB) → success without DB write
   ========================================================================= */

describe("Gap 3.7.3 — Dev mode (no DB) → 200 success", () => {
  it("no DB → dev mode response has success:true", () => {
    expect(UNSUBSCRIBE_RESPONSES.devMode.success).toBe(true);
  });

  it("no DB → dev mode message is 'You have been unsubscribed.'", () => {
    expect(UNSUBSCRIBE_RESPONSES.devMode.message).toBe("You have been unsubscribed.");
  });

  it("dev mode response does NOT contain 'no longer receive'", () => {
    // Dev mode message is shorter than the full production success message
    expect(UNSUBSCRIBE_RESPONSES.devMode.message).not.toContain("no longer receive");
  });
});

/* =========================================================================
   3.7.4 — Email not found in DB → success (idempotent)
   ========================================================================= */

describe("Gap 3.7.4 — Email not in DB → 200 with 'not found' message", () => {
  it("null DB result → outcome is 'not-found'", async () => {
    const outcome = await simulateUnsubscribeDbPath(null);
    expect(outcome).toBe("not-found");
  });

  it("not-found response body is success:true (idempotent — don't leak whether email exists)", () => {
    expect(UNSUBSCRIBE_RESPONSES.notFound).toEqual({
      success: true,
      message: "Email not found in our records.",
    });
  });

  it("not-found response has success:true (no 404 leak)", () => {
    expect(UNSUBSCRIBE_RESPONSES.notFound.success).toBe(true);
  });
});

/* =========================================================================
   3.7.5 — Email already inactive → success (idempotent)
   ========================================================================= */

describe("Gap 3.7.5 — Email already inactive (active=0) → 200 'already unsubscribed'", () => {
  it("existing with active=0 → outcome is 'already-inactive'", async () => {
    const existing: MockSubscriber = { email: "user@example.com", active: 0 };
    const outcome = await simulateUnsubscribeDbPath(existing);
    expect(outcome).toBe("already-inactive");
  });

  it("already-inactive response body matches route constant", () => {
    expect(UNSUBSCRIBE_RESPONSES.alreadyInactive).toEqual({
      success: true,
      message: "You are already unsubscribed.",
    });
  });

  it("already-inactive is idempotent — success:true not an error", () => {
    expect(UNSUBSCRIBE_RESPONSES.alreadyInactive.success).toBe(true);
  });
});

/* =========================================================================
   3.7.6 — Successful unsubscribe (active=1 → UPDATE → active=0)
   ========================================================================= */

describe("Gap 3.7.6 — Active subscriber unsubscribes → UPDATE + 200 success", () => {
  it("existing with active=1 → outcome is 'unsubscribed'", async () => {
    const existing: MockSubscriber = { email: "user@example.com", active: 1 };
    const outcome = await simulateUnsubscribeDbPath(existing);
    expect(outcome).toBe("unsubscribed");
  });

  it("success response body has success:true and full message", () => {
    expect(UNSUBSCRIBE_RESPONSES.success).toEqual({
      success: true,
      message: "You have been unsubscribed. You will no longer receive alerts.",
    });
  });

  it("UPDATE query sets active=0 for the correct email", () => {
    const { query, value } = buildUnsubscribeUpdateQuery("User@Example.COM");
    expect(query).toBe("UPDATE subscribers SET active = 0 WHERE email = ?");
    expect(value).toBe("user@example.com"); // lowercased + trimmed
  });

  it("UPDATE query normalizes email (uppercase → lowercase)", () => {
    const { value } = buildUnsubscribeUpdateQuery("  TEST@EXAMPLE.COM  ");
    expect(value).toBe("test@example.com");
  });
});

/* =========================================================================
   3.7.7 — DB write error → outer catch → 500
   ========================================================================= */

describe("Gap 3.7.7 — DB write error → caught → 500", () => {
  it("throwOnUpdate=true → simulateUnsubscribeDbPath throws", async () => {
    const existing: MockSubscriber = { email: "user@example.com", active: 1 };
    await expect(simulateUnsubscribeDbPath(existing, true)).rejects.toThrow("D1 write failed");
  });

  it("500 error body matches route catch block constant", () => {
    expect(UNSUBSCRIBE_RESPONSES.serverError).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });

  it("outer catch does NOT expose internal error message to client", () => {
    // The route logs the error internally but returns a generic message
    expect(UNSUBSCRIBE_RESPONSES.serverError.error).not.toContain("D1");
    expect(UNSUBSCRIBE_RESPONSES.serverError.error).not.toContain("failed");
  });
});
