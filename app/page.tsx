// The homepage ("/"). It's an async Server Component: it fetches from TMDB on
// the server and sends finished HTML to the browser.
// - With "?q=..." in the URL it shows search results.
// - Without one it shows Trending and Popular films.
import SearchBar from "@/components/SearchBar";
import MovieGrid from "@/components/MovieGrid";
import MovieCard from "@/components/MovieCard";
import TrendingSpotlight, {
  type SpotlightMovie,
} from "@/components/TrendingSpotlight";
import {
  searchMovies,
  getTrending,
  getPopular,
  yearOf,
  posterUrl,
  backdropUrl,
} from "@/lib/tmdb";
import styles from "./page.module.css";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  /* ------------------------------ search mode ----------------------------- */
  if (query) {
    const results = await searchMovies(query);

    return (
      <main className="container">
        <div className={styles.searchHeader}>
          <h1 className={styles.searchTitle}>
            Results for <span className={styles.queryText}>“{query}”</span>
          </h1>
          <p className={styles.searchCount}>
            {results.length === 0
              ? "No movies found"
              : `${results.length} ${results.length === 1 ? "movie" : "movies"}`}
          </p>
        </div>

        <div className={styles.searchAgain}>
          <SearchBar defaultValue={query} />
        </div>

        {results.length === 0 ? (
          <p className={styles.empty}>
            Nothing matched that. Try a different spelling, or search for part
            of the title.
          </p>
        ) : (
          <MovieGrid>
            {results.map((movie) => (
              <MovieCard
                key={movie.id}
                id={movie.id}
                title={movie.title}
                posterPath={movie.poster_path}
                year={yearOf(movie.release_date)}
                score={movie.vote_average}
              />
            ))}
          </MovieGrid>
        )}
      </main>
    );
  }

  /* ----------------------------- discover mode ---------------------------- */
  // Both requests are sent at the same time, so the page loads faster.
  const [trending, popular] = await Promise.all([getTrending(), getPopular()]);

  // The showcase needs a wide still, so only films that actually have one can
  // headline it. We build plain objects here on the server and hand them to the
  // component — it never has to know TMDB exists.
  const spotlight: SpotlightMovie[] = trending
    .filter((movie) => movie.backdrop_path)
    .slice(0, 5)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      backdrop: backdropUrl(movie.backdrop_path)!,
      poster: posterUrl(movie.poster_path, "w185"),
      year: yearOf(movie.release_date),
      score: movie.vote_average ? movie.vote_average.toFixed(1) : null,
    }));

  return (
    <main>
      {/* The visible headline is the film in the showcase, so the page's own
          title is here for screen readers and search engines only. */}
      <h1 className="srOnly">Movie Guardian — trending films</h1>

      <TrendingSpotlight movies={spotlight} />

      <div className="container">
        <MovieGrid title="Trending this week">
          {trending.slice(0, 12).map((movie) => (
            <MovieCard
              key={movie.id}
              id={movie.id}
              title={movie.title}
              posterPath={movie.poster_path}
              year={yearOf(movie.release_date)}
              score={movie.vote_average}
            />
          ))}
        </MovieGrid>

        <MovieGrid title="Popular right now">
          {popular.slice(0, 12).map((movie) => (
            <MovieCard
              key={movie.id}
              id={movie.id}
              title={movie.title}
              posterPath={movie.poster_path}
              year={yearOf(movie.release_date)}
              score={movie.vote_average}
            />
          ))}
        </MovieGrid>
      </div>
    </main>
  );
}
