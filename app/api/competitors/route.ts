import { NextRequest, NextResponse } from "next/server";
import {
  COMPETITOR_THEATERS,
  getCompetitorsForMarket,
  buildCompetitorShowtimeUrl,
  FORMAT_LABELS,
} from "@/lib/competitors";
import { MARKETS } from "@/lib/theaters";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const market = request.nextUrl.searchParams.get("market") || "";
  const movieTitle = request.nextUrl.searchParams.get("movie") || "";
  const date = request.nextUrl.searchParams.get("date") || undefined;

  // Validate market if provided
  if (market && !COMPETITOR_THEATERS[market] && !MARKETS.find((m) => m.slug === market)) {
    return NextResponse.json(
      { error: "Unknown market", theaters: [] },
      { status: 400 }
    );
  }

  const theaters = market ? getCompetitorsForMarket(market) : [];

  // Enrich with showtime URLs when a movie title is provided
  const enriched = theaters.map((t) => ({
    ...t,
    showtimeUrl: movieTitle
      ? buildCompetitorShowtimeUrl(t, movieTitle, date)
      : t.theaterUrl,
    formatLabels: t.formats.map((f) => FORMAT_LABELS[f] ?? f),
  }));

  // If no market provided, return list of markets that have competitor data
  if (!market) {
    const marketsWithData = Object.keys(COMPETITOR_THEATERS).map((slug) => {
      const info = MARKETS.find((m) => m.slug === slug);
      return {
        slug,
        name: info?.name ?? slug,
        state: info?.state ?? "",
        competitorCount: COMPETITOR_THEATERS[slug].length,
      };
    });
    return NextResponse.json(
      { markets: marketsWithData },
      { headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }

  return NextResponse.json(
    { market, theaters: enriched },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
