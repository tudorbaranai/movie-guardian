// A responsive grid of movie cards, with an optional heading above it.
import type { ReactNode } from "react";
import styles from "./MovieGrid.module.css";

export default function MovieGrid({
  title,
  action,
  children,
}: {
  title?: string;
  /** Optional element shown on the right of the heading (e.g. a count). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      {title && (
        <div className={styles.heading}>
          <h2 className={styles.title}>{title}</h2>
          {action}
        </div>
      )}
      <div className={styles.grid}>{children}</div>
    </section>
  );
}
