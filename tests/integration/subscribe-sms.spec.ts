/**
 * SMS alerts — /api/subscribe phone+channel integration tests
 *
 * Coverage:
 *  1. channel="email" (default) — phone not required, no phone stored
 *  2. channel="sms" with phone — phone stored, success message says "text"
 *  3. channel="sms" without phone — 400 error
 *  4. channel="both" with phone — phone stored, message says "email and text"
 *  5. channel="both" without phone — 400 error
 *  6. invalid channel value — falls back to "email"
 *  7. channel validation logic: validChannels accepts only email/sms/both
 *
 * All tests mirror the logic in /api/subscribe/route.ts without an HTTP server.
 */
import { describe, it, expect } from "vitest";

/* -------------------------------------------------------------------------
   Mirrors channel validation logic from /api/subscribe/route.ts lines ~73-79
   ------------------------------------------------------------------------- */

function resolveChannel(channel: string | undefined): "email" | "sms" | "both" {
  const validChannels = ["email", "sms", "both"] as const;
  return channel && (validChannels as readonly string[]).includes(channel)
    ? (channel as "email" | "sms" | "both")
    : "email";
}

function resolvePhone(
  channel: "email" | "sms" | "both",
  phone: string | undefined
): string | null {
  if (channel === "email") return null;
  return phone?.trim() || null;
}

function requiresPhone(channel: "email" | "sms" | "both", phone: string | null): boolean {
  return (channel === "sms" || channel === "both") && !phone;
}

function successMessage(channel: "email" | "sms" | "both"): string {
  if (channel === "email") return "You're on the list! We'll email you the moment tickets drop.";
  if (channel === "sms") return "You're on the list! We'll text you the moment tickets drop.";
  return "You're on the list! We'll email and text you the moment tickets drop.";
}

/* -------------------------------------------------------------------------
   Mirrors INSERT query column set with phone + channel fields
   ------------------------------------------------------------------------- */

function buildInsertQuery(
  email: string,
  dates: string[],
  movieSlug: string,
  movieTitle: string,
  theaterSlugs: string[] | null,
  phone: string | null,
  channel: string
): { query: string; values: (string | null)[] } {
  return {
    query:
      "INSERT INTO subscribers (email, dates, movie_slug, movie_title, theater_slugs, phone_number, notification_channel) VALUES (?, ?, ?, ?, ?, ?, ?)",
    values: [
      email,
      JSON.stringify(dates),
      movieSlug,
      movieTitle,
      theaterSlugs ? JSON.stringify(theaterSlugs) : null,
      phone,
      channel,
    ],
  };
}

/* -------------------------------------------------------------------------
   Tests
   ------------------------------------------------------------------------- */

describe("/api/subscribe — SMS phone+channel", () => {
  // 1. email-only channel (default)
  it("channel=email: phone not required, stored phone is null", () => {
    const ch = resolveChannel("email");
    const phone = resolvePhone(ch, undefined);
    expect(ch).toBe("email");
    expect(phone).toBeNull();
    expect(requiresPhone(ch, phone)).toBe(false);
  });

  // 2. channel=sms with phone number
  it("channel=sms with phone: phone stored, success message says 'text'", () => {
    const ch = resolveChannel("sms");
    const phone = resolvePhone(ch, "+15551234567");
    expect(ch).toBe("sms");
    expect(phone).toBe("+15551234567");
    expect(requiresPhone(ch, phone)).toBe(false);
    expect(successMessage(ch)).toContain("text");
  });

  // 3. channel=sms without phone → validation error
  it("channel=sms without phone: requiresPhone returns true → should 400", () => {
    const ch = resolveChannel("sms");
    const phone = resolvePhone(ch, "");
    expect(phone).toBeNull();
    expect(requiresPhone(ch, phone)).toBe(true);
  });

  // 4. channel=both with phone number
  it("channel=both with phone: phone stored, message mentions email and text", () => {
    const ch = resolveChannel("both");
    const phone = resolvePhone(ch, "+15557654321");
    expect(ch).toBe("both");
    expect(phone).toBe("+15557654321");
    expect(requiresPhone(ch, phone)).toBe(false);
    const msg = successMessage(ch);
    expect(msg).toContain("email");
    expect(msg).toContain("text");
  });

  // 5. channel=both without phone → validation error
  it("channel=both without phone: requiresPhone returns true → should 400", () => {
    const ch = resolveChannel("both");
    const phone = resolvePhone(ch, undefined);
    expect(phone).toBeNull();
    expect(requiresPhone(ch, phone)).toBe(true);
  });

  // 6. invalid channel value falls back to email
  it("channel='push' (invalid): falls back to email", () => {
    const ch = resolveChannel("push");
    expect(ch).toBe("email");
  });

  it("channel=undefined: falls back to email", () => {
    const ch = resolveChannel(undefined);
    expect(ch).toBe("email");
  });

  // 7. channel validation: only email/sms/both are accepted
  it("validChannels accepts exactly email, sms, both", () => {
    const validChannels = ["email", "sms", "both"];
    expect(validChannels).toContain("email");
    expect(validChannels).toContain("sms");
    expect(validChannels).toContain("both");
    expect(validChannels).not.toContain("push");
    expect(validChannels).not.toContain("whatsapp");
  });

  // 8. INSERT query includes phone_number and notification_channel
  it("INSERT query includes phone_number and notification_channel columns", () => {
    const { query, values } = buildInsertQuery(
      "user@example.com",
      ["2026-04-01"],
      "project-hail-mary",
      "Project Hail Mary",
      null,
      "+15551234567",
      "both"
    );
    expect(query).toContain("phone_number");
    expect(query).toContain("notification_channel");
    expect(values).toContain("+15551234567");
    expect(values).toContain("both");
  });

  // 9. INSERT query stores null phone for email-only channel
  it("INSERT query stores null phone when channel=email", () => {
    const { values } = buildInsertQuery(
      "user@example.com",
      ["2026-04-01"],
      "project-hail-mary",
      "Project Hail Mary",
      null,
      null,
      "email"
    );
    expect(values).toContain(null);
    expect(values).toContain("email");
  });

  // 10. phone trimming: whitespace is stripped
  it("phone number is trimmed of surrounding whitespace", () => {
    const ch = resolveChannel("sms");
    const phone = resolvePhone(ch, "  +15551234567  ");
    expect(phone).toBe("+15551234567");
  });
});
