// Grey placeholder cards shown while real movies are still loading.
// It keeps the page from "jumping" once the content arrives.
import styles from "./GridSkeleton.module.css";

export default function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.poster} />
          <div className={styles.line} />
          <div className={styles.lineShort} />
        </div>
      ))}
    </div>
  );
}
