import { NextRequest, NextResponse } from "next/server";
import { MARKETS, POPULAR_THEATERS, searchTheaters } from "@/lib/theaters";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const market = request.nextUrl.searchParams.get("market") || "";

  // If market specified, return theaters for that market
  if (market && !q) {
    const theaters = POPULAR_THEATERS[market] || [];
    return NextResponse.json(
      { theaters, market },
      { headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }

  // If query specified, search across markets (optionally filtered)
  if (q) {
    const results = searchTheaters(q, market || undefined);
    return NextResponse.json(
      { theaters: results },
      { headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }

  // No params: return all markets with their theater counts
  const marketsWithCounts = MARKETS.map((m) => ({
    ...m,
    theaterCount: (POPULAR_THEATERS[m.slug] || []).length,
  }));

  return NextResponse.json(
    { markets: marketsWithCounts },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
