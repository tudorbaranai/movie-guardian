// Turning the film titles in an answer into links to our own movie pages —
// without asking the model to do it, and without spending a single token.
//
// **Why this exists.** The obvious way to get a real TMDB id into an answer is
// to let the model look films up (lib/movie-tools.ts). That works, but it costs
// a whole extra round-trip to the model per lookup, and on a free-tier account
// that is the difference between four questions an hour and one. So instead we
// ask the model for something it can do in a single breath — write titles as
// `**Arrival (2016)**` — and do the looking-up ourselves, here, on the way out.
//
// TMDB is free and `lib/tmdb.ts` caches every search for an hour, so a title we
// have seen before costs nothing at all.
//
// **The happy side-effect.** Because we check each title against TMDB rather
// than trusting it, a model that misremembers a year gets quietly corrected:
// "Heat (1996)" goes out as Heat (1995), linked. A title TMDB has never heard
// of stays bold and unlinked, which is a useful tell that the model may have
// invented it.
import { searchMovies, yearOf } from "@/lib/tmdb";

/**
 * `**Arrival (2016)**` → title "Arrival", year "2016".
 *
 * The title must not itself start with `*`. Without that, `***Heat***` (bold
 * *and* italic) pairs its asterisks wrongly, reads the title as "*Heat", and
 * leaves an orphan `*` sitting in the chat bubble.
 */
const BOLD_TITLE = /^\*\*([^*].*?)(?:\s*\((\d{4})\))?\*\*$/;

/** A year this far out is a different film, not a slip. */
const YEAR_TOLERANCE = 1;

function normalise(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Find the film the model meant, or nothing.
 *
 * Deliberately strict: we only link when TMDB has a title that really matches,
 * because a confident link to the wrong film is worse than no link at all.
 */
async function findMovie(title: string, year: string | undefined) {
  const results = await searchMovies(title);
  if (results.length === 0) return null;

  const wanted = normalise(title);
  const exact = results.filter((movie) => normalise(movie.title) === wanted);
  const candidates = exact.length > 0 ? exact : [];

  // With a year to go on, prefer the film from that year.
  if (year && candidates.length > 0) {
    const byYear = candidates.find(
      (movie) =>
        Math.abs(Number(yearOf(movie.release_date) ?? 0) - Number(year)) <=
        YEAR_TOLERANCE,
    );
    if (byYear) return byYear;
  }

  // No year, or the year didn't match anything: the best exact title wins.
  return candidates[0] ?? null;
}

/**
 * Rewrite one `**…**` span. Returns a link when we're sure, and the original
 * bold text when we're not.
 */
async function linkFor(span: string, seen: Map<string, string>) {
  const match = span.match(BOLD_TITLE);
  if (!match) return span;

  const [, rawTitle, year] = match;
  const title = rawTitle.trim();
  if (!title) return span;

  const cacheKey = `${normalise(title)}|${year ?? ""}`;
  const remembered = seen.get(cacheKey);
  if (remembered !== undefined) return remembered;

  let rendered = span;
  try {
    const movie = await findMovie(title, year);
    if (movie) {
      // TMDB's year wins over the model's, so a misremembered year is fixed.
      const realYear = yearOf(movie.release_date);
      const label = realYear ? `${movie.title} (${realYear})` : movie.title;
      rendered = `[${label}](/movie/${movie.id})`;
    }
  } catch {
    // TMDB is down. Bold text is a perfectly good answer; don't lose it.
  }

  seen.set(cacheKey, rendered);
  return rendered;
}

/**
 * Sits in the stream between the model and the browser, swapping bold film
 * titles for links as they go past.
 *
 * It has to hold text back — you can't know a `**` is a title until its closing
 * `**` arrives — so it releases everything up to the first unclosed `**` and
 * keeps the rest until the span completes.
 */
export class MovieLinkEnricher {
  private held = "";
  /** One lookup per distinct title per answer, however often it's repeated. */
  private seen = new Map<string, string>();

  /** Add a chunk from the model; get back text ready for the browser. */
  async push(chunk: string): Promise<string> {
    this.held += chunk;
    let out = "";

    for (;;) {
      const open = this.held.indexOf("**");
      if (open === -1) break;

      const close = this.held.indexOf("**", open + 2);
      // The span is still being written — wait for the rest.
      if (close === -1) break;

      out += this.held.slice(0, open);
      out += await linkFor(this.held.slice(open, close + 2), this.seen);
      this.held = this.held.slice(close + 2);
    }

    // Release everything except a possible unfinished span, keeping back a
    // lone trailing `*` in case the second one is in the next chunk.
    const open = this.held.indexOf("**");
    if (open === -1) {
      const keep = this.held.endsWith("*") ? 1 : 0;
      out += this.held.slice(0, this.held.length - keep);
      this.held = this.held.slice(this.held.length - keep);
    } else {
      out += this.held.slice(0, open);
      this.held = this.held.slice(open);
    }

    return out;
  }

  /** The stream ended: release whatever is left, span or not. */
  async finish(): Promise<string> {
    const rest = this.held;
    this.held = "";
    if (!rest) return "";

    // A span that never closed is just text — send it as written.
    return rest.startsWith("**") && rest.endsWith("**") && rest.length > 4
      ? await linkFor(rest, this.seen)
      : rest;
  }
}
