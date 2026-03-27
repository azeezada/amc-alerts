import { NextRequest, NextResponse } from "next/server";
import { checkAllTheatersAndFormats, DateResult, TARGET_DATES, THEATERS, FORMATS, DEFAULT_MOVIE_SLUG } from "@/lib/scraper";
import { buildEmailHtml, buildEmailText } from "@/lib/email";
import { getCfEnv, type D1Database } from "@/lib/cf-env";
import { generateUnsubscribeToken } from "@/lib/unsubscribe-token";
import { sendSmsAlert } from "@/lib/sms";

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
  phone_number: string | null;
  notification_channel: string | null;
}

interface MovieRow {
  movie_slug: string;
  movie_title: string | null;
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
    // Collect distinct movies with active subscribers.
    // Falls back to DEFAULT_MOVIE_SLUG when DB is unavailable or has no active subscribers.
    let moviesToCheck: MovieRow[] = [{ movie_slug: DEFAULT_MOVIE_SLUG, movie_title: null }];
    if (db) {
      try {
        const { results } = await db
          .prepare("SELECT DISTINCT movie_slug, movie_title FROM subscribers WHERE active = 1")
          .all<MovieRow>();
        if (results.length > 0) {
          moviesToCheck = results;
        }
      } catch (_) {
        // subscribers table may not exist yet; keep default
      }
    }

    logLine(`Movies to check (${moviesToCheck.length}): ${moviesToCheck.map((m) => m.movie_slug).join(", ")}`);

    // Per-movie scrape: accumulate newly-available showtimes keyed by movie then theater
    const newlyAvailableByMovieAndTheater: Record<string, Record<string, DateResult[]>> = {};

    for (const movieRow of moviesToCheck) {
      const movieSlug = movieRow.movie_slug || DEFAULT_MOVIE_SLUG;
      logLine(`\n--- Movie: ${movieSlug} ---`);

      const result = await checkAllTheatersAndFormats({ movieSlug });
      logLine(`Fetched ${THEATERS.length} theaters × ${FORMATS.length} formats × ${TARGET_DATES.length} dates`);

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
              const key = makeKey(theaterSlug, formatTag, date, movieSlug);
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
              // Dev mode: no DB — treat all showtimes as new
              if (!newlyAvailableByTheater[theaterSlug]) newlyAvailableByTheater[theaterSlug] = [];
              newlyAvailableByTheater[theaterSlug].push(dateResult);
            }
          }
        }
      }

      if (Object.keys(newlyAvailableByTheater).length > 0) {
        newlyAvailableByMovieAndTheater[movieSlug] = newlyAvailableByTheater;
      }
    }

    // Aggregate results across all movies
    const allByTheaterArrays = Object.values(newlyAvailableByMovieAndTheater).flatMap(Object.values);
    const totalNewEntries = allByTheaterArrays.reduce((sum, arr) => sum + arr.length, 0);

    logLine(`\nTotal newly available across all movies: ${totalNewEntries}`);

    if (totalNewEntries === 0) {
      return NextResponse.json({ log, notified: 0, newDates: [] });
    }

    const allNewDates = [...new Set(allByTheaterArrays.flat().map((d) => d.date))];

    if (!db) {
      logLine("[DEV] No DB — skipping notifications");
      return NextResponse.json({ log, notified: 0, newDates: allNewDates, devMode: true });
    }

    if (!resendApiKey) {
      logLine("No RESEND_API_KEY set — skipping email");
      return NextResponse.json({ log, notified: 0, newDates: allNewDates, error: "No RESEND_API_KEY" });
    }

    // Fetch all active subscribers once; filter per-movie below
    const { results: subscribers } = await db
      .prepare("SELECT email, dates, movie_slug, movie_title, theater_slugs, phone_number, notification_channel FROM subscribers WHERE active = 1")
      .all<SubscriberRow>();

    logLine(`Total active subscribers: ${subscribers.length}`);

    let notified = 0;

    for (const [movieSlug, newlyAvailableByTheater] of Object.entries(newlyAvailableByMovieAndTheater)) {
      logLine(`\n--- Notifying for movie: ${movieSlug} ---`);

      for (const sub of subscribers) {
        // Only notify subscribers watching this movie
        const subMovieSlug = sub.movie_slug || DEFAULT_MOVIE_SLUG;
        if (subMovieSlug !== movieSlug) {
          logLine(`  ⊘ Skip ${sub.email}: subscribed for ${subMovieSlug}, checking ${movieSlug}`);
          continue;
        }

        // Filter by theater: if subscriber has preferences, only include those
        const subTheaterSlugs: string[] = sub.theater_slugs ? JSON.parse(sub.theater_slugs) : [];
        const relevantTheaterSlugs =
          subTheaterSlugs.length === 0
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
        const theaterName =
          relevantTheaterSlugs.length === 1
            ? (THEATERS.find((t) => t.slug === relevantTheaterSlugs[0])?.name ?? relevantTheaterSlugs[0])
            : `${relevantTheaterSlugs.length} AMC theaters`;
        const movieTitle = sub.movie_title || undefined;

        try {
          const channel = sub.notification_channel || "email";
          if (channel === "email" || channel === "both") {
            await sendEmailViaResend(sub.email, relevantDates, resendApiKey, movieTitle, theaterName);
          }
          if ((channel === "sms" || channel === "both") && sub.phone_number) {
            await sendSmsAlert(sub.phone_number, relevantDates, {
              TWILIO_ACCOUNT_SID: (env as any).TWILIO_ACCOUNT_SID,
              TWILIO_AUTH_TOKEN: (env as any).TWILIO_AUTH_TOKEN,
              TWILIO_PHONE_NUMBER: (env as any).TWILIO_PHONE_NUMBER,
            }, movieTitle, theaterName);
          }
          await db
            .prepare("UPDATE subscribers SET notified_at = datetime('now') WHERE email = ?")
            .bind(sub.email)
            .run();
          notified++;
          logLine(`  ✓ Notified: ${sub.email} via ${channel} (${movieTitle ?? movieSlug} @ ${theaterName})`);
        } catch (e) {
          logLine(`  ✗ Failed to notify ${sub.email}: ${e}`);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    logLine(`\n=== Done. Notified ${notified} subscribers across ${moviesToCheck.length} movie(s) ===`);
    return NextResponse.json({ log, notified, newDates: allNewDates });
  } catch (e) {
    logLine(`ERROR: ${e}`);
    return NextResponse.json({ error: String(e), log }, { status: 500 });
  }
}
