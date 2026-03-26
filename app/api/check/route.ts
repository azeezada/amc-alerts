import { NextRequest, NextResponse } from "next/server";
import { checkAllTheatersAndFormats, DateResult, TARGET_DATES, THEATERS, FORMATS, DEFAULT_MOVIE_SLUG } from "@/lib/scraper";
import { buildEmailHtml, buildEmailText } from "@/lib/email";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { generateUnsubscribeToken } from "@/lib/unsubscribe-token";

export const runtime = "edge";

interface CacheRow {
  cache_key: string;
  data: string;
}

interface SubscriberRow {
  email: string;
  dates: string;
  movie_slug: string | null;
  movie_title: string | null;
  theater_slugs: string | null;
}

function makeKey(theaterSlug: string, formatTag: string, date: string, movieSlug: string) {
  return `${movieSlug}__${theaterSlug}__${formatTag}__${date}`;
}

async function sendEmailViaResend(
  to: string,
  newDates: DateResult[],
  resendApiKey: string,
  movieTitle?: string,
  theaterName?: string
) {
  const unsubscribeToken = await generateUnsubscribeToken(to);
  const html = buildEmailHtml(newDates, unsubscribeToken, to, movieTitle, theaterName);
  const text = buildEmailText(newDates, movieTitle, theaterName);
  const subject = movieTitle
    ? `🎬 Tickets Available — ${movieTitle}`
    : "🎬 IMAX Tickets Available";

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "IMAX Alerts <alerts@churnrecovery.com>",
      to,
      subject,
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend error ${resp.status}: ${err}`);
  }
  return resp.json();
}

// POST /api/check — called by CF Cron Trigger or manual
export async function POST(request: NextRequest) {
  return runCheck(request);
}

// GET /api/check?secret=hailmary — manual trigger
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== "hailmary") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCheck(request);
}

async function runCheck(_request: NextRequest) {
  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;
  const resendApiKey: string | undefined = env.RESEND_API_KEY;

  const log: string[] = [];
  const logLine = (msg: string) => {
    console.log(msg);
    log.push(msg);
  };

  logLine("=== AMC Multi-Theater Check Started ===");
  logLine(`Theaters: ${THEATERS.map((t) => t.slug).join(", ")}`);
  logLine(`Formats: ${FORMATS.map((f) => f.tag).join(", ")}`);

  try {
    const result = await checkAllTheatersAndFormats();
    logLine(`Fetched ${THEATERS.length} theaters × ${FORMATS.length} formats × ${TARGET_DATES.length} dates`);

    // Track newly-available results per theater for subscriber-scoped filtering
    const newlyAvailableByTheater: Record<string, DateResult[]> = {};

    for (const [theaterSlug, theaterData] of Object.entries(result.theaters)) {
      for (const [formatTag, formatData] of Object.entries(theaterData.formats)) {
        for (const [date, dateResult] of Object.entries(formatData.dates)) {
          if (!dateResult.available || dateResult.showtimes.length === 0) {
            logLine(`${theaterSlug}/${formatTag}/${date}: No tickets`);
            continue;
          }

          logLine(`${theaterSlug}/${formatTag}/${date}: ${dateResult.showtimes.length} showtime(s)`);

          if (db) {
            const key = makeKey(theaterSlug, formatTag, date, DEFAULT_MOVIE_SLUG);
            let cached: CacheRow | null = null;
            try {
              cached = await db
                .prepare("SELECT cache_key, data FROM showtime_cache_v2 WHERE cache_key = ?")
                .bind(key)
                .first<CacheRow>();
            } catch (_) {
              // Table may not exist yet
            }

            let isNew = false;
            if (!cached) {
              logLine(`  → NEW (not in cache)`);
              isNew = true;
            } else {
              const prevData = JSON.parse(cached.data) as DateResult;
              if (!prevData.available || prevData.showtimes.length === 0) {
                logLine(`  → NEW (was unavailable before)`);
                isNew = true;
              } else {
                const prevIds = new Set(prevData.showtimes.map((s) => s.id));
                const newIds = dateResult.showtimes.filter((s) => !prevIds.has(s.id));
                if (newIds.length > 0) {
                  logLine(`  → ${newIds.length} new showtime(s) added`);
                  isNew = true;
                } else {
                  logLine(`  → Already known, no changes`);
                }
              }
            }

            if (isNew) {
              if (!newlyAvailableByTheater[theaterSlug]) newlyAvailableByTheater[theaterSlug] = [];
              newlyAvailableByTheater[theaterSlug].push(dateResult);
            }

            // Update cache
            try {
              await db
                .prepare(
                  "INSERT OR REPLACE INTO showtime_cache_v2 (cache_key, data, checked_at) VALUES (?, ?, datetime('now'))"
                )
                .bind(key, JSON.stringify(dateResult))
                .run();
            } catch (_) {
              // Ignore cache write failures
            }
          } else {
            if (!newlyAvailableByTheater[theaterSlug]) newlyAvailableByTheater[theaterSlug] = [];
            newlyAvailableByTheater[theaterSlug].push(dateResult);
          }
        }
      }
    }

    const totalNewEntries = Object.values(newlyAvailableByTheater).reduce((sum, arr) => sum + arr.length, 0);
    logLine(`Newly available: ${totalNewEntries} showtime entries across ${Object.keys(newlyAvailableByTheater).length} theater(s)`);

    if (totalNewEntries === 0) {
      return NextResponse.json({ log, notified: 0, newDates: [] });
    }

    if (!db) {
      logLine("[DEV] No DB — skipping notifications");
      const allDates = Object.values(newlyAvailableByTheater).flat().map((d) => d.date);
      return NextResponse.json({
        log,
        notified: 0,
        newDates: [...new Set(allDates)],
        devMode: true,
      });
    }

    if (!resendApiKey) {
      logLine("No RESEND_API_KEY set — skipping email");
      const allDates = Object.values(newlyAvailableByTheater).flat().map((d) => d.date);
      return NextResponse.json({
        log,
        notified: 0,
        newDates: [...new Set(allDates)],
        error: "No RESEND_API_KEY",
      });
    }

    const { results: subscribers } = await db
      .prepare("SELECT email, dates, movie_slug, movie_title, theater_slugs FROM subscribers WHERE active = 1")
      .all<SubscriberRow>();

    logLine(`Total active subscribers: ${subscribers.length}`);

    let notified = 0;
    for (const sub of subscribers) {
      // Filter by movie: only notify subscriber if the checked movie matches theirs
      const subMovieSlug = sub.movie_slug || DEFAULT_MOVIE_SLUG;
      if (subMovieSlug !== DEFAULT_MOVIE_SLUG) {
        logLine(`  ⊘ Skip ${sub.email}: subscribed for ${subMovieSlug}, checking ${DEFAULT_MOVIE_SLUG}`);
        continue;
      }

      // Filter by theater: if subscriber has theater preferences, only include those
      const subTheaterSlugs: string[] = sub.theater_slugs ? JSON.parse(sub.theater_slugs) : [];
      const relevantTheaterSlugs = subTheaterSlugs.length === 0
        ? Object.keys(newlyAvailableByTheater)
        : subTheaterSlugs.filter((slug) => newlyAvailableByTheater[slug]?.length > 0);

      if (relevantTheaterSlugs.length === 0) {
        logLine(`  ⊘ Skip ${sub.email}: no new showtimes at subscribed theater(s)`);
        continue;
      }

      // Filter by dates
      const subDates: string[] = JSON.parse(sub.dates || "[]");
      const relevantDates: DateResult[] = [];
      for (const theaterSlug of relevantTheaterSlugs) {
        for (const dr of newlyAvailableByTheater[theaterSlug] || []) {
          if (subDates.length === 0 || subDates.includes(dr.date)) {
            relevantDates.push(dr);
          }
        }
      }

      if (relevantDates.length === 0) continue;

      // Build theater name for email
      const theaterName = relevantTheaterSlugs.length === 1
        ? (THEATERS.find((t) => t.slug === relevantTheaterSlugs[0])?.name ?? relevantTheaterSlugs[0])
        : `${relevantTheaterSlugs.length} AMC theaters`;
      const movieTitle = sub.movie_title || undefined;

      try {
        await sendEmailViaResend(sub.email, relevantDates, resendApiKey, movieTitle, theaterName);
        await db
          .prepare(
            "UPDATE subscribers SET notified_at = datetime('now') WHERE email = ?"
          )
          .bind(sub.email)
          .run();
        notified++;
        logLine(`  ✓ Notified: ${sub.email} (${movieTitle ?? DEFAULT_MOVIE_SLUG} @ ${theaterName})`);
      } catch (e) {
        logLine(`  ✗ Failed to notify ${sub.email}: ${e}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    const allNewDates = [...new Set(Object.values(newlyAvailableByTheater).flat().map((d) => d.date))];
    logLine(`=== Done. Notified ${notified} subscribers ===`);
    return NextResponse.json({
      log,
      notified,
      newDates: allNewDates,
    });
  } catch (e) {
    logLine(`ERROR: ${e}`);
    return NextResponse.json({ error: String(e), log }, { status: 500 });
  }
}
