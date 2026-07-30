"use client";

// Shown if something goes wrong (for example TMDB is unreachable).
// Error pages must be client components so they can offer a "try again" button.
import styles from "./message.module.css";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className={`container ${styles.wrap}`}>
      <p className={styles.emoji}>🎬</p>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.text}>
        We couldn&apos;t load that just now. This is usually temporary — please try
        again.
      </p>
      <button className={styles.cta} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
