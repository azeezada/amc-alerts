import { NextRequest, NextResponse } from "next/server";
import { checkAllDates, TARGET_DATES } from "@/lib/scraper";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";


const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheRow {
  date: string;
  data: string;
  checked_at: string;
}

export async function GET(_request: NextRequest) {
  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  try {
    // Check D1 cache if available
    if (db) {
      const now = Date.now();
      const cachedResults: Record<string, unknown> = {};
      let allCached = true;

      for (const date of TARGET_DATES) {
        const row = await db
          .prepare("SELECT date, data, checked_at FROM showtime_cache WHERE date = ?")
          .bind(date)
          .first<CacheRow>();

        if (row) {
          const cachedAt = new Date(row.checked_at).getTime();
          if (now - cachedAt < CACHE_TTL_MS) {
            cachedResults[date] = JSON.parse(row.data);
            continue;
          }
        }
        allCached = false;
        break;
      }

      if (allCached) {
        return NextResponse.json(
          { dates: cachedResults, checkedAt: new Date().toISOString(), cached: true },
          { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
        );
      }
    }

    // Fetch fresh data
    const result = await checkAllDates();

    // Cache in D1 if available
    if (db) {
      for (const [date, dateResult] of Object.entries(result.dates)) {
        await db
          .prepare("INSERT OR REPLACE INTO showtime_cache (date, data, checked_at) VALUES (?, ?, datetime('now'))")
          .bind(date, JSON.stringify(dateResult))
          .run();
      }
    }

    return NextResponse.json(
      { ...result, cached: false },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("Status error:", e);
    return NextResponse.json({ error: "Failed to fetch showtimes", detail: String(e) }, { status: 500 });
  }
}
