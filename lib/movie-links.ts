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
//
// **What we learned the hard way (audit, 22 Sep 2026).** `**bold**` is *also*
// the natural way to write a heading, a label, a franchise or a TV series, and
// the model reaches for it constantly. We used to search TMDB for every bold
// span we saw, so real answers shipped these links:
//
//     **Runtime:**   -> /movie/617761   ("Runtime", 2019)
//     **Star Wars**  -> /movie/11       (the 1977 original, not the trilogy)
//     **House (1977)** -> /movie/25623  (a Japanese horror film, not the show)
//
// A confident link to the wrong film is worse than no link, so the rules below
// are deliberately suspicious. The prompt now also asks for TV shows in plain
// text, because nothing here can tell a film from a series with the same name —
// that half of the problem is only fixable in the instructions.
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

/**
 * `**Trainspotting** (1996)` — the year written just *outside* the bold.
 *
 * The model does this constantly however firmly it is asked not to. We read the
 * year anyway and swallow it, because the link label we build already ends in
 * "(1996)" and printing it twice looks broken.
 *
 * The character class here and below holds a space AND a non-breaking space —
 * the second one is invisible in an editor, so don't "tidy" it away. Models
 * emit it often enough to matter.
 */
const TRAILING_YEAR = /^[  ]?\((\d{4})\)/;

/**
 * `**House** (2004–2012)` — a *range* of years, which is how anyone writes a
 * TV series. We never link these: the site has film pages only, and searching
 * TMDB for "House" finds a 1977 horror film that has nothing to do with it.
 */
const TRAILING_RANGE = /^[  ]?\((\d{4})\s*[–—-]\s*(?:\d{4}|present|now|)\)/i;

/**
 * How far past a closing `**` we must see before deciding whether a year
 * follows it. "(2004–present)" is the longest thing we look for.
 */
const LOOKAHEAD = 18;

/** Longest thing we will treat as a film title. Beyond this it's a sentence. */
const MAX_TITLE_LENGTH = 80;

function normalise(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Is this bold text plausibly a film title at all?
 *
 * Cheap, local, and it runs *before* the TMDB search — the point is not only to
 * avoid a wrong link but to avoid asking the question. `**Runtime:**` used to
 * match a real 2019 film called "Runtime"; nothing downstream could have
 * spotted that, because by then it was a perfectly good title.
 */
function looksLikeATitle(title: string) {
  if (!title || title.length > MAX_TITLE_LENGTH) return false;
  // A markdown label: "**Runtime:**", "**Box office:**". Never a film.
  if (title.endsWith(":")) return false;
  // A title is at least one letter. Rules out "**—**", "**1.**" and friends.
  if (!/\p{L}/u.test(title)) return false;
  // Bold spanning a line break is formatting, not a title.
  if (/[\n\r]/.test(title)) return false;
  return true;
}

/** What, if anything, follows the closing `**`. */
type Trailer =
  | { kind: "none"; length: 0 }
  | { kind: "year"; year: string; length: number }
  | { kind: "range"; length: number };

function readTrailer(after: string): Trailer {
  const range = after.match(TRAILING_RANGE);
  if (range) return { kind: "range", length: range[0].length };

  const year = after.match(TRAILING_YEAR);
  if (year) return { kind: "year", year: year[1], length: year[0].length };

  return { kind: "none", length: 0 };
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
  const candidates = results.filter(
    (movie) => normalise(movie.title) === wanted,
  );
  if (candidates.length === 0) return null;

  // With a year to go on, the year has to agree. If the model says 1977 and the
  // only "House" TMDB has is from 1995, those are two different films and we
  // would rather link neither. (A one-year slip is still forgiven, and TMDB's
  // year then wins — that's the "Heat (1996)" case.)
  if (year) {
    return (
      candidates.find(
        (movie) =>
          Math.abs(Number(yearOf(movie.release_date) ?? 0) - Number(year)) <=
          YEAR_TOLERANCE,
      ) ?? null
    );
  }

  // No year at all: the best exact title match wins.
  return candidates[0];
}

/**
 * Rewrite one `**…**` span. Returns a link when we're sure, and the original
 * bold text when we're not.
 */
async function linkFor(
  span: string,
  trailingYear: string | undefined,
  seen: Map<string, string>,
) {
  const match = span.match(BOLD_TITLE);
  if (!match) return span;

  const [, rawTitle, innerYear] = match;
  const title = rawTitle.trim();
  if (!looksLikeATitle(title)) return span;

  // A year inside the bold is what we asked for; one just outside is what we
  // often get. Either will do.
  const year = innerYear ?? trailingYear;

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
 * `**` arrives, and you can't know whether a year follows until a few more
 * characters do — so it releases everything up to the first `**` that is still
 * undecided, and keeps the rest.
 */
export class MovieLinkEnricher {
  private held = "";
  /** One lookup per distinct title per answer, however often it's repeated. */
  private seen = new Map<string, string>();

  /** Add a chunk from the model; get back text ready for the browser. */
  async push(chunk: string): Promise<string> {
    this.held += chunk;
    return await this.drain(false);
  }

  /** The stream ended: decide on whatever is left and release all of it. */
  async finish(): Promise<string> {
    const out = await this.drain(true);
    const rest = this.held;
    this.held = "";
    // A span that never closed is just text — send it as written.
    return out + rest;
  }

  /**
   * Resolve every complete span we can, oldest first.
   *
   * `final` is the end of the stream: it means "stop waiting for more context,
   * decide with what you have".
   */
  private async drain(final: boolean): Promise<string> {
    let out = "";

    for (;;) {
      const open = this.held.indexOf("**");
      if (open === -1) break;

      const close = this.held.indexOf("**", open + 2);
      // The span is still being written — wait for the rest.
      if (close === -1) break;

      const after = this.held.slice(close + 2);
      // We know where the title ends, but not yet whether "(1996)" follows it.
      if (!final && after.length < LOOKAHEAD) break;

      const span = this.held.slice(open, close + 2);
      const trailer = readTrailer(after);

      out += this.held.slice(0, open);

      if (trailer.kind === "range") {
        // "(2004–2012)" — a TV series. Leave the whole thing exactly as written.
        out += span + after.slice(0, trailer.length);
      } else {
        const year = trailer.kind === "year" ? trailer.year : undefined;
        const rendered = await linkFor(span, year, this.seen);
        // When we linked, the label already ends in "(1996)", so the year the
        // model wrote outside the bold is dropped rather than printed twice.
        // When we didn't, nothing was consumed and the text stands as written.
        out +=
          rendered === span ? span + after.slice(0, trailer.length) : rendered;
      }

      this.held = after.slice(trailer.length);
    }

    // Release everything except a span we haven't finished deciding about,
    // keeping back a lone trailing `*` in case the second one is in the next
    // chunk.
    const open = this.held.indexOf("**");
    if (open === -1) {
      const keep = !final && this.held.endsWith("*") ? 1 : 0;
      out += this.held.slice(0, this.held.length - keep);
      this.held = this.held.slice(this.held.length - keep);
    } else {
      out += this.held.slice(0, open);
      this.held = this.held.slice(open);
    }

    return out;
  }
}
