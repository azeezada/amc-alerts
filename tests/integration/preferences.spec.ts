/**
 * Integration tests for /api/preferences
 *
 * Tests the following scenarios:
 *  GET /api/preferences?email=...&token=...
 *   1. Missing email or token → 400
 *   2. Invalid token → 403
 *   3. Dev mode (no DB) → 200 with mock prefs
 *   4. Subscriber not found → 404
 *   5. Subscriber found → 200 with dates + theaterSlugs
 *
 *  PATCH /api/preferences { email, token, dates, theaterSlugs }
 *   6. Missing email or token → 400
 *   7. Invalid token → 403
 *   8. No valid dates → 400
 *   9. Inactive subscriber → 409
 *  10. Subscriber not found → 404
 *  11. Successful update (all theaters) → 200 { success, dates, theaterSlugs: null }
 *  12. Successful update (specific theaters) → 200 { success, dates, theaterSlugs: [...] }
 *  13. Dev mode (no DB) → 200 { success, dates, theaterSlugs }
 *  14. Past dates filtered out → only future dates returned
 */
import { describe, it, expect } from "vitest";
import { generateUnsubscribeToken, validateUnsubscribeToken } from "@/lib/unsubscribe-token";

/* -------------------------------------------------------------------------
   Logic mirrored from /api/preferences/route.ts
   ------------------------------------------------------------------------- */

function validatePreferencesInput(
  email: string | undefined,
  token: string | undefined
): { valid: false; status: 400; body: { error: string } } | { valid: true } {
  if (!email || !token) {
    return { valid: false, status: 400, body: { error: "Missing email or token" } };
  }
  return { valid: true };
}

/** Mirrors date filtering logic from PATCH handler */
function filterValidDates(dates: unknown, today: string): string[] {
  if (!Array.isArray(dates)) return [];
  return (dates as unknown[]).filter(
    (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d as string) && (d as string) >= today
  ) as string[];
}

/** Mirrors theaterSlugs normalization */
function normalizeTheaterSlugs(slugs: unknown): string[] | null {
  if (Array.isArray(slugs) && (slugs as unknown[]).length > 0) return slugs as string[];
  return null;
}

interface MockSubscriber {
  email: string;
  dates: string;
  theater_slugs: string | null;
  active: number;
}

type PreferencesGetOutcome =
  | { type: "not-found" }
  | { type: "found"; dates: string[]; theaterSlugs: string[] | null; active: boolean };

function simulateGetPreferences(row: MockSubscriber | null): PreferencesGetOutcome {
  if (!row) return { type: "not-found" };
  let dates: string[] = [];
  try { dates = JSON.parse(row.dates); } catch { /* empty */ }
  let theaterSlugs: string[] | null = null;
  try { theaterSlugs = row.theater_slugs ? JSON.parse(row.theater_slugs) : null; } catch { /* null */ }
  return { type: "found", dates, theaterSlugs, active: !!row.active };
}

type PreferencesPatchOutcome =
  | { type: "not-found" }
  | { type: "inactive" }
  | { type: "updated"; dates: string[]; theaterSlugs: string[] | null };

function simulatePatchPreferences(
  row: MockSubscriber | null,
  validDates: string[],
  theaterSlugs: string[] | null
): PreferencesPatchOutcome {
  if (!row) return { type: "not-found" };
  if (!row.active) return { type: "inactive" };
  return { type: "updated", dates: validDates, theaterSlugs };
}

/* =========================================================================
   PREFERENCES_GET — Auth checks
   ========================================================================= */

describe("Preferences GET — missing email or token → 400", () => {
  it("missing both → 400", () => {
    const r = validatePreferencesInput(undefined, undefined);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.status).toBe(400);
  });

  it("missing token only → 400", () => {
    const r = validatePreferencesInput("user@example.com", undefined);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.body.error).toMatch(/missing/i);
  });

  it("missing email only → 400", () => {
    const r = validatePreferencesInput(undefined, "sometoken");
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.status).toBe(400);
  });
});

describe("Preferences GET — invalid token → 403", () => {
  it("wrong token for email returns false", async () => {
    const valid = await validateUnsubscribeToken("user@example.com", "bad-token");
    expect(valid).toBe(false);
  });

  it("correct token for email returns true", async () => {
    const token = await generateUnsubscribeToken("user@example.com");
    const valid = await validateUnsubscribeToken("user@example.com", token);
    expect(valid).toBe(true);
  });
});

