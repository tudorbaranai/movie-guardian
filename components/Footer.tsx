import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.line}>
          🎬 <strong>Movie Guardian</strong> — a personal film tracker.
        </p>
        {/* TMDB asks every project using their free API to include this note. */}
        <p className={styles.attribution}>
          This product uses the{" "}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            TMDB
          </a>{" "}
          API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </footer>
  );
}
