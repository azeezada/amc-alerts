import { DateResult, formatDateNice } from "./scraper";

export function buildEmailHtml(
  newDates: DateResult[],
  unsubscribeToken?: string
): string {
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

  const unsubLink = unsubscribeToken
    ? `<p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center;">
        <a href="https://amc-alerts.pages.dev/unsubscribe?token=${unsubscribeToken}" style="color:#6b7280;">
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
        Project Hail Mary · AMC Lincoln Square 13 · New York City
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

export function buildEmailText(newDates: DateResult[]): string {
  const lines: string[] = [
    "🎬 IMAX 70mm Tickets Available — Project Hail Mary",
    "AMC Lincoln Square 13 · New York City",
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
