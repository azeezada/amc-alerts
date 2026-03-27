import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { code } = params;

  if (!code || !/^[a-f0-9]{8}$/.test(code)) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
  }

  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  if (!db) {
    // Dev mode
    return NextResponse.json({
      valid: true,
      referralCode: code,
      movieSlug: "project-hail-mary-76779",
      movieTitle: "Project Hail Mary",
      referralCount: 0,
    });
  }

  const row = await db
    .prepare(
      "SELECT email, movie_slug, movie_title, active, (SELECT COUNT(*) FROM subscribers WHERE referred_by = s.referral_code AND active = 1) AS referral_count FROM subscribers s WHERE referral_code = ?"
    )
    .bind(code)
    .first<{
      email: string;
      movie_slug: string;
      movie_title: string;
      active: number;
      referral_count: number;
    }>();

  if (!row) {
    return NextResponse.json({ error: "Referral code not found" }, { status: 404 });
  }

  // Mask the email: show first char + *** + @domain
  const [localPart, domain] = row.email.split("@");
  const maskedEmail = localPart.slice(0, 1) + "***@" + domain;

  return NextResponse.json({
    valid: true,
    referralCode: code,
    referrerEmail: maskedEmail,
    movieSlug: row.movie_slug,
    movieTitle: row.movie_title,
    referralCount: row.referral_count,
  });
}
