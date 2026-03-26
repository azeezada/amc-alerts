/**
 * Gap 4.2 — E2E: Subscribe → Unsubscribe → Re-subscribe Lifecycle
 *
 * Full round-trip tests for the subscription lifecycle via HTTP API.
 * These tests make actual HTTP requests against the running server to verify
 * that the subscribe and unsubscribe endpoints work correctly in sequence.
 *
 * Coverage:
 *   4.2.1  Subscribe → success response shape
 *   4.2.2  Subscribe → unsubscribe with valid token → success
 *   4.2.3  Subscribe → unsubscribe → re-subscribe → "Welcome back!" or fresh success
 *   4.2.4  Unsubscribe with invalid token → 403 (token must match email)
 *   4.2.5  Unsubscribe → unsubscribe again → idempotent success (dev mode)
 *   4.2.6  Re-subscribe after unsubscribe preserves all required response fields
 *   4.2.7  Unsubscribe page loads with email+token URL params (UI smoke test)
 *
 * Notes:
 *   - In dev mode (no D1 DB), subscribe always returns fresh success and
 *     unsubscribe always returns "You have been unsubscribed." without DB writes.
 *   - In production (D1 DB available), re-subscribe returns "Welcome back!" for
 *     previously unsubscribed users.
 *   - The HMAC token logic is inlined here (mirrors lib/unsubscribe-token.ts)
 *     because Playwright tests run in Node.js and cannot use @/ path aliases.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

/* -------------------------------------------------------------------------
   Token generation (mirrors lib/unsubscribe-token.ts)
   Uses Web Crypto API which is available in Node 18+ and browsers.
   ------------------------------------------------------------------------- */

const UNSUB_SECRET = "amc-alerts-unsub-2026";

async function generateToken(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const normalized = email.toLowerCase().trim();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(normalized));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/* -------------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------------- */

const FUTURE_DATE = "2099-05-01";

/**
 * Derive a deterministic fake IP from a seed string to avoid rate limiting.
 * The subscribe endpoint limits to 5 req/min per IP.
 */
function fakeIP(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const oct = Math.abs(hash) % 254 + 1;
  return `10.42.${Math.abs(hash >> 8) % 254}.${oct}`;
}

async function postSubscribe(
  request: APIRequestContext,
  email: string,
  ip: string
) {
  return request.post("/api/subscribe", {
    data: { email, dates: [FUTURE_DATE] },
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  });
}

async function postUnsubscribe(
  request: APIRequestContext,
  email: string,
  token: string,
  ip: string
) {
  return request.post("/api/unsubscribe", {
    data: { email, token },
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
  });
}

/* =========================================================================
   4.2.1 Subscribe — success response shape
   Baseline: verify the subscribe endpoint works before testing the lifecycle.
   ========================================================================= */

