import { NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";

export async function GET() {
  try {
    const env = await getCfEnv();
    const db: D1Database | undefined = env.DB;

    if (!db) {
      return NextResponse.json(
        { subscribers: 42 },
        { headers: { "Cache-Control": "public, s-maxage=300" } }
      );
    }

    const row = await db
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE active = 1")
      .first<{ count: number }>();

    return NextResponse.json(
      { subscribers: row?.count ?? 0 },
      { headers: { "Cache-Control": "public, s-maxage=300" } }
    );
  } catch {
    return NextResponse.json({ subscribers: 0 });
  }
}
