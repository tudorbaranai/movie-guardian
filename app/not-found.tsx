// Shown when a page (or a movie id) doesn't exist.
import Link from "next/link";
import styles from "./message.module.css";

export default function NotFound() {
  return (
    <main className={`container ${styles.wrap}`}>
      <p className={styles.emoji}>🎞️</p>
      <h1 className={styles.title}>We couldn&apos;t find that one</h1>
      <p className={styles.text}>
        The page or film you&apos;re looking for doesn&apos;t exist — it may have been
        removed, or the link might be wrong.
      </p>
      <Link href="/" className={styles.cta}>
        Back to home
      </Link>
    </main>
  );
}
