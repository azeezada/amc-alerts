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

interface SignupsByDayRow {
  day: string;
  count: number;
}

interface DatePrefRow {
  pref_date: string;
  count: number;
}

interface ScraperRunRow {
  id: number;
  run_id: string;
  status: string;
  duration_ms: number | null;
  movies_checked: number;
  theaters_checked: number;
  formats_checked: number;
  total_new_showtimes: number;
  total_notified: number;
  error_message: string | null;
  ran_at: string | null;
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
      analytics: {
        signupsByDay: [
          { day: "2026-03-27", count: 8 },
          { day: "2026-03-26", count: 15 },
          { day: "2026-03-25", count: 12 },
          { day: "2026-03-24", count: 7 },
        ],
        datePreferences: [
          { pref_date: "2026-04-03", count: 32 },
          { pref_date: "2026-04-04", count: 28 },
          { pref_date: "2026-04-05", count: 19 },
          { pref_date: "2026-04-01", count: 14 },
          { pref_date: "2026-04-02", count: 11 },
        ],
        openRateNote: "Email open tracking not yet implemented",
      },
      scraper: {
        cacheEntries: 0,
        lastCheckedAt: null,
        cacheAgeMinutes: null,
        status: "unknown",
      },
      scraperMonitoring: {
        recentRuns: [
          { id: 1, run_id: "2026-03-27T05:00:00.000Z", status: "success", duration_ms: 3200, movies_checked: 1, theaters_checked: 3, formats_checked: 3, total_new_showtimes: 0, total_notified: 0, error_message: null, ran_at: "2026-03-27 05:00:00" },
          { id: 2, run_id: "2026-03-27T04:45:00.000Z", status: "success", duration_ms: 2950, movies_checked: 1, theaters_checked: 3, formats_checked: 3, total_new_showtimes: 2, total_notified: 12, error_message: null, ran_at: "2026-03-27 04:45:00" },
        ],
        totalRuns: 2,
        successRuns: 2,
        errorRuns: 0,
        avgDurationMs: 3075,
        successRate: 100,
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

    // Signups by day (last 30 days)
    const { results: signupsByDayRows } = await db
      .prepare(
        "SELECT strftime('%Y-%m-%d', subscribed_at) as day, COUNT(*) as count FROM subscribers WHERE subscribed_at IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 30"
      )
      .all<SignupsByDayRow>();

    // Date preferences — which showtime dates do subscribers want?
    let datePrefsRows: DatePrefRow[] = [];
    try {
      const { results } = await db
        .prepare(
          "SELECT value as pref_date, COUNT(*) as count FROM subscribers, json_each(dates) WHERE active = 1 GROUP BY value ORDER BY value"
        )
        .all<DatePrefRow>();
      datePrefsRows = results;
    } catch {
      // json_each may fail if dates column is absent or malformed — degrade gracefully
    }

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

    // Scraper run monitoring — last 20 runs
    let scraperRunRows: ScraperRunRow[] = [];
    let totalRuns = 0;
    let successRuns = 0;
    let errorRuns = 0;
    let avgDurationMs = 0;
    try {
      const { results } = await db
        .prepare(
          "SELECT id, run_id, status, duration_ms, movies_checked, theaters_checked, formats_checked, total_new_showtimes, total_notified, error_message, ran_at FROM scraper_runs ORDER BY id DESC LIMIT 20"
        )
        .all<ScraperRunRow>();
      scraperRunRows = results;

      const statsRow = await db
        .prepare(
          "SELECT COUNT(*) as total, SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors, AVG(duration_ms) as avg_ms FROM scraper_runs"
        )
        .first<{ total: number; successes: number; errors: number; avg_ms: number | null }>();
      totalRuns = statsRow?.total ?? 0;
      successRuns = statsRow?.successes ?? 0;
      errorRuns = statsRow?.errors ?? 0;
      avgDurationMs = Math.round(statsRow?.avg_ms ?? 0);
    } catch {
      // scraper_runs table may not exist on older deployments
    }

    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null;

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
      analytics: {
        signupsByDay: signupsByDayRows,
        datePreferences: datePrefsRows,
        openRateNote: "Email open tracking not yet implemented",
      },
      scraper: {
        cacheEntries,
        lastCheckedAt,
        cacheAgeMinutes,
        status: scraperStatus,
      },
      scraperMonitoring: {
        recentRuns: scraperRunRows,
        totalRuns,
        successRuns,
        errorRuns,
        avgDurationMs,
        successRate,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
