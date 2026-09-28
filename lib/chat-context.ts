// The facts we look up *ourselves*, before the model is asked anything.
//
// **Why this exists.** The model answers film questions from memory, and an
// audit on 22 Sep 2026 showed exactly how badly that goes: it denied that Hugh
// Laurie is in 101 Dalmatians (1996) — he plays Jasper, fifth billed — and it
// handed Ewan McGregor a role from Tron: Legacy that belongs to Jeff Bridges.
// No wording in the system prompt can fix that, because the model is not
// breaking a rule; it simply doesn't know, and has nothing to check against.
//
// The fix is to put the answer in front of it. That is the same trick
// lib/movie-links.ts already uses — look it up ourselves on TMDB, for free —
// only moved to *before* the model is called instead of after.
//
// **What this module does NOT do yet.** It does not read the question and go
// hunting for whatever the person asked about; that needs entity extraction and
// is a job of its own. It takes the two films we already know about for certain,
// with no guessing involved:
//
//   1. the film page the chat was opened from, and
//   2. every film already linked earlier in this conversation — the link
//      enricher resolved those against TMDB as they streamed, so their ids are
//      sitting in the chat history, correct and free.
//
// Both cost zero extra requests to the model, which is the constraint that
// rules this whole feature: the free tier allows about five a minute.
import { getMovie, yearOf, type MovieDetails } from "@/lib/tmdb";

/** How many films we're willing to describe. Each one costs prompt space. */
const MAX_FILMS = 3;
/** Cast members named per film. Enough to answer "who was in it?". */
const CAST_LIMIT = 5;

/** `[Heat (1995)](/movie/949)` — the links our own enricher wrote. */
const MOVIE_LINK = /\/movie\/(\d+)/g;

type ChatMessage = { role: string; content: string };

/**
 * Which films this conversation is already about, most recent first.
 *
 * Only assistant messages are read. A person can type anything into the box,
 * including `/movie/1` — and while that is harmless here (the worst case is we
 * describe a film nobody asked about), reading only our own output means the
 * ids always came from our own TMDB lookups.
 */
export function movieIdsInChat(
  messages: ChatMessage[],
  pageMovieId?: number | null,
): number[] {
  const ids: number[] = [];

  // The page they are looking at is the strongest signal, so it goes first and
  // is never crowded out by an older mention.
  if (typeof pageMovieId === "number" && Number.isInteger(pageMovieId)) {
    ids.push(pageMovieId);
  }

  for (let at = messages.length - 1; at >= 0; at--) {
    const message = messages[at];
    if (message.role !== "assistant") continue;
    for (const match of message.content.matchAll(MOVIE_LINK)) {
      ids.push(Number(match[1]));
    }
  }

  // De-duplicate, keeping the first (most important) occurrence of each.
  return [...new Set(ids)].slice(0, MAX_FILMS);
}

/**
 * One film, as a single line the model can read at a glance.
 *
 * Cast members carry their character names on purpose. "Hugh Laurie as Jasper"
 * is the exact shape of fact the assistant got wrong, and it is the difference
 * between the model knowing someone is in a film and knowing what they did in
 * it — which is what people actually ask.
 */
export function filmFactLine(movie: MovieDetails): string {
  const year = yearOf(movie.release_date);
  const parts: string[] = [];

  const genres = movie.genres?.map((genre) => genre.name).join("/");
  if (genres) parts.push(genres);

  if (movie.runtime) parts.push(`${movie.runtime} min`);

  const director = movie.credits?.crew?.find(
    (person) => person.job === "Director",
  )?.name;
  if (director) parts.push(`directed by ${director}`);

  const cast = (movie.credits?.cast ?? [])
    .slice(0, CAST_LIMIT)
    .map((person) =>
      person.character ? `${person.name} as ${person.character}` : person.name,
    );
  if (cast.length > 0) parts.push(`starring ${cast.join(", ")}`);

  const title = year ? `${movie.title} (${year})` : movie.title;
  return `- ${title} — ${parts.join(" · ")}`;
}

/**
 * Build the "checked facts" block for the system prompt, or "" when there is
 * nothing to say.
 *
 * Never throws. TMDB being slow or down must not take the chat with it — the
 * assistant simply carries on the way it did before this module existed.
 */
export async function buildChatContext({
  messages,
  pageMovieId,
}: {
  messages: ChatMessage[];
  pageMovieId?: number | null;
}): Promise<string> {
  const ids = movieIdsInChat(messages, pageMovieId);
  if (ids.length === 0) return "";

  let films: (MovieDetails | null)[];
  try {
    films = await Promise.all(ids.map((id) => getMovie(id)));
  } catch (problem) {
    console.error("Chat context: TMDB lookup failed:", problem);
    return "";
  }

  const lines = films
    .filter((movie): movie is MovieDetails => Boolean(movie))
    .map(filmFactLine);

  if (lines.length === 0) return "";

  // Saying *why* each film is here helps the model use it for the right thing:
  // the page you're on is what "this film" means, the rest are what "it" means.
  const head =
    typeof pageMovieId === "number" && films[0]
      ? "The first film below is the page they are looking at right now; the rest have already come up in this conversation."
      : "These films have already come up in this conversation.";

  return [head, ...lines].join("\n");
}
