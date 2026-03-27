/**
 * Error alerting integration tests
 *
 * Tests the admin error alert behavior added to /api/check:
 *  1. sendAdminErrorAlert() sends correct request to Resend with error details
 *  2. Admin alert is triggered on scraper error when ADMIN_ALERT_EMAIL + RESEND_API_KEY set
 *  3. No ADMIN_ALERT_EMAIL → alert skipped silently
 *  4. No RESEND_API_KEY → alert skipped silently
 *  5. Alert send failure is caught and doesn't re-throw
 *  6. Error message is present in alert body
 *  7. Admin email subject contains "Error"
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* -------------------------------------------------------------------------
   Mirror the shouldSendAdminAlert() decision logic from /api/check route.ts
   Condition: adminEmail && resendApiKey are both truthy
   ------------------------------------------------------------------------- */

function shouldSendAdminAlert(adminEmail: string | undefined, resendApiKey: string | undefined): boolean {
  return !!(adminEmail && resendApiKey);
}

describe("Error alert trigger conditions", () => {
  it("both adminEmail and resendApiKey set → should send alert", () => {
    expect(shouldSendAdminAlert("admin@example.com", "re_secret")).toBe(true);
  });

  it("no adminEmail → should NOT send alert", () => {
    expect(shouldSendAdminAlert(undefined, "re_secret")).toBe(false);
  });

  it("empty adminEmail → should NOT send alert", () => {
    expect(shouldSendAdminAlert("", "re_secret")).toBe(false);
  });

  it("no resendApiKey → should NOT send alert", () => {
    expect(shouldSendAdminAlert("admin@example.com", undefined)).toBe(false);
  });

  it("both undefined → should NOT send alert", () => {
    expect(shouldSendAdminAlert(undefined, undefined)).toBe(false);
  });
});

/* -------------------------------------------------------------------------
   sendAdminErrorAlert() request shape — test what we'd send to Resend
   ------------------------------------------------------------------------- */

interface ResendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function buildAdminAlertPayload(
  errorMessage: string,
  adminEmail: string,
  context?: { runId?: string; moviesChecked?: number }
): Promise<ResendPayload> {
  const runId = context?.runId ?? "test-run-id";
  const moviesChecked = context?.moviesChecked ?? 0;

  const html = `<error>${errorMessage}</error><runId>${runId}</runId><moviesChecked>${moviesChecked}</moviesChecked>`;
  const text = [
    "🚨 AMC Scraper Error",
    "",
    `Error: ${errorMessage}`,
    `Run ID: ${runId}`,
    `Movies checked: ${moviesChecked}`,
  ].join("\n");

  return {
    from: "IMAX Alerts <alerts@churnrecovery.com>",
    to: adminEmail,
    subject: "🚨 AMC Scraper Error — Action Required",
    html,
    text,
  };
}

describe("Admin alert payload shape", () => {
  it("to field equals adminEmail", async () => {
    const payload = await buildAdminAlertPayload("network timeout", "admin@example.com", { runId: "r1" });
    expect(payload.to).toBe("admin@example.com");
  });

  it("from field is the alerts sender", async () => {
    const payload = await buildAdminAlertPayload("test error", "admin@example.com");
    expect(payload.from).toBe("IMAX Alerts <alerts@churnrecovery.com>");
  });

  it("subject contains 'Error'", async () => {
    const payload = await buildAdminAlertPayload("some failure", "admin@example.com");
    expect(payload.subject).toMatch(/error/i);
  });

  it("text contains error message", async () => {
    const payload = await buildAdminAlertPayload("D1 query failed: table not found", "admin@example.com");
    expect(payload.text).toContain("D1 query failed: table not found");
  });

  it("text contains run ID", async () => {
    const payload = await buildAdminAlertPayload("crash", "admin@example.com", { runId: "2026-03-27T06:00:00Z" });
    expect(payload.text).toContain("2026-03-27T06:00:00Z");
  });

  it("text contains movies checked count", async () => {
    const payload = await buildAdminAlertPayload("crash", "admin@example.com", { runId: "r1", moviesChecked: 3 });
    expect(payload.text).toContain("3");
  });
});

/* -------------------------------------------------------------------------
   sendAdminErrorAlert() — mock fetch, verify call and graceful failure
   ------------------------------------------------------------------------- */

import { sendAdminErrorAlert } from "@/lib/email";

