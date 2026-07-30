"use client";

// One poster card. Used by every grid on the site (search, trending, My Movies),
// so a change here updates the whole site at once — the "reusable component" idea.
//
// It runs in the browser because it asks UserMoviesProvider whether YOU have
// marked this film — which only the signed-in browser knows.
import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { useMovieMarks } from "./UserMoviesProvider";
import styles from "./MovieCard.module.css";

type Props = {
  id: number;
  title: string;
  posterPath: string | null;
  year?: string | null;
  /** TMDB's public score, 0–10. */
  score?: number | null;
  /** The score YOU gave it, 1–10. */
  userRating?: number | null;
};

export default function MovieCard({
  id,
  title,
  posterPath,
  year,
  score,
  userRating,
}: Props) {
  const poster = posterUrl(posterPath, "w342");
  const { marks } = useMovieMarks();
  const mark = marks[id];

  const hasScore = score != null && score !== 0;

  return (
    <Link href={`/movie/${id}`} className={styles.card}>
      <div className={styles.posterWrap}>
        {poster ? (
          <Image
            src={poster}
            alt={`Poster for ${title}`}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            // Films you've already watched fade back, so the ones you HAVEN'T
            // are the ones that jump out of the grid.
            className={`${styles.poster} ${mark === "seen" ? styles.posterSeen : ""}`}
          />
        ) : (
          <div className={styles.noPoster}>No poster</div>
        )}

        {hasScore && <span className={styles.score}>{score!.toFixed(1)}</span>}

        {userRating != null && (
          <span className={styles.userRating}>★ {userRating}</span>
        )}

        {/* The marker: a coloured stroke along the bottom edge of the poster. */}
        {mark && (
          <>
            <span
              className={`${styles.underline} ${
                mark === "seen" ? styles.underlineSeen : styles.underlineList
              }`}
            />
            {/* Colour alone means nothing to a screen reader, so say it. */}
            <span className="srOnly">
              {mark === "seen" ? "Seen" : "On your watchlist"}
            </span>
          </>
        )}
      </div>

      <h3 className={styles.title}>{title}</h3>
      {year && <p className={styles.year}>{year}</p>}
    </Link>
  );
}
