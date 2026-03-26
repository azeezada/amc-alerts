import { NextRequest, NextResponse } from "next/server";
import { fetchPage, extractMoviesFromPage, type MovieInfo } from "@/lib/scraper";
import { getCfEnv } from "@/lib/cf-env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w342";

async function enrichWithTmdb(movies: MovieInfo[], apiKey: string): Promise<MovieInfo[]> {
  const enriched = await Promise.all(
    movies.map(async (movie) => {
      try {
        const searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(movie.title)}&language=en-US&page=1`;
        const resp = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) return movie;
        const data = await resp.json() as { results?: Array<{ poster_path?: string; overview?: string }> };
        const top = data.results?.[0];
        if (!top) return movie;
        return {
          ...movie,
          poster: top.poster_path ? `${TMDB_IMG_BASE}${top.poster_path}` : undefined,
          description: top.overview?.slice(0, 180) || undefined,
        };
      } catch {
        return movie;
      }
    })
  );
  return enriched;
}

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

    // Enrich with TMDB data if API key is available
    const env = await getCfEnv();
    const tmdbKey = (env as Record<string, unknown>).TMDB_API_KEY as string | undefined;
    const enrichedMovies = tmdbKey ? await enrichWithTmdb(movies, tmdbKey) : movies;

    return NextResponse.json(
      { movies: enrichedMovies, theater, date: targetDate },
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
