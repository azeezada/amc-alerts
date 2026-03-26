/**
 * Unit tests for unsubscribe-token.ts (Gap 2.2)
 * Covers HMAC generation, validation, email normalization, and tamper detection.
 */
import { describe, it, expect } from "vitest";
import {
  generateUnsubscribeToken,
  validateUnsubscribeToken,
} from "@/lib/unsubscribe-token";

describe("Gap 2.2 — unsubscribe-token.ts", () => {
  it("generateUnsubscribeToken produces a non-empty base64url string", async () => {
    const token = await generateUnsubscribeToken("user@example.com");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    // base64url: only alphanumeric, hyphens, underscores — no +, /, or trailing =
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("same email always produces the same token (stable HMAC)", async () => {
    const t1 = await generateUnsubscribeToken("alice@example.com");
    const t2 = await generateUnsubscribeToken("alice@example.com");
    expect(t1).toBe(t2);
  });

  it("different emails produce different tokens", async () => {
    const t1 = await generateUnsubscribeToken("alice@example.com");
    const t2 = await generateUnsubscribeToken("bob@example.com");
    expect(t1).not.toBe(t2);
  });

  it("validateUnsubscribeToken returns true for the correct token", async () => {
    const email = "dawood@example.com";
    const token = await generateUnsubscribeToken(email);
    const valid = await validateUnsubscribeToken(email, token);
    expect(valid).toBe(true);
  });

  it("validateUnsubscribeToken returns false for a wrong token", async () => {
    const email = "dawood@example.com";
    const wrongToken = "this-is-not-the-right-token";
    const valid = await validateUnsubscribeToken(email, wrongToken);
    expect(valid).toBe(false);
  });

  it("email normalization: mixed-case email produces same token as lowercase", async () => {
    const lower = await generateUnsubscribeToken("user@example.com");
    const upper = await generateUnsubscribeToken("User@Example.COM");
    expect(lower).toBe(upper);
  });

  it("email normalization: validateUnsubscribeToken accepts mixed-case email with lowercase-generated token", async () => {
    const lowerToken = await generateUnsubscribeToken("user@example.com");
    const valid = await validateUnsubscribeToken("USER@EXAMPLE.COM", lowerToken);
    expect(valid).toBe(true);
  });

  it("tampered token (one character changed) → false", async () => {
    const email = "tamper@example.com";
    const token = await generateUnsubscribeToken(email);
    // Flip the first character
    const tampered = (token[0] === "a" ? "b" : "a") + token.slice(1);
    const valid = await validateUnsubscribeToken(email, tampered);
    expect(valid).toBe(false);
  });

  it("empty string token → false", async () => {
    const email = "user@example.com";
    const valid = await validateUnsubscribeToken(email, "");
    expect(valid).toBe(false);
  });
});
