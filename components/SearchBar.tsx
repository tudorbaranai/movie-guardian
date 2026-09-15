"use client";

// The search box, with live suggestions as you type.
//
// It's still a real <form> that points at "/", so pressing Enter does a normal
// full search exactly like before — the suggestions are a shortcut layered on
// top, not a replacement.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./SearchBar.module.css";

type Suggestion = {
  id: number;
  title: string;
  year: string | null;
  poster: string | null;
};

// How long to wait after the last keystroke before asking the server. Typing
// "batman" would otherwise fire six searches; this makes it one.
const DEBOUNCE_MS = 250;

export default function SearchBar({
  defaultValue = "",
  size = "normal",
  autoFocus = false,
}: {
  defaultValue?: string;
  size?: "normal" | "compact";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // True when the last search failed (TMDB down, network error…), so the
  // panel can say so instead of a misleading "No matches".
  const [failed, setFailed] = useState(false);
  // Which suggestion the arrow keys are sitting on. -1 means "none".
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();

  // Fetch suggestions whenever the text settles.
  useEffect(() => {
    if (trimmed.length < 2) return;

    // An AbortController lets us cancel a request that's no longer wanted —
    // otherwise a slow answer for "bat" could land after the one for "batman"
    // and overwrite it with stale results.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Search failed (${response.status})`);
        const data = await response.json();
        setSuggestions(data.results ?? []);
        setActiveIndex(-1);
        // Deliberately NOT opening the panel here. It opens when you type in
        // or click the box; otherwise a box that starts pre-filled (like the
        // one on the search results page) would pop its list open by itself.
      } catch {
        // An aborted request (you kept typing) isn't an error worth showing.
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Close the list when you click somewhere else on the page.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function goToMovie(id: number) {
    setOpen(false);
    router.push(`/movie/${id}`);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!open || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      // Only hijack Enter when a suggestion is highlighted. Otherwise let the
      // form submit normally and run a full search.
      event.preventDefault();
      goToMovie(suggestions[activeIndex].id);
    }
  }

  const showPanel = open && trimmed.length >= 2;
  const listId = `search-suggestions-${size}`;

  return (
    <div
      className={size === "compact" ? styles.wrapCompact : styles.wrap}
      ref={wrapRef}
    >
      <form className={styles.form} action="/" method="get" role="search">
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>

        <label htmlFor={`search-${size}`} className="srOnly">
          Search for a movie
        </label>
        <input
          id={`search-${size}`}
          className={styles.input}
          type="search"
          name="q"
          placeholder="Search for a movie…"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setOpen(true);
            // Emptying the box should forget the old list, not keep it warm.
            if (value.trim().length < 2) {
              setSuggestions([]);
              setLoading(false);
              setFailed(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </form>

      {showPanel && (
        <div className={styles.panel} id={listId} role="listbox">
          {suggestions.map((movie, index) => (
            <button
              key={movie.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`${styles.item} ${
                index === activeIndex ? styles.itemActive : ""
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => goToMovie(movie.id)}
            >
              {movie.poster ? (
                <Image
                  src={movie.poster}
                  alt=""
                  width={34}
                  height={51}
                  // The list only exists while it's open, so these are always
                  // wanted right now — no point deferring them.
                  loading="eager"
                  className={styles.thumb}
                />
              ) : (
                <span className={styles.noThumb} aria-hidden="true">
                  🎬
                </span>
              )}
              <span className={styles.itemText}>
                <span className={styles.itemTitle}>{movie.title}</span>
                {movie.year && (
                  <span className={styles.itemYear}>{movie.year}</span>
                )}
              </span>
            </button>
          ))}

          {suggestions.length === 0 && (
            <p className={styles.status} role="status">
              {loading
                ? "Searching…"
                : failed
                  ? "Search isn't available right now. Try again in a moment."
                  : "No matches"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
