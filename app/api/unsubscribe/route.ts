import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { validateUnsubscribeToken } from "@/lib/unsubscribe-token";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as { email?: string; token?: string };
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: "Missing email or token" },
        { status: 400 }
      );
    }

    const valid = await validateUnsubscribeToken(email, token);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid unsubscribe token" },
        { status: 403 }
      );
    }

    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      console.log(`[DEV] Would unsubscribe: ${email}`);
      return NextResponse.json({ success: true, message: "You have been unsubscribed." });
    }

    const existing = await db
      .prepare("SELECT email, active FROM subscribers WHERE email = ?")
      .bind(email.toLowerCase().trim())
      .first<{ email: string; active: number }>();

    if (!existing) {
      return NextResponse.json({ success: true, message: "Email not found in our records." });
    }

    if (!existing.active) {
      return NextResponse.json({ success: true, message: "You are already unsubscribed." });
    }

    await db
      .prepare("UPDATE subscribers SET active = 0 WHERE email = ?")
      .bind(email.toLowerCase().trim())
      .run();

    return NextResponse.json({ success: true, message: "You have been unsubscribed. You will no longer receive alerts." });
  } catch (e) {
    console.error("Unsubscribe error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
