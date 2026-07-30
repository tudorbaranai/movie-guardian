// A dynamic route. The [id] folder means this one file serves EVERY movie:
// /movie/27205, /movie/155, and so on. The id arrives through `params`.
import Image from "next/image";
import { notFound } from "next/navigation";
import MovieGrid from "@/components/MovieGrid";
import MovieCard from "@/components/MovieCard";
import MovieActions from "./MovieActions";
import TrailerPlayer from "./TrailerPlayer";
import {
  getMovie,
  posterUrl,
  backdropUrl,
  profileUrl,
  yearOf,
  formatRuntime,
  findTrailer,
} from "@/lib/tmdb";
import styles from "./movie.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movie = await getMovie(id);
  if (!movie) return { title: "Movie not found" };
  return {
    title: movie.title,
    description: movie.overview?.slice(0, 160),
  };
}

export default async function MoviePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movie = await getMovie(id);

  if (!movie) notFound();

  const poster = posterUrl(movie.poster_path, "w500");
  const backdrop = backdropUrl(movie.backdrop_path);
  const year = yearOf(movie.release_date);
  const runtime = formatRuntime(movie.runtime);
  const trailer = findTrailer(movie.videos?.results);
  const cast = movie.credits?.cast?.slice(0, 10) ?? [];
  const recommendations = movie.recommendations?.results?.slice(0, 12) ?? [];

  const score = movie.vote_average ? movie.vote_average.toFixed(1) : null;
  const scoreClass =
    movie.vote_average >= 7
      ? styles.scoreGood
      : movie.vote_average >= 5
        ? styles.scoreOk
        : styles.scoreBad;

  return (
    <main>
      {/* ------------------------------- hero ------------------------------- */}
      <div className={styles.hero}>
        {backdrop && (
          <div className={styles.backdrop}>
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.backdropImage}
            />
            <div className={styles.backdropFade} />
          </div>
        )}

        <div className={`container ${styles.heroInner}`}>
          {/* Title and the headline facts sit across the top, IMDb-style. */}
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>
              {movie.title}
              {year && <span className={styles.year}>{year}</span>}
            </h1>

            {movie.tagline && <p className={styles.tagline}>{movie.tagline}</p>}

            <div className={styles.metaRow}>
              {score && (
                <span className={`${styles.score} ${scoreClass}`}>{score}</span>
              )}
              {movie.vote_count > 0 && (
                <span className={styles.metaItem}>
                  {movie.vote_count.toLocaleString()} votes
                </span>
              )}
              {runtime && <span className={styles.metaItem}>{runtime}</span>}
            </div>
          </div>

          {/* Poster on the left, trailer playing right beside it. */}
          <div className={styles.mediaRow}>
            <div className={styles.posterCol}>
              {poster ? (
                <Image
                  src={poster}
                  alt={`Poster for ${movie.title}`}
                  width={300}
                  height={450}
                  priority
                  className={styles.poster}
                />
              ) : (
                <div className={styles.noPoster}>No poster</div>
              )}
            </div>

            <div className={styles.trailerCol}>
              {trailer ? (
                <>
                  {/* Shows the film's still until you press play, THEN loads
                      YouTube. See TrailerPlayer.tsx for why that matters. */}
                  <TrailerPlayer
                    videoKey={trailer.key}
                    movieTitle={movie.title}
                    thumbnail={backdropUrl(movie.backdrop_path, "w780")}
                  />
                  <a
                    className={styles.trailerLink}
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch on YouTube ↗
                  </a>
                </>
              ) : (
                <div className={styles.noTrailer}>No trailer available</div>
              )}
            </div>
          </div>

          {movie.genres.length > 0 && (
            <ul className={styles.genres}>
              {movie.genres.map((genre) => (
                <li key={genre.id} className={styles.genre}>
                  {genre.name}
                </li>
              ))}
            </ul>
          )}

          {/* Runs in the browser; saves to Supabase. */}
          <MovieActions
            movieId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
          />
        </div>
      </div>

      {/* ------------------------------ details ----------------------------- */}
      <div className="container">
        {movie.overview && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Overview</h2>
            <p className={styles.overview}>{movie.overview}</p>
          </section>
        )}

        {cast.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Top cast</h2>
            <ul className={styles.castRow}>
              {cast.map((person) => {
                const photo = profileUrl(person.profile_path);
                return (
                  <li key={person.id} className={styles.castCard}>
                    <div className={styles.castPhotoWrap}>
                      {photo ? (
                        <Image
                          src={photo}
                          alt={person.name}
                          fill
                          sizes="120px"
                          className={styles.castPhoto}
                        />
                      ) : (
                        <div className={styles.castNoPhoto}>
                          {person.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className={styles.castName}>{person.name}</p>
                    <p className={styles.castRole}>{person.character}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {recommendations.length > 0 && (
          <MovieGrid title="If you liked this">
            {recommendations.map((rec) => (
              <MovieCard
                key={rec.id}
                id={rec.id}
                title={rec.title}
                posterPath={rec.poster_path}
                year={yearOf(rec.release_date)}
                score={rec.vote_average}
              />
            ))}
          </MovieGrid>
        )}
      </div>
    </main>
  );
}
