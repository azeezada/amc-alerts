import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface Env {
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; error?: string }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; dates?: string[] };
    const { email, dates } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const validDates = [
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ];

    const selectedDates =
      dates && dates.length > 0
        ? dates.filter((d) => validDates.includes(d))
        : validDates;

    if (selectedDates.length === 0) {
      return NextResponse.json(
        { error: "No valid dates selected" },
        { status: 400 }
      );
    }

    // Get D1 binding from CF context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (process as any).env as unknown as Env;
    const db = env?.DB;

    if (!db) {
      // Dev mode — no DB
      console.log(`[DEV] Would subscribe: ${email} for dates: ${selectedDates.join(", ")}`);
      return NextResponse.json({
        success: true,
        message: "Subscribed successfully! (dev mode)",
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
        // Reactivate
        await db
          .prepare(
            "UPDATE subscribers SET active = 1, dates = ?, subscribed_at = datetime('now') WHERE email = ?"
          )
          .bind(JSON.stringify(selectedDates), email)
          .run();

        return NextResponse.json({
          success: true,
          message: "Welcome back! You've been re-subscribed.",
        });
      }
    }

    // Insert new subscriber
    await db
      .prepare(
        "INSERT INTO subscribers (email, dates) VALUES (?, ?)"
      )
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