test.describe("4.2.1 Subscribe — response shape", () => {
  test("valid subscribe returns 200 with success:true and message", async ({ request }) => {
    const email = `lifecycle-baseline-${Date.now()}@example.com`;
    const resp = await postSubscribe(request, email, fakeIP(`4.2.1-baseline-${email}`));
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  test("subscribe returns 'on the list' message (not 'welcome back') for new email", async ({ request }) => {
    const email = `lifecycle-new-${Date.now()}@example.com`;
    const resp = await postSubscribe(request, email, fakeIP(`4.2.1-new-${email}`));
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    // In dev mode: fresh subscribe message. In prod with no prior record: same.
    // "Welcome back!" only appears when re-subscribing a previously unsubscribed row.
    expect(body.message).not.toMatch(/welcome back/i);
  });
});

/* =========================================================================
   4.2.2 Subscribe → unsubscribe with valid token
   ========================================================================= */

test.describe("4.2.2 Subscribe → unsubscribe", () => {
  test("unsubscribe with valid HMAC token returns 200 success", async ({ request }) => {
    const email = `unsub-valid-${Date.now()}@example.com`;
    const ip = fakeIP(`4.2.2-unsub-valid-${email}`);

    // Step 1: Subscribe
    const subResp = await postSubscribe(request, email, ip);
    expect(subResp.status()).toBe(200);
    expect((await subResp.json()).success).toBe(true);

    // Step 2: Generate correct token and unsubscribe
    const token = await generateToken(email);
    const unsubResp = await postUnsubscribe(request, email, token, fakeIP(`4.2.2-token-${email}`));
    expect(unsubResp.status()).toBe(200);
    const unsubBody = await unsubResp.json();
    expect(unsubBody.success).toBe(true);
    // Message varies by mode: dev → "unsubscribed.", prod → "You will no longer receive alerts."
    expect(unsubBody.message).toMatch(/unsubscribed/i);
  });

  test("unsubscribe response does not contain an error field on success", async ({ request }) => {
    const email = `unsub-no-err-${Date.now()}@example.com`;
    const ip = fakeIP(`4.2.2-no-err-${email}`);

    await postSubscribe(request, email, ip);
    const token = await generateToken(email);
    const resp = await postUnsubscribe(request, email, token, fakeIP(`4.2.2-no-err2-${email}`));
    const body = await resp.json();
    expect(resp.status()).toBe(200);
    expect(body).not.toHaveProperty("error");
    expect(body.success).toBe(true);
  });
});

/* =========================================================================
   4.2.3 Subscribe → unsubscribe → re-subscribe
   ========================================================================= */

test.describe("4.2.3 Re-subscribe lifecycle", () => {
  test("re-subscribe after unsubscribe returns 200 success", async ({ request }) => {
    const email = `re-sub-${Date.now()}@example.com`;
    const ip1 = fakeIP(`4.2.3-resub-sub-${email}`);
    const ip2 = fakeIP(`4.2.3-resub-unsub-${email}`);
    const ip3 = fakeIP(`4.2.3-resub-re-${email}`);

    // Step 1: Subscribe
    const sub1 = await postSubscribe(request, email, ip1);
    expect(sub1.status()).toBe(200);
    expect((await sub1.json()).success).toBe(true);

    // Step 2: Unsubscribe
    const token = await generateToken(email);
    const unsub = await postUnsubscribe(request, email, token, ip2);
    expect(unsub.status()).toBe(200);
    expect((await unsub.json()).success).toBe(true);

    // Step 3: Re-subscribe
    const sub2 = await postSubscribe(request, email, ip3);
    expect(sub2.status()).toBe(200);
    const body = await sub2.json();
    expect(body.success).toBe(true);
    // In prod: "Welcome back! You've been re-subscribed."
    // In dev mode: "You're on the list!" (no DB = no re-subscribe detection)
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  test("re-subscribe returns success:true (not an error)", async ({ request }) => {
    const email = `re-sub-ok-${Date.now()}@example.com`;
    const ip1 = fakeIP(`4.2.3-ok-sub-${email}`);
    const ip2 = fakeIP(`4.2.3-ok-unsub-${email}`);
    const ip3 = fakeIP(`4.2.3-ok-re-${email}`);

    await postSubscribe(request, email, ip1);
    const token = await generateToken(email);
    await postUnsubscribe(request, email, token, ip2);
    const re = await postSubscribe(request, email, ip3);
    const body = await re.json();
    expect(re.status()).toBe(200);
    expect(body).not.toHaveProperty("error");
    expect(body.success).toBe(true);
  });
});

/* =========================================================================
   4.2.4 Unsubscribe with invalid token → 403
   ========================================================================= */

test.describe("4.2.4 Invalid token rejection", () => {
  test("unsubscribe with wrong token → 403", async ({ request }) => {
    const email = `invalid-tok-${Date.now()}@example.com`;
    await postSubscribe(request, email, fakeIP(`4.2.4-sub-${email}`));

    const wrongToken = "completely-wrong-token";
    const resp = await postUnsubscribe(request, email, wrongToken, fakeIP(`4.2.4-unsub-${email}`));
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/invalid.*token/i);
  });

  test("token for different email cannot unsubscribe another user → 403", async ({ request }) => {
    const emailA = `tok-mismatch-a-${Date.now()}@example.com`;
    const emailB = `tok-mismatch-b-${Date.now()}@example.com`;

    // Subscribe emailA
    await postSubscribe(request, emailA, fakeIP(`4.2.4-mismatch-sub-${emailA}`));

    // Use token generated for emailB to try to unsubscribe emailA
    const tokenForB = await generateToken(emailB);
    const resp = await postUnsubscribe(request, emailA, tokenForB, fakeIP(`4.2.4-mismatch-unsub-${emailA}`));
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.error).toMatch(/invalid.*token/i);
  });

  test("tampered token (single character changed) → 403", async ({ request }) => {
    const email = `tampered-${Date.now()}@example.com`;
    await postSubscribe(request, email, fakeIP(`4.2.4-tamper-sub-${email}`));

    const realToken = await generateToken(email);
    // Flip the last character
    const tampered = realToken.slice(0, -1) + (realToken.slice(-1) === "a" ? "b" : "a");
    const resp = await postUnsubscribe(request, email, tampered, fakeIP(`4.2.4-tamper-unsub-${email}`));
    expect(resp.status()).toBe(403);
  });
});

/* =========================================================================
   4.2.5 Unsubscribe twice — idempotent
   ========================================================================= */

test.describe("4.2.5 Double unsubscribe — idempotent", () => {
  test("unsubscribing twice returns success both times (no error on second call)", async ({ request }) => {
    const email = `double-unsub-${Date.now()}@example.com`;
    const ip1 = fakeIP(`4.2.5-sub-${email}`);
    const ip2 = fakeIP(`4.2.5-unsub1-${email}`);
    const ip3 = fakeIP(`4.2.5-unsub2-${email}`);

    // Subscribe
    await postSubscribe(request, email, ip1);

    const token = await generateToken(email);

    // First unsubscribe
    const resp1 = await postUnsubscribe(request, email, token, ip2);
    expect(resp1.status()).toBe(200);
    expect((await resp1.json()).success).toBe(true);

    // Second unsubscribe — should not error; idempotent
    const resp2 = await postUnsubscribe(request, email, token, ip3);
    expect(resp2.status()).toBe(200);
    const body2 = await resp2.json();
    expect(body2.success).toBe(true);
    // In prod: "You are already unsubscribed." or "Email not found." (both success:true)
    // In dev: "You have been unsubscribed." (dev mode always returns this)
    expect(body2).not.toHaveProperty("error");
  });
});

/* =========================================================================
   4.2.6 Re-subscribe preserves response fields
   ========================================================================= */

test.describe("4.2.6 Re-subscribe response contract", () => {
  test("re-subscribe response always has success and message fields", async ({ request }) => {
    const email = `fields-${Date.now()}@example.com`;
    const ip1 = fakeIP(`4.2.6-sub-${email}`);
    const ip2 = fakeIP(`4.2.6-unsub-${email}`);
    const ip3 = fakeIP(`4.2.6-re-${email}`);

    await postSubscribe(request, email, ip1);
    const token = await generateToken(email);
    await postUnsubscribe(request, email, token, ip2);

    const reResp = await postSubscribe(request, email, ip3);
    const body = await reResp.json();

    expect(reResp.status()).toBe(200);
    // The response contract: always has success:true and a string message
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("message");
    expect(typeof body.message).toBe("string");
  });

  test("lifecycle does not produce 5xx errors at any stage", async ({ request }) => {
    const email = `no-5xx-${Date.now()}@example.com`;
    const ip1 = fakeIP(`4.2.6-5xx-sub-${email}`);
    const ip2 = fakeIP(`4.2.6-5xx-unsub-${email}`);
    const ip3 = fakeIP(`4.2.6-5xx-re-${email}`);

    const subResp = await postSubscribe(request, email, ip1);
    expect(subResp.status()).toBeLessThan(500);

    const token = await generateToken(email);
    const unsubResp = await postUnsubscribe(request, email, token, ip2);
    expect(unsubResp.status()).toBeLessThan(500);

    const reSubResp = await postSubscribe(request, email, ip3);
    expect(reSubResp.status()).toBeLessThan(500);
  });
});

/* =========================================================================
   4.2.7 Unsubscribe page UI smoke test
   Tests that the /unsubscribe page renders correctly with URL params.
   ========================================================================= */

test.describe("4.2.7 Unsubscribe page — UI smoke test", () => {
  test("unsubscribe page loads with email and token URL params", async ({ page }) => {
    const email = "smoke-test@example.com";
    const token = await generateToken(email);

    await page.goto(`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);

    // Page should show the "Unsubscribe" heading
    await page.waitForSelector("h1");
    const heading = await page.locator("h1").textContent();
    expect(heading).toMatch(/unsubscribe/i);
  });

  test("unsubscribe page shows email when token+email present in URL", async ({ page }) => {
    const email = "smoke-display@example.com";
    const token = await generateToken(email);

    await page.goto(`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);

    // Wait for React hydration — the email is rendered via useEffect from URL params
    await page.waitForTimeout(500);
    const content = await page.content();
    // The page renders the email address in the confirmation text
    expect(content).toContain("smoke-display@example.com");
  });

  test("unsubscribe page shows Unsubscribe button", async ({ page }) => {
    const email = "button-smoke@example.com";
    const token = await generateToken(email);

    await page.goto(`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);

    await page.waitForTimeout(500);
    const button = page.locator("button:has-text('Unsubscribe')");
    await expect(button).toBeVisible();
  });
});
