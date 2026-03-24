import { NextRequest, NextResponse } from "next/server";
import { checkAllTheatersAndFormats, DateResult, TARGET_DATES, THEATERS, FORMATS } from "@/lib/scraper";
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
}

function makeKey(theaterSlug: string, formatTag: string, date: string) {
  return `${theaterSlug}__${formatTag}__${date}`;
}

async function sendEmailViaResend(
  to: string,
  newDates: DateResult[],
  resendApiKey: string
) {
  const unsubscribeToken = await generateUnsubscribeToken(to);
  const html = buildEmailHtml(newDates, unsubscribeToken, to);
  const text = buildEmailText(newDates);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "IMAX Alerts <alerts@churnrecovery.com>",
      to,
      subject: "🎬 Tickets Available — Project Hail Mary",
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

    // Collect newly-available date results across all theater+format combos
    const newlyAvailable: DateResult[] = [];

    for (const [theaterSlug, theaterData] of Object.entries(result.theaters)) {
      for (const [formatTag, formatData] of Object.entries(theaterData.formats)) {
        for (const [date, dateResult] of Object.entries(formatData.dates)) {
          if (!dateResult.available || dateResult.showtimes.length === 0) {
            logLine(`${theaterSlug}/${formatTag}/${date}: No tickets`);
            continue;
          }

          logLine(`${theaterSlug}/${formatTag}/${date}: ${dateResult.showtimes.length} showtime(s)`);

          if (db) {
            const key = makeKey(theaterSlug, formatTag, date);
            let cached: CacheRow | null = null;
            try {
              cached = await db
                .prepare("SELECT cache_key, data FROM showtime_cache_v2 WHERE cache_key = ?")
                .bind(key)
                .first<CacheRow>();
            } catch (_) {
              // Table may not exist yet
            }

            if (!cached) {
              logLine(`  → NEW (not in cache)`);
              newlyAvailable.push(dateResult);
            } else {
              const prevData = JSON.parse(cached.data) as DateResult;
              if (!prevData.available || prevData.showtimes.length === 0) {
                logLine(`  → NEW (was unavailable before)`);
                newlyAvailable.push(dateResult);
              } else {
                const prevIds = new Set(prevData.showtimes.map((s) => s.id));
                const newIds = dateResult.showtimes.filter((s) => !prevIds.has(s.id));
                if (newIds.length > 0) {
                  logLine(`  → ${newIds.length} new showtime(s) added`);
                  newlyAvailable.push(dateResult);
                } else {
                  logLine(`  → Already known, no changes`);
                }
              }
            }

            // Update cache
            try {
              const key2 = makeKey(theaterSlug, formatTag, date);
              await db
                .prepare(
                  "INSERT OR REPLACE INTO showtime_cache_v2 (cache_key, data, checked_at) VALUES (?, ?, datetime('now'))"
                )
                .bind(key2, JSON.stringify(dateResult))
                .run();
            } catch (_) {
              // Ignore cache write failures
            }
          } else {
            newlyAvailable.push(dateResult);
          }
        }
      }
    }

    logLine(`Newly available: ${newlyAvailable.length} showtime entries`);

    if (newlyAvailable.length === 0) {
      return NextResponse.json({ log, notified: 0, newDates: [] });
    }

    if (!db) {
      logLine("[DEV] No DB — skipping notifications");
      return NextResponse.json({
        log,
        notified: 0,
        newDates: newlyAvailable.map((d) => d.date),
        devMode: true,
      });
    }

    if (!resendApiKey) {
      logLine("No RESEND_API_KEY set — skipping email");
      return NextResponse.json({
        log,
        notified: 0,
        newDates: newlyAvailable.map((d) => d.date),
        error: "No RESEND_API_KEY",
      });
    }

    const { results: subscribers } = await db
      .prepare("SELECT email, dates FROM subscribers WHERE active = 1")
      .all<SubscriberRow>();

    logLine(`Total active subscribers: ${subscribers.length}`);

    let notified = 0;
    for (const sub of subscribers) {
      const subDates: string[] = JSON.parse(sub.dates || "[]");
      const relevantDates = newlyAvailable.filter(
        (d) => subDates.length === 0 || subDates.includes(d.date)
      );

      if (relevantDates.length === 0) continue;

      try {
        await sendEmailViaResend(sub.email, relevantDates, resendApiKey);
        await db
          .prepare(
            "UPDATE subscribers SET notified_at = datetime('now') WHERE email = ?"
          )
          .bind(sub.email)
          .run();
        notified++;
        logLine(`  ✓ Notified: ${sub.email}`);
      } catch (e) {
        logLine(`  ✗ Failed to notify ${sub.email}: ${e}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    logLine(`=== Done. Notified ${notified} subscribers ===`);
    return NextResponse.json({
      log,
      notified,
      newDates: newlyAvailable.map((d) => d.date),
    });
  } catch (e) {
    logLine(`ERROR: ${e}`);
    return NextResponse.json({ error: String(e), log }, { status: 500 });
  }
}