describe("sendAdminErrorAlert() — fetch behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls fetch with POST to Resend emails endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "msg_1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAdminErrorAlert("scraper exploded", "re_test_key", "admin@test.com", {
      runId: "2026-03-27T06:00:00Z",
      moviesChecked: 1,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.method).toBe("POST");
  });

  it("sends Authorization header with Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAdminErrorAlert("error msg", "re_mykey", "admin@test.com");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer re_mykey");
  });

  it("body includes error message in text field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAdminErrorAlert("D1 connection refused", "re_key", "admin@test.com");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.text).toContain("D1 connection refused");
  });

  it("body.to equals adminEmail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAdminErrorAlert("err", "re_key", "dawood@example.com");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.to).toBe("dawood@example.com");
  });

  it("body.subject contains 'Error'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAdminErrorAlert("err", "re_key", "admin@test.com");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.subject).toMatch(/error/i);
  });

  it("does NOT throw when fetch returns non-ok (logs error instead)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "invalid email address",
    });
    vi.stubGlobal("fetch", fetchMock);

    // Should not throw
    await expect(
      sendAdminErrorAlert("err", "re_key", "bad-email")
    ).resolves.toBeUndefined();
  });

  it("does NOT throw when fetch itself throws (network error)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
    vi.stubGlobal("fetch", fetchMock);

    // sendAdminErrorAlert doesn't catch network errors — caller (/api/check) does
    // This test verifies the caller catch block pattern works
    let caught = false;
    try {
      await sendAdminErrorAlert("err", "re_key", "admin@test.com");
    } catch {
      caught = true;
    }
    // The caller wraps this in try/catch and logs — here we just verify it throws as expected
    expect(caught).toBe(true);
  });
});

/* -------------------------------------------------------------------------
   Caller pattern — /api/check catch block wraps sendAdminErrorAlert in try/catch
   Verify that the caller pattern correctly suppresses alert failures
   ------------------------------------------------------------------------- */

async function simulateCheckCatchBlock(
  errorMessage: string,
  adminEmail: string | undefined,
  resendApiKey: string | undefined,
  alertFn: (msg: string, key: string, email: string) => Promise<void>
): Promise<{ log: string[]; alertAttempted: boolean; alertFailed: boolean }> {
  const log: string[] = [];
  let alertAttempted = false;
  let alertFailed = false;

  log.push(`ERROR: ${errorMessage}`);

  // Mirrors the pattern in /api/check route.ts catch block
  if (adminEmail && resendApiKey) {
    alertAttempted = true;
    try {
      await alertFn(errorMessage, resendApiKey, adminEmail);
    } catch (alertErr) {
      alertFailed = true;
      log.push(`Admin alert failed: ${alertErr}`);
    }
  }

  return { log, alertAttempted, alertFailed };
}

describe("Caller catch block pattern — alert invocation and failure handling", () => {
  it("alert attempted when adminEmail + resendApiKey present", async () => {
    const mockAlert = vi.fn().mockResolvedValue(undefined);
    const result = await simulateCheckCatchBlock("crash", "admin@test.com", "re_key", mockAlert);
    expect(result.alertAttempted).toBe(true);
    expect(mockAlert).toHaveBeenCalledOnce();
  });

  it("alert NOT attempted when adminEmail missing", async () => {
    const mockAlert = vi.fn().mockResolvedValue(undefined);
    const result = await simulateCheckCatchBlock("crash", undefined, "re_key", mockAlert);
    expect(result.alertAttempted).toBe(false);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("alert NOT attempted when resendApiKey missing", async () => {
    const mockAlert = vi.fn().mockResolvedValue(undefined);
    const result = await simulateCheckCatchBlock("crash", "admin@test.com", undefined, mockAlert);
    expect(result.alertAttempted).toBe(false);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("alert failure is caught and logged — does not re-throw", async () => {
    const mockAlert = vi.fn().mockRejectedValue(new Error("network unreachable"));
    const result = await simulateCheckCatchBlock("crash", "admin@test.com", "re_key", mockAlert);
    expect(result.alertAttempted).toBe(true);
    expect(result.alertFailed).toBe(true);
    expect(result.log.some((l) => l.includes("Admin alert failed"))).toBe(true);
  });

  it("error message propagated to alert", async () => {
    const mockAlert = vi.fn().mockResolvedValue(undefined);
    await simulateCheckCatchBlock("D1 table missing", "admin@test.com", "re_key", mockAlert);
    expect(mockAlert.mock.calls[0][0]).toBe("D1 table missing");
  });

  it("original error message is in log regardless of alert outcome", async () => {
    const mockAlert = vi.fn().mockRejectedValue(new Error("alert failed"));
    const result = await simulateCheckCatchBlock("primary scraper error", "admin@test.com", "re_key", mockAlert);
    expect(result.log[0]).toContain("primary scraper error");
  });
});
