// A small endpoint of our own, at /api/search?q=bat
//
// Why does this exist? The search box lives in the BROWSER, but our TMDB token
// is server-only (that's the whole point of leaving `NEXT_PUBLIC_` off it in
// .env.local). So the browser asks *us*, and we ask TMDB on its behalf and hand
// back only the few fields the dropdown needs.
import { searchMovies, posterUrl, yearOf } from "@/lib/tmdb";

// How many suggestions to show. Enough to be useful, few enough to scan.
const LIMIT = 7;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  // One letter matches half of cinema — wait until there's something to go on.
  if (query.length < 2) return Response.json({ results: [] });

  try {
    const movies = await searchMovies(query);

    const results = movies.slice(0, LIMIT).map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: yearOf(movie.release_date),
      poster: posterUrl(movie.poster_path, "w185"),
    }));

    return Response.json({ results });
  } catch (error) {
    // TMDB is down or refused us. Say so clearly (status 502 = "the service
    // behind me failed"), so the search box can show an error instead of
    // pretending nothing matched.
    console.error("Search failed:", error);
    return Response.json(
      { results: [], error: "Search is unavailable right now." },
      { status: 502 },
    );
  }
}
