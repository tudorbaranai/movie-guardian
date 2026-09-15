"use client";

// "My Movies" — everything the signed-in user has marked, with stats,
// tabs (Seen / Watchlist) and sorting.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import { supabase } from "@/lib/supabase";
import styles from "./my-movies.module.css";

type Row = {
  movie_id: number;
  title: string;
  poster_path: string | null;
  status: "seen" | "watchlist";
  rating: number | null;
  created_at: string;
};

type Tab = "seen" | "watchlist";
type Sort = "added" | "rating" | "title";

export default function MyMoviesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  // True when the database couldn't be reached, so we show an error with a
  // retry button instead of a misleading "you haven't marked anything yet".
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("seen");
  const [sort, setSort] = useState<Sort>("added");

  // Bumped by "Try again" to run the loading effect below once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setLoading(false);
        return;
      }
      setSignedIn(true);

      // No "where user_id = me" needed — Row-Level Security does that for us.
      const { data, error } = await supabase
        .from("user_movies")
        .select("movie_id, title, poster_path, status, rating, created_at")
        .order("created_at", { ascending: false });

      setLoadFailed(Boolean(error));
      setRows(error ? [] : ((data as Row[]) ?? []));
      setLoading(false);
    }

    load();
  }, [attempt]);

  function retry() {
    setLoading(true);
    setLoadFailed(false);
    setAttempt((count) => count + 1);
  }

  const seen = useMemo(() => rows.filter((r) => r.status === "seen"), [rows]);
  const watchlist = useMemo(
    () => rows.filter((r) => r.status === "watchlist"),
    [rows],
  );

  // Average of the films you actually gave a score to.
  const rated = seen.filter((r) => r.rating != null);
  const average =
    rated.length > 0
      ? (
          rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
        ).toFixed(1)
      : null;

  const visible = useMemo(() => {
    const list = [...(tab === "seen" ? seen : watchlist)];
    if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list; // "added" is already the order from the database
  }, [tab, sort, seen, watchlist]);

  if (loading) {
    return (
      <main className="container">
        <p className={styles.state}>Loading your movies…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="container">
        <div className={styles.signedOut}>
          <h1 className={styles.title}>My Movies</h1>
          <p className={styles.state}>
            Sign in to see the films you&apos;ve marked and rated.
          </p>
          <Link href="/login" className={styles.cta}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  if (loadFailed) {
    return (
      <main className="container">
        <div className={styles.signedOut}>
          <h1 className={styles.title}>My Movies</h1>
          <p className={styles.state} role="alert">
            We couldn&apos;t load your movies just now. Check your connection
            and try again.
          </p>
          <button type="button" className={styles.cta} onClick={retry}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className={styles.header}>
        <h1 className={styles.title}>My Movies</h1>

        <div className={styles.stats}>
          <Stat value={seen.length} label="watched" />
          <Stat value={watchlist.length} label="to watch" />
          <Stat
            value={average ?? "—"}
            label="avg rating"
            highlight={!!average}
          />
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={tab === "seen"}
            className={tab === "seen" ? styles.tabActive : styles.tab}
            onClick={() => setTab("seen")}
          >
            Seen <span className={styles.tabCount}>{seen.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "watchlist"}
            className={tab === "watchlist" ? styles.tabActive : styles.tab}
            onClick={() => setTab("watchlist")}
          >
            Watchlist{" "}
            <span className={styles.tabCount}>{watchlist.length}</span>
          </button>
        </div>

        <label className={styles.sortWrap}>
          <span className="srOnly">Sort by</span>
          <select
            className={styles.sort}
            value={sort}
            onChange={(event) => setSort(event.target.value as Sort)}
          >
            <option value="added">Recently added</option>
            <option value="rating">Highest rated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {tab === "seen"
              ? "You haven't marked anything as seen yet."
              : "Your watchlist is empty."}
          </p>
          <p className={styles.emptyText}>
            Search for a film and use the buttons on its page to add it here.
          </p>
          <Link href="/" className={styles.cta}>
            Find something to watch
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((movie) => (
            <MovieCard
              key={movie.movie_id}
              id={movie.movie_id}
              title={movie.title}
              posterPath={movie.poster_path}
              userRating={movie.rating}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({
  value,
  label,
  highlight = false,
}: {
  value: number | string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className={styles.stat}>
      <span className={highlight ? styles.statValueGold : styles.statValue}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
