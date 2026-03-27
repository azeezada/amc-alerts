import type { DateResult } from "@/lib/scraper";

export interface SmsEnv {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}

/**
 * Send an SMS alert via Twilio REST API.
 * Throws on HTTP error; returns silently if Twilio credentials are not configured.
 */
export async function sendSmsAlert(
  to: string,
  newDates: DateResult[],
  env: SmsEnv,
  movieTitle?: string,
  theaterName?: string
): Promise<void> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return; // SMS not configured — skip silently
  }

  const dateList = newDates
    .map((d) => `${d.date} (${d.showtimes.length} showtime${d.showtimes.length === 1 ? "" : "s"})`)
    .join(", ");

  const movie = movieTitle ?? "IMAX";
  const theater = theaterName ? ` at ${theaterName}` : "";
  const body = `🎬 ${movie} tickets now on sale${theater}! Dates: ${dateList}. Book now at amctheatres.com`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Twilio error ${resp.status}: ${err}`);
  }
}
