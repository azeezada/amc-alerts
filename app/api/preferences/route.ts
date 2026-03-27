import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { validateUnsubscribeToken } from "@/lib/unsubscribe-token";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

interface SubscriberRow {
  email: string;
  dates: string;
  theater_slugs: string | null;
  phone_number: string | null;
  notification_channel: string | null;
  active: number;
}

/** GET /api/preferences?email=...&token=... — fetch current subscriber preferences */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token) {
    return NextResponse.json({ error: "Missing email or token" }, { status: 400 });
  }

  const valid = await validateUnsubscribeToken(email, token);
  if (!valid) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  if (!db) {
    // Dev mode — return mock prefs
    return NextResponse.json({
      email,
      dates: ["2026-04-01", "2026-04-02", "2026-04-03"],
      theaterSlugs: null,
      notificationChannel: "email",
      phoneNumber: null,
      active: true,
    });
  }

  const row = await db
    .prepare("SELECT email, dates, theater_slugs, phone_number, notification_channel, active FROM subscribers WHERE email = ?")
    .bind(email.toLowerCase().trim())
    .first<SubscriberRow>();

  if (!row) {
    return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  }

  let dates: string[] = [];
  try {
    dates = JSON.parse(row.dates);
  } catch { /* leave empty */ }

  let theaterSlugs: string[] | null = null;
  try {
    theaterSlugs = row.theater_slugs ? JSON.parse(row.theater_slugs) : null;
  } catch { /* leave null */ }

  return NextResponse.json({
    email: row.email,
    dates,
    theaterSlugs,
    notificationChannel: row.notification_channel ?? "email",
    phoneNumber: row.phone_number ?? null,
    active: !!row.active,
  });
}

/** PATCH /api/preferences — update subscriber preferences */
export async function PATCH(request: NextRequest) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      email?: string;
      token?: string;
      dates?: string[];
      theaterSlugs?: string[] | null;
      notificationChannel?: string;
      phoneNumber?: string | null;
    };
    const { email, token, dates, theaterSlugs, notificationChannel, phoneNumber } = body;

    if (!email || !token) {
      return NextResponse.json({ error: "Missing email or token" }, { status: 400 });
    }

    const valid = await validateUnsubscribeToken(email, token);
    if (!valid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    // Validate dates
    const today = new Date().toISOString().split("T")[0];
    const validDates = Array.isArray(dates)
      ? dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today)
      : [];

    if (validDates.length === 0) {
      return NextResponse.json({ error: "No valid dates provided" }, { status: 400 });
    }

    // Validate theaterSlugs (null means "all theaters")
    const validTheaterSlugs =
      Array.isArray(theaterSlugs) && theaterSlugs.length > 0 ? theaterSlugs : null;

    // Validate notificationChannel
    const validChannels = ["email", "sms", "both"];
    const validChannel = validChannels.includes(notificationChannel ?? "") ? notificationChannel! : "email";

    // Validate phoneNumber — required when channel includes SMS
    const needsPhone = validChannel === "sms" || validChannel === "both";
    const phone = typeof phoneNumber === "string" && phoneNumber.trim().length > 0 ? phoneNumber.trim() : null;
    if (needsPhone && !phone) {
      return NextResponse.json({ error: "Phone number required for SMS notifications" }, { status: 400 });
    }
    const validPhone = needsPhone ? phone : null;

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      console.log(`[DEV] Would update preferences for ${email}: dates=${validDates.join(",")}, theaters=${validTheaterSlugs?.join(",") ?? "all"}, channel=${validChannel}, phone=${validPhone ?? "n/a"}`);
      return NextResponse.json({
        success: true,
        message: "Preferences updated successfully.",
        dates: validDates,
        theaterSlugs: validTheaterSlugs,
        notificationChannel: validChannel,
        phoneNumber: validPhone,
      });
    }

    const row = await db
      .prepare("SELECT email, active FROM subscribers WHERE email = ?")
      .bind(email.toLowerCase().trim())
      .first<{ email: string; active: number }>();

    if (!row) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    if (!row.active) {
      return NextResponse.json({ error: "Subscription is inactive. Please re-subscribe first." }, { status: 409 });
    }

    await db
      .prepare("UPDATE subscribers SET dates = ?, theater_slugs = ?, notification_channel = ?, phone_number = ? WHERE email = ?")
      .bind(
        JSON.stringify(validDates),
        validTheaterSlugs ? JSON.stringify(validTheaterSlugs) : null,
        validChannel,
        validPhone,
        email.toLowerCase().trim()
      )
      .run();

    return NextResponse.json({
      success: true,
      message: "Preferences updated successfully.",
      dates: validDates,
      theaterSlugs: validTheaterSlugs,
      notificationChannel: validChannel,
      phoneNumber: validPhone,
    });
  } catch (e) {
    console.error("Preferences update error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
