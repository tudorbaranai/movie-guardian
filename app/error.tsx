"use client";

// Shown if something goes wrong (for example TMDB is unreachable).
// Error pages must be client components so they can offer a "try again" button.
import styles from "./message.module.css";

export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  // `retry` fetches the page's data again and re-renders it. (The older
  // `reset` only re-renders, so it would show the same error again.)
  retry: () => void;
}) {
  return (
    <main className={`container ${styles.wrap}`}>
      <p className={styles.emoji}>🎬</p>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.text}>
        We couldn&apos;t load that just now. This is usually temporary — please
        try again.
      </p>
      <button className={styles.cta} onClick={() => retry()}>
        Try again
      </button>
    </main>
  );
}
