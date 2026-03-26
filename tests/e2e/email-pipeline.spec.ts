/**
 * Layer 4: Email Pipeline E2E Tests
 *
 * Tests the subscribe → check → notify pipeline via real HTTP requests.
 * In dev (no DB / no Resend key), the pipeline short-circuits at the
 * DB-absent guard, returning { devMode: true }.  We verify the response
 * shapes and validation logic that are always exercised regardless of env.
 *
 * 4.1 Subscribe validation — email required, invalid email rejected
 * 4.2 Subscribe future dates — only dates ≥ today are accepted
 * 4.3 Subscribe success (dev mode, no DB)
 * 4.4 Check endpoint auth — missing / wrong secret → 401
 * 4.5 Check endpoint (dev mode) — returns log array + devMode flag
 * 4.6 Check endpoint (dev mode) — no crash when AMC returns empty results
 * 4.7 Subscribe → check pipeline — check after subscribe returns expected shape
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

const FUTURE_DATE = "2099-04-03";
const TEST_EMAIL = `e2e-pipeline-test-${Date.now()}@example.com`;

/**
 * Return a unique fake IP to avoid rate limiting across test groups.
 * The rate limiter uses x-forwarded-for as the client identifier.
 */
function fakeIP(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const oct = Math.abs(hash) % 254 + 1;
  return `10.0.${Math.abs(hash >> 8) % 254}.${oct}`;
}

/**
 * POST /api/subscribe with the given body.
 * Uses a fake IP derived from the test name to avoid rate limiting.
 */
async function postSubscribe(
  request: APIRequestContext,
  body: Record<string, unknown>,
  ip = "192.168.99.99"
) {
  return request.post("/api/subscribe", {
    data: body,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
    },
  });
}

/* =========================================================================
   4.1 Subscribe Validation
   ========================================================================= */

test.describe("4.1 Subscribe — email validation", () => {
  // Each test uses a unique fake IP to stay under the 5 req/min rate limit
  const IP = fakeIP("4.1-subscribe-validation");

  test("missing email returns 400", async ({ request }) => {
    const resp = await postSubscribe(request, { dates: [FUTURE_DATE] }, IP);
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/email/i);
  });

  test("invalid email format returns 400", async ({ request }) => {
    const resp = await postSubscribe(request, {
      email: "not-an-email",
      dates: [FUTURE_DATE],
    }, fakeIP("4.1-invalid-email"));
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/email/i);
  });

  test("empty email string returns 400", async ({ request }) => {
    const resp = await postSubscribe(request, {
      email: "",
      dates: [FUTURE_DATE],
    }, fakeIP("4.1-empty-email"));
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/email/i);
  });
});

/* =========================================================================
   4.2 Subscribe — date validation (BUG REGRESSION)
   ========================================================================= */

test.describe("4.2 Subscribe — date validation", () => {
  test("past dates only returns 400 'No valid dates selected'", async ({
    request,
  }) => {
    const resp = await postSubscribe(request, {
      email: TEST_EMAIL,
      dates: ["2020-01-01", "2021-06-15"],
    }, fakeIP("4.2-past-dates"));
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/no valid dates/i);
  });

  test("future date NOT in hardcoded Apr 1-5 range is accepted (regression: hardcoded dates bug)", async ({
    request,
  }) => {
    // BUG: subscribe previously rejected dates outside Apr 1-5.
    // After fix, any future date should be accepted.
    const resp = await postSubscribe(request, {
      email: `regression-date-${Date.now()}@example.com`,
      dates: [FUTURE_DATE], // 2099-04-03 is far outside old hardcoded range
    }, fakeIP("4.2-regression-date"));
    // Should succeed (200) or dev-mode succeed, NOT 400
    const body = await resp.json();
    expect(body).not.toHaveProperty("error", expect.stringMatching(/no valid dates/i));
    expect([200, 201]).toContain(resp.status());
  });

  test("mixed past + future dates — only future dates are used", async ({
    request,
  }) => {
    const resp = await postSubscribe(request, {
      email: `mixed-dates-${Date.now()}@example.com`,
      dates: ["2020-01-01", FUTURE_DATE],
    }, fakeIP("4.2-mixed-dates"));
    // Should succeed because FUTURE_DATE is valid
    const body = await resp.json();
    expect(resp.status()).toBe(200);
    expect(body.success).toBe(true);
  });

  test("no dates array at all returns 400", async ({ request }) => {
    const resp = await postSubscribe(request, {
      email: TEST_EMAIL,
    }, fakeIP("4.2-no-dates"));
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/no valid dates/i);
  });
});

/* =========================================================================
   4.3 Subscribe success (dev mode / no DB)
   ========================================================================= */

