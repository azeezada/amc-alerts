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
    const body = (await request.json()) as { email?: string; dates?: string[]; turnstileToken?: string };
    const { email, dates, turnstileToken } = body;

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

    if (!db) {
      console.log(`[DEV] Would subscribe: ${email} for dates: ${selectedDates.join(", ")}`);
      return NextResponse.json({
        success: true,
        message: "You're on the list! We'll email you the moment tickets drop.",
      });
    }

    // Check if already subscribed
    const existing = await db
      .prepare("SELECT email, active FROM subscribers WHERE email = ?")
      .bind(email)
      .first<{ email: string; active: number }>();

    if (existing) {
      if (existing.active) {
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          message: "You're already on the list!",
        });
      } else {
        await db
          .prepare("UPDATE subscribers SET active = 1, dates = ?, subscribed_at = datetime('now') WHERE email = ?")
          .bind(JSON.stringify(selectedDates), email)
          .run();
        return NextResponse.json({
          success: true,
          message: "Welcome back! You've been re-subscribed.",
        });
      }
    }

    await db
      .prepare("INSERT INTO subscribers (email, dates) VALUES (?, ?)")
      .bind(email, JSON.stringify(selectedDates))
      .run();

    return NextResponse.json({
      success: true,
      message: "You're on the list! We'll email you the moment tickets drop.",
    });
  } catch (e) {
    console.error("Subscribe error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
