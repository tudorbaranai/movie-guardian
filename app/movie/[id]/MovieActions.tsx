"use client";

// The "✓ Seen / + Watchlist / rating" panel on a movie page.
// It's a client component because it reacts to clicks and talks to Supabase.
import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useMovieMarks } from "@/components/UserMoviesProvider";
import styles from "./MovieActions.module.css";

type Props = {
  movieId: number;
  title: string;
  posterPath: string | null;
};

type Entry = {
  status: "seen" | "watchlist";
  rating: number | null;
};

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function MovieActions({ movieId, title, posterPath }: Props) {
  // Lets us tell every poster card on the site to re-check its marker after
  // you change something here.
  const { refresh } = useMovieMarks();
  const [user, setUser] = useState<User | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // When the panel loads: find out who's signed in, then look up whether they
  // have already marked THIS movie. (Row-Level Security means this can only
  // ever return the current user's own row.)
  useEffect(() => {
    let active = true;

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!active) return;
      setUser(userData.user);

      if (userData.user) {
        const { data } = await supabase
          .from("user_movies")
          .select("status, rating")
          .eq("movie_id", movieId)
          .maybeSingle();
        if (!active) return;
        setEntry((data as Entry) ?? null);
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [movieId]);

  // Save or update this movie in the user's list.
  // "upsert" = insert a new row, or update it if one already exists.
  async function save(status: "seen" | "watchlist", rating: number | null) {
    if (!user) return;
    const previous = entry;
    setError(null);
    setEntry({ status, rating }); // update the screen immediately

    const { error: saveError } = await supabase.from("user_movies").upsert(
      {
        user_id: user.id,
        movie_id: movieId,
        title,
        poster_path: posterPath,
        status,
        rating,
      },
      { onConflict: "user_id,movie_id" },
    );

    if (saveError) {
      setEntry(previous); // put it back if the save failed
      setError(saveError.message);
    } else {
      refresh(); // update the markers on every poster card
    }
  }

  // Take this movie out of the user's list entirely.
  async function remove() {
    if (!user) return;
    const previous = entry;
    setError(null);
    setEntry(null);

    const { error: deleteError } = await supabase
      .from("user_movies")
      .delete()
      .eq("movie_id", movieId);

    if (deleteError) {
      setEntry(previous);
      setError(deleteError.message);
    } else {
      refresh();
    }
  }

  if (loading) {
    return <div className={styles.box}>Loading…</div>;
  }

  if (!user) {
    return (
      <div className={styles.box}>
        <Link href="/login" className={styles.link}>
          Sign in
        </Link>{" "}
        to mark this movie as seen or add it to your watchlist.
      </div>
    );
  }

  return (
    <div className={styles.box}>
      <div className={styles.row}>
        <button
          className={entry?.status === "seen" ? styles.active : styles.button}
          onClick={() => save("seen", entry?.rating ?? null)}
        >
          ✓ Seen
        </button>
        <button
          className={entry?.status === "watchlist" ? styles.active : styles.button}
          onClick={() => save("watchlist", null)}
        >
          + Watchlist
        </button>
        {entry && (
          <button className={styles.remove} onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {entry?.status === "seen" && (
        <div className={styles.ratingRow}>
          <span className={styles.ratingLabel}>Your rating:</span>
          {RATINGS.map((n) => (
            <button
              key={n}
              className={
                entry.rating === n ? styles.ratingActive : styles.ratingButton
              }
              onClick={() => save("seen", n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
