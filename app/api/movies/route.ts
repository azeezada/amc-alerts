import { NextRequest, NextResponse } from "next/server";
import { fetchPage, extractMoviesFromPage } from "@/lib/scraper";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const theater = request.nextUrl.searchParams.get("theater");
  const date = request.nextUrl.searchParams.get("date");

  if (!theater) {
    return NextResponse.json(
      { error: "Missing required parameter: theater" },
      { status: 400 }
    );
  }

  // Default to today if no date provided
  const targetDate = date || new Date().toISOString().split("T")[0];

  try {
    const html = await fetchPage(targetDate, theater);

    if (!html) {
      return NextResponse.json(
        { movies: [], error: "Could not fetch theater page" },
        { status: 502 }
      );
    }

    const movies = extractMoviesFromPage(html);

    return NextResponse.json(
      { movies, theater, date: targetDate },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    console.error("Movies API error:", e);
    return NextResponse.json(
      { error: "Failed to fetch movies", detail: String(e) },
      { status: 500 }
    );
  }
}
