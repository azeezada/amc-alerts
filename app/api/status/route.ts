import { NextRequest, NextResponse } from "next/server";
import { checkAllTheatersAndFormats, THEATERS, FORMATS, TARGET_DATES } from "@/lib/scraper";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheRow {
  cache_key: string;
  data: string;
  checked_at: string;
}

function makeKey(theaterSlug: string, formatTag: string, date: string) {
  return `${theaterSlug}__${formatTag}__${date}`;
}

export async function GET(_request: NextRequest) {
  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  try {
    // Check D1 cache if available
    if (db) {
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const theaterMap: Record<string, any> = {};
      let allCached = true;

      outer: for (const theater of THEATERS) {
        theaterMap[theater.slug] = {
          name: theater.name,
          neighborhood: theater.neighborhood,
          formats: {} as Record<string, { dates: Record<string, unknown> }>,
        };
        for (const format of FORMATS) {
          theaterMap[theater.slug].formats[format.tag] = { dates: {} };
          for (const date of TARGET_DATES) {
            const key = makeKey(theater.slug, format.tag, date);
            const row = await db
              .prepare("SELECT cache_key, data, checked_at FROM showtime_cache_v2 WHERE cache_key = ?")
              .bind(key)
              .first<CacheRow>();

            if (row) {
              const cachedAt = new Date(row.checked_at).getTime();
              if (now - cachedAt < CACHE_TTL_MS) {
                theaterMap[theater.slug].formats[format.tag].dates[date] = JSON.parse(row.data);
                continue;
              }
            }
            allCached = false;
            break outer;
          }
        }
      }

      if (allCached) {
        return NextResponse.json(
          { theaters: theaterMap, checkedAt: new Date().toISOString(), cached: true },
          { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
        );
      }
    }

    // Fetch fresh data
    const result = await checkAllTheatersAndFormats();

    // Cache in D1 if available (using v2 table with composite key)
    if (db) {
      // Best-effort: table may not exist yet, fallback gracefully
      try {
        for (const [theaterSlug, theaterData] of Object.entries(result.theaters)) {
          for (const [formatTag, formatData] of Object.entries(theaterData.formats)) {
            for (const [date, dateResult] of Object.entries(formatData.dates)) {
              const key = makeKey(theaterSlug, formatTag, date);
              await db
                .prepare(
                  "INSERT OR REPLACE INTO showtime_cache_v2 (cache_key, data, checked_at) VALUES (?, ?, datetime('now'))"
                )
                .bind(key, JSON.stringify(dateResult))
                .run();
            }
          }
        }
      } catch (_cacheErr) {
        // Table might not exist yet — ignore cache write failures
      }
    }

    return NextResponse.json(
      { ...result, cached: false },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("Status error:", e);
    return NextResponse.json(
      { error: "Failed to fetch showtimes", detail: String(e) },
      { status: 500 }
    );
  }
}
