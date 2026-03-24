import { NextRequest, NextResponse } from "next/server";
import { checkAllDates, DateResult, TARGET_DATES } from "@/lib/scraper";
import { buildEmailHtml, buildEmailText } from "@/lib/email";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";


interface CacheRow {
  date: string;
  data: string;
}

interface SubscriberRow {
  email: string;
  dates: string;
}

async function sendEmailViaResend(
  to: string,
  newDates: DateResult[],
  resendApiKey: string
) {
  const html = buildEmailHtml(newDates);
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
      subject: "🎬 IMAX 70mm Tickets Available — Project Hail Mary",
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
  const logLine = (msg: string) => { console.log(msg); log.push(msg); };

  logLine("=== AMC Check Started ===");

  try {
    const result = await checkAllDates();
    logLine(`Fetched ${TARGET_DATES.length} dates`);

    const newlyAvailable: DateResult[] = [];

    for (const [date, dateResult] of Object.entries(result.dates)) {
      if (!dateResult.available || dateResult.showtimes.length === 0) {
        logLine(`${date}: No IMAX 70mm available`);
        continue;
      }

      logLine(`${date}: ${dateResult.showtimes.length} showtime(s) found`);

      if (db) {
        const cached = await db
          .prepare("SELECT data FROM showtime_cache WHERE date = ?")
          .bind(date)
          .first<CacheRow>();

        if (!cached) {
          logLine(`  → NEW DATE (not in cache)`);
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

        await db
          .prepare("INSERT OR REPLACE INTO showtime_cache (date, data, checked_at) VALUES (?, ?, datetime('now'))")
          .bind(date, JSON.stringify(dateResult))
          .run();
      } else {
        newlyAvailable.push(dateResult);
      }
    }

    logLine(`Newly available dates: ${newlyAvailable.length}`);

    if (newlyAvailable.length === 0) {
      return NextResponse.json({ log, notified: 0, newDates: [] });
    }

    if (!db) {
      logLine("[DEV] No DB — skipping notifications");
      return NextResponse.json({ log, notified: 0, newDates: newlyAvailable.map((d) => d.date), devMode: true });
    }

    if (!resendApiKey) {
      logLine("No RESEND_API_KEY set — skipping email");
      return NextResponse.json({ log, notified: 0, newDates: newlyAvailable.map((d) => d.date), error: "No RESEND_API_KEY" });
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
          .prepare("UPDATE subscribers SET notified_at = datetime('now') WHERE email = ?")
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
    return NextResponse.json({ log, notified, newDates: newlyAvailable.map((d) => d.date) });
  } catch (e) {
    logLine(`ERROR: ${e}`);
    return NextResponse.json({ error: String(e), log }, { status: 500 });
  }
}
