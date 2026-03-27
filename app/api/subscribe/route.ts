import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";


function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      email?: string;
      dates?: string[];
      turnstileToken?: string;
      movieSlug?: string;
      movieTitle?: string;
      theaterSlugs?: string[];
      phone?: string;
      channel?: string;
      abVariant?: string;
      refCode?: string;
    };
    const { email, dates, turnstileToken, movieSlug, movieTitle, theaterSlugs, phone, channel, abVariant, refCode } = body;

    // Verify Turnstile token if provided (skip in dev)
    if (turnstileToken) {
      const env = await getCfEnv();
      const turnstileSecret = (env as any).TURNSTILE_SECRET_KEY;
      if (turnstileSecret) {
        const verifyResp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: turnstileSecret, response: turnstileToken }),
        });
        const verifyData = await verifyResp.json() as { success: boolean };
        if (!verifyData.success) {
          return NextResponse.json({ error: "Bot verification failed. Please try again." }, { status: 403 });
        }
      }
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const selectedDates =
      dates && dates.length > 0
        ? dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today)
        : [];

    if (selectedDates.length === 0) {
      return NextResponse.json(
        { error: "No valid dates selected" },
        { status: 400 }
      );
    }

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    const subMovieSlug = movieSlug || "project-hail-mary-76779";
    const subMovieTitle = movieTitle || "Project Hail Mary";
    const subTheaterSlugs = theaterSlugs && theaterSlugs.length > 0 ? theaterSlugs : null;

    // Validate channel and phone
    const validChannels = ["email", "sms", "both"];
    const subChannel = channel && validChannels.includes(channel) ? channel : "email";
    const subPhone = (subChannel === "sms" || subChannel === "both") ? (phone?.trim() || null) : null;
    if ((subChannel === "sms" || subChannel === "both") && !subPhone) {
      return NextResponse.json({ error: "Phone number required for SMS alerts" }, { status: 400 });
    }

    const validVariants = ["A", "B"];
    const subAbVariant = abVariant && validVariants.includes(abVariant) ? abVariant : null;

    // Referral: validate incoming refCode (8 alphanumeric chars) and generate one for the new subscriber
    const subReferredBy = refCode && /^[a-z0-9]{8}$/.test(refCode) ? refCode : null;
    const newReferralCode = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (!db) {
      console.log(`[DEV] Would subscribe: ${email} for dates: ${selectedDates.join(", ")}, movie: ${subMovieSlug}, theaters: ${subTheaterSlugs?.join(", ") ?? "all"}, channel: ${subChannel}, variant: ${subAbVariant}, referredBy: ${subReferredBy}`);
      return NextResponse.json({
        success: true,
        referralCode: newReferralCode,
        message: subChannel === "email"
          ? "You're on the list! We'll email you the moment tickets drop."
          : subChannel === "sms"
          ? "You're on the list! We'll text you the moment tickets drop."
          : "You're on the list! We'll email and text you the moment tickets drop.",
      });
    }

    // Check if already subscribed
    const existing = await db
      .prepare("SELECT email, active, referral_code FROM subscribers WHERE email = ?")
      .bind(email)
      .first<{ email: string; active: number; referral_code: string | null }>();

    if (existing) {
      if (existing.active) {
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          referralCode: existing.referral_code || null,
          message: "You're already on the list!",
        });
      } else {
        // On re-subscribe, keep existing referral_code if set
        const keepCode = existing.referral_code || newReferralCode;
        await db
          .prepare("UPDATE subscribers SET active = 1, dates = ?, movie_slug = ?, movie_title = ?, theater_slugs = ?, phone_number = ?, notification_channel = ?, ab_variant = ?, subscribed_at = datetime('now'), referral_code = COALESCE(referral_code, ?) WHERE email = ?")
          .bind(JSON.stringify(selectedDates), subMovieSlug, subMovieTitle, subTheaterSlugs ? JSON.stringify(subTheaterSlugs) : null, subPhone, subChannel, subAbVariant, newReferralCode, email)
          .run();
        return NextResponse.json({
          success: true,
          referralCode: keepCode,
          message: "Welcome back! You've been re-subscribed.",
        });
      }
    }

    await db
      .prepare("INSERT INTO subscribers (email, dates, movie_slug, movie_title, theater_slugs, phone_number, notification_channel, ab_variant, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(email, JSON.stringify(selectedDates), subMovieSlug, subMovieTitle, subTheaterSlugs ? JSON.stringify(subTheaterSlugs) : null, subPhone, subChannel, subAbVariant, newReferralCode, subReferredBy)
      .run();

    return NextResponse.json({
      success: true,
      referralCode: newReferralCode,
      message: subChannel === "email"
        ? "You're on the list! We'll email you the moment tickets drop."
        : subChannel === "sms"
        ? "You're on the list! We'll text you the moment tickets drop."
        : "You're on the list! We'll email and text you the moment tickets drop.",
    });
  } catch (e) {
    console.error("Subscribe error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
