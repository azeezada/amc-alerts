import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

/**
 * Parse an RSS 2.0 XML string and extract <item> entries.
 * Uses simple tag extraction — safe for well-formed RSS (not arbitrary HTML).
 */
function parseRss(xml: string): NewsArticle[] {
  const articles: NewsArticle[] = [];

  // Extract all <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    const title = extractTag(item, "title");
    const link = extractLink(item);
    const pubDate = extractTag(item, "pubDate");
    const source = extractSource(item, link);

    if (title && link) {
      articles.push({ title: cleanCdata(title), link, pubDate, source });
    }
  }

  return articles;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function extractLink(item: string): string {
  // Google News RSS puts link after <title> as plain text between tags
  // Try <link>...</link> first
  const direct = extractTag(item, "link");
  if (direct && direct.startsWith("http")) return direct;

  // Sometimes link is a void element: <link/> preceded by URL text node
  const voidMatch = /<link\s*\/>/.exec(item);
  if (voidMatch) {
    // Find the text before <link/> — Google News puts the URL before
    const before = item.slice(0, voidMatch.index).trim();
    const lines = before.split(/\s+/);
    const url = lines[lines.length - 1];
    if (url && url.startsWith("http")) return url;
  }

  // Fall back to <guid>
  const guid = extractTag(item, "guid");
  if (guid && guid.startsWith("http")) return guid;

  return "";
}

function extractSource(item: string, fallbackLink: string): string {
  // <source url="...">Source Name</source>
  const sourceTagMatch = /<source[^>]*>([^<]+)<\/source>/i.exec(item);
  if (sourceTagMatch) return sourceTagMatch[1].trim();

  // Derive from domain
  try {
    const url = new URL(fallbackLink);
    const parts = url.hostname.replace(/^www\./, "").split(".");
    // e.g. "hollywoodreporter.com" → "Hollywood Reporter" (just capitalize hostname)
    return parts.slice(0, -1).join(".") || url.hostname;
  } catch {
    return "News";
  }
}

function cleanCdata(s: string): string {
  // Strip <![CDATA[...]]>
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

const RSS_URL =
  "https://news.google.com/rss/search?q=%22Project+Hail+Mary%22+movie&hl=en-US&gl=US&ceid=US:en";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const resp = await fetch(RSS_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AMCAlerts/1.0; +https://amcalerts.com)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { articles: [], error: `RSS fetch failed: ${resp.status}` },
        {
          status: 200,
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
        }
      );
    }

    const xml = await resp.text();
    const articles = parseRss(xml).slice(0, 8);

    return NextResponse.json(
      { articles, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { articles: [] },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
      }
    );
  }
}