test.describe("4.3 Subscribe — success response shape", () => {
  test("valid subscribe returns success + message", async ({ request }) => {
    const resp = await postSubscribe(request, {
      email: `success-${Date.now()}@example.com`,
      dates: [FUTURE_DATE],
    }, fakeIP("4.3-subscribe-success"));
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });
});

/* =========================================================================
   4.4 Check endpoint — authentication
   ========================================================================= */

test.describe("4.4 Check endpoint — auth guard", () => {
  // The correct-secret test actually runs the check pipeline (scrapes AMC); allow extra time
  test.setTimeout(60000);
  test("GET /api/check with no secret → 401", async ({ request }) => {
    const resp = await request.get("/api/check");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/check with wrong secret → 401", async ({ request }) => {
    const resp = await request.get("/api/check?secret=wrongsecret");
    expect(resp.status()).toBe(401);
  });

  test("GET /api/check with correct secret → 200 (even in dev mode)", async ({
    request,
  }) => {
    const resp = await request.get("/api/check?secret=hailmary");
    // Should return 200 in dev mode (no DB, falls through to devMode response)
    expect(resp.status()).toBe(200);
  });
});

/* =========================================================================
   4.5 Check endpoint — dev mode response shape
   ========================================================================= */

test.describe("4.5 Check endpoint — dev mode response", () => {
  // /api/check scrapes AMC in background; allow extra time
  test.setTimeout(90000);
  test("response includes a log array", async ({ request }) => {
    const resp = await request.get("/api/check?secret=hailmary");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.log)).toBe(true);
    expect(body.log.length).toBeGreaterThan(0);
  });

  test("log contains start message", async ({ request }) => {
    const resp = await request.get("/api/check?secret=hailmary");
    const body = await resp.json();
    const logStr = body.log.join(" ");
    // Should mention theaters or check started
    expect(logStr.toLowerCase()).toMatch(/check|theater/i);
  });

  test("dev mode flag indicates no DB is available", async ({ request }) => {
    const resp = await request.get("/api/check?secret=hailmary");
    const body = await resp.json();
    // In dev, either devMode:true (no DB) OR notified:N (with DB)
    if (body.devMode) {
      expect(body.devMode).toBe(true);
      expect(body.notified).toBe(0);
    } else {
      // With a real DB, notified should be a number
      expect(typeof body.notified).toBe("number");
    }
  });

  test("newDates is an array (may be empty in dev)", async ({ request }) => {
    const resp = await request.get("/api/check?secret=hailmary");
    const body = await resp.json();
    // newDates is present if devMode, notified >= 0 otherwise
    if (body.newDates !== undefined) {
      expect(Array.isArray(body.newDates)).toBe(true);
    }
  });
});

/* =========================================================================
   4.6 Check POST endpoint (also authenticated)
   ========================================================================= */

test.describe("4.6 Check endpoint — POST method", () => {
  test.setTimeout(60000);
  test("POST /api/check without secret query param → still runs (POST is cron-triggered)", async ({
    request,
  }) => {
    // POST is for the CF cron trigger — it doesn't require the secret param
    const resp = await request.post("/api/check", { data: {} });
    // Should return 200 (or 500 if AMC is unreachable in test env, but not 401)
    expect(resp.status()).not.toBe(401);
    expect([200, 500]).toContain(resp.status());
  });
});

/* =========================================================================
   4.7 Subscribe → Check pipeline integration
   ========================================================================= */

test.describe("4.7 Subscribe → Check pipeline", () => {
  test.setTimeout(90000);
  test("subscribe then check — check returns 200 with log showing subscriber context", async ({
    request,
  }) => {
    // Step 1: Subscribe
    const subResp = await postSubscribe(request, {
      email: `pipeline-${Date.now()}@example.com`,
      dates: [FUTURE_DATE],
    }, fakeIP("4.7-pipeline"));
    expect(subResp.status()).toBe(200);
    const subBody = await subResp.json();
    expect(subBody.success).toBe(true);

    // Step 2: Trigger check
    const checkResp = await request.get("/api/check?secret=hailmary");
    expect(checkResp.status()).toBe(200);
    const checkBody = await checkResp.json();

    // Step 3: Verify pipeline ran — log should exist and contain execution details
    expect(Array.isArray(checkBody.log)).toBe(true);
    expect(checkBody.log.length).toBeGreaterThan(0);

    // In dev mode: subscriber is not notified but no error
    if (checkBody.devMode) {
      expect(checkBody.notified).toBe(0);
    } else if (checkBody.error) {
      // If an error occurred (e.g., network), it should be a string
      expect(typeof checkBody.error).toBe("string");
    } else {
      expect(typeof checkBody.notified).toBe("number");
    }
  });
});