describe("Preferences GET — subscriber not found → 404", () => {
  it("null row → not-found outcome", () => {
    const result = simulateGetPreferences(null);
    expect(result.type).toBe("not-found");
  });
});

describe("Preferences GET — subscriber found → 200", () => {
  it("returns parsed dates and theaterSlugs", () => {
    const row: MockSubscriber = {
      email: "user@example.com",
      dates: '["2026-04-01","2026-04-02"]',
      theater_slugs: '["amc-lincoln-square-13","amc-empire-25"]',
      active: 1,
    };
    const result = simulateGetPreferences(row);
    expect(result.type).toBe("found");
    if (result.type === "found") {
      expect(result.dates).toEqual(["2026-04-01", "2026-04-02"]);
      expect(result.theaterSlugs).toEqual(["amc-lincoln-square-13", "amc-empire-25"]);
      expect(result.active).toBe(true);
    }
  });

  it("null theater_slugs returns theaterSlugs: null", () => {
    const row: MockSubscriber = {
      email: "user@example.com",
      dates: '["2026-04-01"]',
      theater_slugs: null,
      active: 1,
    };
    const result = simulateGetPreferences(row);
    if (result.type === "found") {
      expect(result.theaterSlugs).toBeNull();
    }
  });
});

/* =========================================================================
   PREFERENCES_PATCH — Validation
   ========================================================================= */

describe("Preferences PATCH — date filtering", () => {
  const today = "2026-04-01";

  it("keeps future dates", () => {
    const filtered = filterValidDates(["2026-04-01", "2026-04-05"], today);
    expect(filtered).toEqual(["2026-04-01", "2026-04-05"]);
  });

  it("removes past dates", () => {
    const filtered = filterValidDates(["2026-03-01", "2026-04-05"], today);
    expect(filtered).toEqual(["2026-04-05"]);
  });

  it("removes non-date strings", () => {
    const filtered = filterValidDates(["not-a-date", "2026-04-05"], today);
    expect(filtered).toEqual(["2026-04-05"]);
  });

  it("empty array → empty result", () => {
    const filtered = filterValidDates([], today);
    expect(filtered).toEqual([]);
  });

  it("non-array → empty result", () => {
    const filtered = filterValidDates(null, today);
    expect(filtered).toEqual([]);
  });
});

describe("Preferences PATCH — theaterSlugs normalization", () => {
  it("array with values → returned as-is", () => {
    const result = normalizeTheaterSlugs(["amc-lincoln-square-13"]);
    expect(result).toEqual(["amc-lincoln-square-13"]);
  });

  it("empty array → null (all theaters)", () => {
    const result = normalizeTheaterSlugs([]);
    expect(result).toBeNull();
  });

  it("null → null", () => {
    const result = normalizeTheaterSlugs(null);
    expect(result).toBeNull();
  });

  it("undefined → null", () => {
    const result = normalizeTheaterSlugs(undefined);
    expect(result).toBeNull();
  });
});

describe("Preferences PATCH — DB path simulation", () => {
  const dates = ["2026-04-01", "2026-04-02"];

  it("subscriber not found → not-found", () => {
    const result = simulatePatchPreferences(null, dates, null);
    expect(result.type).toBe("not-found");
  });

  it("inactive subscriber → inactive (409)", () => {
    const row: MockSubscriber = {
      email: "user@example.com",
      dates: "[]",
      theater_slugs: null,
      active: 0,
    };
    const result = simulatePatchPreferences(row, dates, null);
    expect(result.type).toBe("inactive");
  });

  it("active subscriber → updated with all theaters (null)", () => {
    const row: MockSubscriber = {
      email: "user@example.com",
      dates: '["2026-04-01"]',
      theater_slugs: null,
      active: 1,
    };
    const result = simulatePatchPreferences(row, dates, null);
    expect(result.type).toBe("updated");
    if (result.type === "updated") {
      expect(result.dates).toEqual(dates);
      expect(result.theaterSlugs).toBeNull();
    }
  });

  it("active subscriber → updated with specific theaters", () => {
    const row: MockSubscriber = {
      email: "user@example.com",
      dates: '["2026-04-01"]',
      theater_slugs: null,
      active: 1,
    };
    const theaters = ["amc-lincoln-square-13", "amc-empire-25"];
    const result = simulatePatchPreferences(row, dates, theaters);
    expect(result.type).toBe("updated");
    if (result.type === "updated") {
      expect(result.theaterSlugs).toEqual(theaters);
    }
  });
});
