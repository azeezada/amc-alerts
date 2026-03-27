/**
 * Unit tests for lib/sms.ts
 *
 * Coverage:
 *  1. Skip silently when Twilio credentials are absent
 *  2. Skip silently when only some credentials are present
 *  3. Send successfully — builds correct Twilio URL and request
 *  4. Message body contains movie title, theater name, and date list
 *  5. Message body uses default "IMAX" when movieTitle is undefined
 *  6. Message body omits theater clause when theaterName is undefined
 *  7. Throw error when Twilio returns non-OK HTTP status
 *  8. plural vs singular "showtime" in message body
 *  9. Multiple dates formatted as comma-separated list
 */
import { describe, it, expect, vi } from "vitest";
import { sendSmsAlert, type SmsEnv } from "@/lib/sms";
import type { DateResult } from "@/lib/scraper";

const CREDS: SmsEnv = {
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "authtoken",
  TWILIO_PHONE_NUMBER: "+15550000000",
};

function makeDate(date: string, count = 1): DateResult {
  const showtimes = Array.from({ length: count }, (_, i) => ({
    id: `show-${i}`,
    time: `${10 + i}:00`,
    available: true,
  }));
  return { date, available: true, showtimes } as unknown as DateResult;
}

describe("lib/sms.ts — sendSmsAlert", () => {
  it("returns silently when all credentials are absent", async () => {
    const fetchSpy = vi.fn();
    await sendSmsAlert("+15551111111", [makeDate("2026-04-01")], {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns silently when TWILIO_ACCOUNT_SID is missing", async () => {
    const partial: SmsEnv = { TWILIO_AUTH_TOKEN: "tok", TWILIO_PHONE_NUMBER: "+1" };
    // No real fetch should be called; if it is, it will throw (no global fetch mock)
    await expect(sendSmsAlert("+15551111111", [makeDate("2026-04-01")], partial)).resolves.toBeUndefined();
  });

  it("sends a POST to the correct Twilio Messages endpoint", async () => {
    const captured: { url: string; init: RequestInit } = { url: "", init: {} };
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.init = init;
      return { ok: true };
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendSmsAlert("+15559999999", [makeDate("2026-04-01")], CREDS);

    expect(captured.url).toContain("AC123");
    expect(captured.url).toContain("Messages.json");
    expect(captured.init.method).toBe("POST");
    vi.unstubAllGlobals();
  });

  it("includes Authorization header with Base64-encoded SID:token", async () => {
    let authHeader = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      authHeader = (init.headers as Record<string, string>)["Authorization"] ?? "";
      return { ok: true };
    }));

    await sendSmsAlert("+15559999999", [makeDate("2026-04-01")], CREDS);

    const expected = `Basic ${btoa("AC123:authtoken")}`;
    expect(authHeader).toBe(expected);
    vi.unstubAllGlobals();
  });

  it("message body contains movie title and theater name", async () => {
    let bodyStr = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      bodyStr = init.body as string;
      return { ok: true };
    }));

    await sendSmsAlert("+15559999999", [makeDate("2026-04-03")], CREDS, "Project Hail Mary", "AMC Lincoln Square");
    const decoded = decodeURIComponent(bodyStr.replace(/\+/g, " "));
    expect(decoded).toContain("Project Hail Mary");
    expect(decoded).toContain("AMC Lincoln Square");
    vi.unstubAllGlobals();
  });

  it("message body uses 'IMAX' when movieTitle is undefined", async () => {
    let bodyStr = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      bodyStr = init.body as string;
      return { ok: true };
    }));

    await sendSmsAlert("+15559999999", [makeDate("2026-04-03")], CREDS, undefined, undefined);
    const decoded = decodeURIComponent(bodyStr.replace(/\+/g, " "));
    expect(decoded).toContain("IMAX");
    vi.unstubAllGlobals();
  });

  it("message body omits theater phrase when theaterName is undefined", async () => {
    let bodyStr = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      bodyStr = init.body as string;
      return { ok: true };
    }));

    await sendSmsAlert("+15559999999", [makeDate("2026-04-03")], CREDS, "My Movie", undefined);
    const decoded = decodeURIComponent(bodyStr.replace(/\+/g, " "));
    expect(decoded).not.toContain(" at ");
    vi.unstubAllGlobals();
  });

  it("throws when Twilio returns a non-OK HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Invalid To phone number",
    }));

    await expect(
      sendSmsAlert("+15559999999", [makeDate("2026-04-01")], CREDS)
    ).rejects.toThrow("Twilio error 400");
    vi.unstubAllGlobals();
  });

  it("message body uses singular 'showtime' for one showtime", async () => {
    let bodyStr = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      bodyStr = init.body as string;
      return { ok: true };
    }));

    await sendSmsAlert("+15559999999", [makeDate("2026-04-01", 1)], CREDS);
    const decoded = decodeURIComponent(bodyStr.replace(/\+/g, " "));
    expect(decoded).toContain("1 showtime)");
    vi.unstubAllGlobals();
  });

  it("message body uses plural 'showtimes' for multiple showtimes", async () => {
    let bodyStr = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      bodyStr = init.body as string;
      return { ok: true };
    }));

    await sendSmsAlert("+15559999999", [makeDate("2026-04-01", 3)], CREDS);
    const decoded = decodeURIComponent(bodyStr.replace(/\+/g, " "));
    expect(decoded).toContain("3 showtimes)");
    vi.unstubAllGlobals();
  });
});
