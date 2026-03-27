import { NextRequest, NextResponse } from "next/server";
import { getCfEnv, type D1Database } from "@/lib/cf-env";

export const runtime = "edge";

// 1x1 transparent GIF
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

async function recordEvent(
  db: D1Database | undefined,
  eventType: "open" | "click",
  email: string,
  runId: string | null,
  url: string | null
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        "INSERT INTO email_events (event_type, email, run_id, url) VALUES (?, ?, ?, ?)"
      )
      .bind(eventType, email, runId, url)
      .run();
  } catch {
    // Table may not exist on old deployments — silently ignore
  }
}

// GET /api/track?type=open&email=xxx&run_id=xxx
// GET /api/track?type=click&email=xxx&run_id=xxx&url=<encoded>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const email = searchParams.get("email") ?? "";
  const runId = searchParams.get("run_id");
  const url = searchParams.get("url");

  const env = await getCfEnv();
  const db: D1Database | undefined = env.DB;

  if (type === "open") {
    await recordEvent(db, "open", email, runId, null);
    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    });
  }

  if (type === "click" && url) {
    await recordEvent(db, "click", email, runId, url);
    // Validate URL is http(s) before redirecting
    let decoded: string;
    try {
      decoded = decodeURIComponent(url);
      const parsed = new URL(decoded);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    return NextResponse.redirect(decoded, 302);
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
