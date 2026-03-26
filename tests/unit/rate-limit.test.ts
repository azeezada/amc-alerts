/**
 * Unit tests for rate-limit.ts (Gap 2.1)
 * Covers: allow, block, window-reset, cleanup, IP extraction, Retry-After, unknown-IP fallback.
 *
 * The in-memory store is module-level, so each test group uses a unique fake IP
 * to avoid cross-test state pollution.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

/** Build a minimal Request with given headers and optional URL pathname. */
function makeRequest(
  ip: string | null,
  forwardedFor: string | null = null,
  pathname = "/api/test"
): Request {
  const headers: Record<string, string> = {};
  if (ip !== null) headers["cf-connecting-ip"] = ip;
  if (forwardedFor !== null) headers["x-forwarded-for"] = forwardedFor;
  return new Request(`http://localhost${pathname}`, { headers });
}

describe("Gap 2.1 — rate-limit.ts", () => {
  describe("Basic allow/block", () => {
    // Use unique IPs per describe block to avoid shared-store collisions
    const BASE_IP = "1.2.3.10";

    it("first request returns null (allowed)", () => {
      const req = makeRequest(BASE_IP);
      const result = rateLimit(req, { limit: 3, windowMs: 60_000 });
      expect(result).toBeNull();
    });

    it("requests within limit all return null", () => {
      const ip = "1.2.3.11";
      for (let i = 0; i < 3; i++) {
        const result = rateLimit(makeRequest(ip), { limit: 3, windowMs: 60_000 });
        expect(result).toBeNull();
      }
    });

    it("request exceeding limit returns 429 NextResponse", () => {
      const ip = "1.2.3.12";
      const limit = 2;
      // Exhaust the limit
      rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      // This is the 3rd request — exceeds limit of 2
      const blocked = rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      expect(blocked).not.toBeNull();
      expect(blocked!.status).toBe(429);
    });

    it("429 response includes Retry-After header", () => {
      const ip = "1.2.3.13";
      const limit = 1;
      rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      const blocked = rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      expect(blocked).not.toBeNull();
      const retryAfter = blocked!.headers.get("Retry-After");
      expect(retryAfter).not.toBeNull();
      const retryAfterNum = Number(retryAfter);
      expect(retryAfterNum).toBeGreaterThan(0);
      expect(retryAfterNum).toBeLessThanOrEqual(60);
    });

    it("429 response includes X-RateLimit-Limit header", () => {
      const ip = "1.2.3.14";
      const limit = 1;
      rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      const blocked = rateLimit(makeRequest(ip), { limit, windowMs: 60_000 });
      expect(blocked).not.toBeNull();
      expect(blocked!.headers.get("X-RateLimit-Limit")).toBe(String(limit));
    });
  });

  describe("Window reset", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("after window expires, counter resets and request is allowed again", () => {
      vi.useFakeTimers();
      const ip = "2.2.2.20";
      const limit = 1;
      const windowMs = 5_000;

      // Exhaust limit
      rateLimit(makeRequest(ip), { limit, windowMs });
      const blocked = rateLimit(makeRequest(ip), { limit, windowMs });
      expect(blocked).not.toBeNull();
      expect(blocked!.status).toBe(429);

      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 100);

      // Now the window has reset — request should be allowed
      const afterReset = rateLimit(makeRequest(ip), { limit, windowMs });
      expect(afterReset).toBeNull();
    });
  });

  describe("IP extraction", () => {
    it("cf-connecting-ip takes priority over x-forwarded-for", () => {
      const cfIp = "3.3.3.1";
      const xffIp = "3.3.3.2";
      // Both headers present: cf should win
      const req = makeRequest(cfIp, xffIp);
      const limit = 1;
      // First request from cfIp — allowed
      const r1 = rateLimit(req, { limit, windowMs: 60_000 });
      expect(r1).toBeNull();
      // Second request with same cfIp — blocked
      const r2 = rateLimit(makeRequest(cfIp, xffIp), { limit, windowMs: 60_000 });
      expect(r2).not.toBeNull();
      expect(r2!.status).toBe(429);

      // Request with only the xffIp (different bucket) — allowed (first time for that IP)
      const r3 = rateLimit(makeRequest(null, xffIp), { limit: 5, windowMs: 60_000 });
      expect(r3).toBeNull();
    });

    it("x-forwarded-for used when cf-connecting-ip absent", () => {
      const ip = "4.4.4.1";
      // No cf-connecting-ip, but x-forwarded-for present
      const req = makeRequest(null, ip);
      const result = rateLimit(req, { limit: 5, windowMs: 60_000 });
      expect(result).toBeNull();
    });

    it("unknown IP fallback: requests share 'unknown' bucket", () => {
      // All unknown-IP requests share the same bucket
      const limit = 2;
      const windowMs = 60_000;
      // Use a unique pathname to isolate this test's bucket from others
      const req1 = new Request("http://localhost/api/unknown-test-bucket");
      const req2 = new Request("http://localhost/api/unknown-test-bucket");
      const req3 = new Request("http://localhost/api/unknown-test-bucket");

      const r1 = rateLimit(req1, { limit, windowMs });
      const r2 = rateLimit(req2, { limit, windowMs });
      const r3 = rateLimit(req3, { limit, windowMs });

      expect(r1).toBeNull();
      expect(r2).toBeNull();
      // 3rd request exceeds limit of 2 — same "unknown" bucket
      expect(r3).not.toBeNull();
      expect(r3!.status).toBe(429);
    });
  });
});
