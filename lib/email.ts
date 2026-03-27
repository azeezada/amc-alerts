import { DateResult, formatDateNice } from "./scraper";

export function buildEmailHtml(
  newDates: DateResult[],
  unsubscribeToken?: string,
  email?: string,
  movieTitle?: string,
  theaterName?: string
): string {
  const displayMovie = movieTitle || "IMAX Showtime";
  const displayTheater = theaterName || "AMC Theatres";
  const dateRows = newDates
    .map((d) => {
      const showtimeRows = d.showtimes
        .map((st) => {
          const statusColor =
            st.status === "Sellable"
              ? "#22c55e"
              : st.status === "AlmostFull"
              ? "#f59e0b"
              : "#ef4444";
          return `
          <tr>
            <td style="padding:8px 12px;color:#e5e7eb;font-size:15px;">
              ${st.time} ${st.amPm}
            </td>
            <td style="padding:8px 12px;">
              <span style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor};border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600;">
                ${st.status}
              </span>
            </td>
            <td style="padding:8px 12px;">
              <a href="${st.url}" style="background:#e50914;color:#fff;text-decoration:none;padding:6px 16px;border-radius:4px;font-size:13px;font-weight:600;display:inline-block;">
                Buy Tickets →
              </a>
            </td>
          </tr>`;
        })
        .join("");

      return `
        <div style="margin-bottom:24px;">
          <h3 style="color:#fff;margin:0 0 12px;font-size:16px;font-weight:700;border-left:3px solid #e50914;padding-left:12px;">
            📅 ${formatDateNice(d.date)}
          </h3>
          <table style="width:100%;border-collapse:collapse;background:#1e1e3a;border-radius:8px;overflow:hidden;">
            ${showtimeRows}
          </table>
        </div>`;
    })
    .join("");

  const unsubLink = unsubscribeToken && email
    ? `<p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center;">
        <a href="https://amc-alerts.pages.dev/preferences?token=${encodeURIComponent(unsubscribeToken)}&email=${encodeURIComponent(email)}" style="color:#6b7280;">
          Manage preferences
        </a>
        &nbsp;·&nbsp;
        <a href="https://amc-alerts.pages.dev/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&email=${encodeURIComponent(email)}" style="color:#6b7280;">
          Unsubscribe
        </a>
      </p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="background:#e50914;display:inline-block;padding:6px 16px;border-radius:4px;margin-bottom:16px;">
        <span style="color:#fff;font-size:12px;font-weight:700;letter-spacing:1px;">AMC ALERTS</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;">
        🎬 IMAX 70mm Tickets Available
      </h1>
      <p style="color:#9ca3af;margin:8px 0 0;">
        ${displayMovie} · ${displayTheater}
      </p>
    </div>

    <!-- Alert Banner -->
    <div style="background:#e5091422;border:1px solid #e50914;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="color:#fff;margin:0;font-size:15px;">
        🚨 IMAX 70mm showtimes are now available for ${newDates.length} date${newDates.length > 1 ? "s" : ""}!
        <br><strong>Book now before they sell out.</strong>
      </p>
    </div>

    <!-- Dates -->
    ${dateRows}

    <!-- Footer -->
    <div style="border-top:1px solid #2d2d4e;margin-top:32px;padding-top:24px;">
      <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
        You're receiving this because you signed up for IMAX 70mm ticket alerts.<br>
        Not affiliated with AMC Theatres.
      </p>
      ${unsubLink}
    </div>
  </div>
</body>
</html>`;
}

export async function sendAdminErrorAlert(
  errorMessage: string,
  resendApiKey: string,
  adminEmail: string,
  context?: { runId?: string; moviesChecked?: number }
): Promise<void> {
  const runId = context?.runId ?? new Date().toISOString();
  const moviesChecked = context?.moviesChecked ?? 0;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ef444422;border:2px solid #ef4444;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h2 style="color:#ef4444;margin:0 0 8px;font-size:20px;">🚨 AMC Scraper Error</h2>
      <p style="color:#e5e7eb;margin:0;font-size:14px;">The AMC ticket scraper encountered an error and may need attention.</p>
    </div>
    <div style="background:#1e1e3a;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="color:#9ca3af;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Error</h3>
      <pre style="color:#f87171;font-size:13px;margin:0;white-space:pre-wrap;word-break:break-all;">${errorMessage}</pre>
    </div>
    <div style="background:#1e1e3a;border-radius:8px;padding:16px;">
      <h3 style="color:#9ca3af;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Run Details</h3>
      <p style="color:#e5e7eb;font-size:13px;margin:4px 0;">Run ID: <code style="color:#a5b4fc;">${runId}</code></p>
      <p style="color:#e5e7eb;font-size:13px;margin:4px 0;">Movies checked: ${moviesChecked}</p>
    </div>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center;">
      AMC IMAX Alerts — Admin Notification
    </p>
  </div>
</body>
</html>`;

  const text = [
    "🚨 AMC Scraper Error",
    "",
    `Error: ${errorMessage}`,
    `Run ID: ${runId}`,
    `Movies checked: ${moviesChecked}`,
  ].join("\n");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "IMAX Alerts <alerts@churnrecovery.com>",
      to: adminEmail,
      subject: "🚨 AMC Scraper Error — Action Required",
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`Admin alert send failed ${resp.status}: ${err}`);
  }
}

export function buildEmailText(
  newDates: DateResult[],
  movieTitle?: string,
  theaterName?: string
): string {
  const displayMovie = movieTitle || "IMAX Showtime";
  const displayTheater = theaterName || "AMC Theatres";
  const lines: string[] = [
    `🎬 IMAX 70mm Tickets Available — ${displayMovie}`,
    `${displayTheater}`,
    "",
  ];

  for (const d of newDates) {
    lines.push(`📅 ${formatDateNice(d.date)}`);
    for (const st of d.showtimes) {
      lines.push(`  • ${st.time} ${st.amPm} — ${st.status}`);
      lines.push(`    ${st.url}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("Not affiliated with AMC Theatres.");

  return lines.join("\n");
}
