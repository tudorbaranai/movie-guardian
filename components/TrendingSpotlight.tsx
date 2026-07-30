"use client";

// The big showcase at the top of the homepage: the week's most trending films,
// one shown large at a time, with the rest as numbered posters you can click.
// Searching lives in the header only — see the note by `.stage` in the CSS.
//
// It's a client component because it has to remember WHICH film you're looking
// at — and remembering something that changes as you click is exactly what
// state is for.
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./TrendingSpotlight.module.css";

// Everything the showcase needs about one film. The homepage builds these on
// the server and hands them over — plain data, no TMDB knowledge needed here.
export type SpotlightMovie = {
  id: number;
  title: string;
  overview: string;
  backdrop: string;
  poster: string | null;
  year: string | null;
  score: string | null;
};

export default function TrendingSpotlight({
  movies,
}: {
  movies: SpotlightMovie[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (movies.length === 0) return null;

  const active = movies[activeIndex];

  return (
    <section className={styles.spotlight} aria-label="Trending this week">
      {/* The stage spans the full width of the window. */}
      <div className={styles.stage}>
        <Image
          // Changing the `key` tells React this is a NEW image rather than the
          // same one with a different address — without it the old still would
          // linger on screen while the new one downloads.
          key={active.id}
          src={active.backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.stageImage}
        />
        {/* A dark gradient over the photo so white text stays readable no
            matter how bright the film still happens to be. */}
        <div className={styles.scrim} />

        {/* ...but the CONTENT stays lined up with the rest of the page, so the
            title sits directly above the poster grids below it. */}
        <div className={styles.inner}>
          <div className={styles.content}>
            <h2 className={styles.title}>{active.title}</h2>

            <div className={styles.meta}>
              {active.score && (
                <span className={styles.score}>
                  <span className={styles.star} aria-hidden="true">
                    ★
                  </span>
                  <span className={styles.scoreValue}>{active.score}</span>
                  <span className={styles.scoreMax}>/10</span>
                </span>
              )}
              {active.year && <span className={styles.year}>{active.year}</span>}
            </div>

            {active.overview && (
              <p className={styles.overview}>{active.overview}</p>
            )}

            <Link href={`/movie/${active.id}`} className={styles.cta}>
              View details
            </Link>
          </div>

          {/* The picker. `role="tablist"` tells screen readers these buttons
              swap what's shown above, rather than navigating somewhere. */}
          <div className={styles.picker} role="tablist">
            {movies.map((movie, index) => (
              <button
                key={movie.id}
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={movie.title}
                className={`${styles.thumb} ${
                  index === activeIndex ? styles.thumbActive : ""
                }`}
                onClick={() => setActiveIndex(index)}
              >
                {movie.poster && (
                  <Image
                    src={movie.poster}
                    alt=""
                    fill
                    sizes="72px"
                    loading="eager"
                    className={styles.thumbImage}
                  />
                )}
                <span className={styles.rank}>{index + 1}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
