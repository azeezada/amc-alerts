import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";

interface SubscriberRow {
  email: string;
  movie_slug: string | null;
  movie_title: string | null;
  notification_channel: string | null;
  subscribed_at: string | null;
  notified_at: string | null;
  active: number;
}

interface CacheRow {
  cache_key: string;
  checked_at: string | null;
}

interface CountRow {
  count: number;
}

interface MovieCountRow {
  movie_slug: string | null;
  count: number;
}

interface ChannelCountRow {
  notification_channel: string | null;
  count: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== "hailmary") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  if (!db) {
    // Dev mode — return mock data
    return NextResponse.json({
      devMode: true,
      subscribers: {
        total: 42,
        active: 38,
        inactive: 4,
        byMovie: [{ movie_slug: "project-hail-mary-76779", movie_title: "Project Hail Mary", count: 42 }],
        byChannel: [
          { notification_channel: "email", count: 30 },
          { notification_channel: "sms", count: 8 },
          { notification_channel: "both", count: 4 },
        ],
        recentSubscriptions: [],
        recentlyNotified: [],
      },
      scraper: {
        cacheEntries: 0,
        lastCheckedAt: null,
        cacheAgeMinutes: null,
        status: "unknown",
      },
    });
  }

  try {
    // Subscriber counts
    const totalRow = await db
      .prepare("SELECT COUNT(*) as count FROM subscribers")
      .first<CountRow>();
    const activeRow = await db
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE active = 1")
      .first<CountRow>();
    const inactiveRow = await db
      .prepare("SELECT COUNT(*) as count FROM subscribers WHERE active = 0")
      .first<CountRow>();

    // By movie
    const { results: byMovieRows } = await db
      .prepare(
        "SELECT movie_slug, movie_title, COUNT(*) as count FROM subscribers WHERE active = 1 GROUP BY movie_slug ORDER BY count DESC"
      )
      .all<MovieCountRow & { movie_title: string | null }>();

    // By channel
    const { results: byChannelRows } = await db
      .prepare(
        "SELECT notification_channel, COUNT(*) as count FROM subscribers WHERE active = 1 GROUP BY notification_channel ORDER BY count DESC"
      )
      .all<ChannelCountRow>();

    // Recent subscriptions (last 10)
    const { results: recentSubs } = await db
      .prepare(
        "SELECT email, movie_title, notification_channel, subscribed_at FROM subscribers ORDER BY subscribed_at DESC LIMIT 10"
      )
      .all<Pick<SubscriberRow, "email" | "movie_title" | "notification_channel" | "subscribed_at">>();

    // Recently notified (last 10)
    const { results: recentlyNotified } = await db
      .prepare(
        "SELECT email, movie_title, notification_channel, notified_at FROM subscribers WHERE notified_at IS NOT NULL ORDER BY notified_at DESC LIMIT 10"
      )
      .all<Pick<SubscriberRow, "email" | "movie_title" | "notification_channel" | "notified_at">>();

    // Scraper health — try showtime_cache_v2 first, fall back to showtime_cache
    let cacheEntries = 0;
    let lastCheckedAt: string | null = null;

    try {
      const cacheCountRow = await db
        .prepare("SELECT COUNT(*) as count FROM showtime_cache_v2")
        .first<CountRow>();
      cacheEntries = cacheCountRow?.count ?? 0;

      const lastCacheRow = await db
        .prepare("SELECT cache_key, checked_at FROM showtime_cache_v2 ORDER BY checked_at DESC LIMIT 1")
        .first<CacheRow>();
      lastCheckedAt = lastCacheRow?.checked_at ?? null;
    } catch {
      // Table may not exist yet — try legacy cache
      try {
        const legacyCountRow = await db
          .prepare("SELECT COUNT(*) as count FROM showtime_cache")
          .first<CountRow>();
        cacheEntries = legacyCountRow?.count ?? 0;

        const legacyLastRow = await db
          .prepare("SELECT date, checked_at FROM showtime_cache ORDER BY checked_at DESC LIMIT 1")
          .first<{ date: string; checked_at: string | null }>();
        lastCheckedAt = legacyLastRow?.checked_at ?? null;
      } catch {
        // Neither table exists
      }
    }

    // Calculate cache age
    let cacheAgeMinutes: number | null = null;
    let scraperStatus = "unknown";
    if (lastCheckedAt) {
      const lastCheck = new Date(lastCheckedAt).getTime();
      const now = Date.now();
      cacheAgeMinutes = Math.floor((now - lastCheck) / 60_000);
      if (cacheAgeMinutes < 20) scraperStatus = "healthy";
      else if (cacheAgeMinutes < 60) scraperStatus = "stale";
      else scraperStatus = "degraded";
    }

    return NextResponse.json({
      devMode: false,
      subscribers: {
        total: totalRow?.count ?? 0,
        active: activeRow?.count ?? 0,
        inactive: inactiveRow?.count ?? 0,
        byMovie: byMovieRows,
        byChannel: byChannelRows,
        recentSubscriptions: recentSubs,
        recentlyNotified,
      },
      scraper: {
        cacheEntries,
        lastCheckedAt,
        cacheAgeMinutes,
        status: scraperStatus,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
