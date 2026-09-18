// The two things the assistant is allowed to go and look up for itself.
//
// **What "tool calling" is.** Left alone, the model answers from what it
// memorised while it was trained, which is why it can be confidently wrong
// about a release year. Instead we hand it a short menu — "you may call
// search_movies, you may call get_movie" — and when it wants a fact it stops
// mid-answer and says "call get_movie(949) for me". Our server runs the real
// TMDB request, hands the result back, and the model carries on writing with
// the true data in front of it. It never touches the internet itself; we do.
//
// **Why every reply here is trimmed to a handful of fields.** Measured against
// the real API on 2026-09-18, TMDB's reply for *Heat* is **137,861 characters**
// of JSON — budgets, spoken languages, production companies, sixty cast
// members, every image path, every trailer, forty recommended films. The nine
// fields we keep come to **393**. That is not a rounding error: the untrimmed
// version would be charged for on this request AND again on every later message
// in the conversation, because the chat history is re-sent each time. Trimming
// here is by far the biggest saving in the whole feature.
import type OpenAI from "openai";
import { getMovie, searchMovies, yearOf } from "@/lib/tmdb";

/** How many search hits to hand back. Enough to pick from, few enough to read. */
const SEARCH_LIMIT = 5;
/** How many cast members are worth naming. */
const CAST_LIMIT = 3;
/** The plot, cut to a sentence or two. */
const OVERVIEW_LIMIT = 200;

/**
 * The menu the model sees. These descriptions are sent on every request, so
 * they're written to be short — each word here is paid for many times over.
 */
export const MOVIE_TOOLS: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] =
  [
    {
      type: "function",
      function: {
        name: "search_movies",
        description:
          "Find films by title. Use this to confirm a film exists and to get its id before recommending it.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Words from the film's title",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_movie",
        description:
          "Facts about one film by its id: genres, runtime, director, top cast, plot. Use before claiming any of those.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "number", description: "The id from search_movies" },
          },
          required: ["id"],
        },
      },
    },
  ];

function shorten(text: string | null | undefined) {
  if (!text) return null;
  if (text.length <= OVERVIEW_LIMIT) return text;
  return `${text.slice(0, OVERVIEW_LIMIT).trimEnd()}…`;
}

// TMDB scores have a lot of meaningless decimal places (7.334999…).
function score(vote: number | undefined) {
  return typeof vote === "number" && vote > 0
    ? Math.round(vote * 10) / 10
    : null;
}

async function runSearch(query: unknown) {
  if (typeof query !== "string" || !query.trim()) {
    return { error: "search_movies needs a query" };
  }

  const movies = await searchMovies(query.trim());
  return {
    results: movies.slice(0, SEARCH_LIMIT).map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: yearOf(movie.release_date),
      score: score(movie.vote_average),
    })),
  };
}

async function runDetails(id: unknown) {
  // The model sometimes sends "949" instead of 949; accept both, refuse junk.
  const movieId = typeof id === "string" ? Number(id) : id;
  if (
    typeof movieId !== "number" ||
    !Number.isInteger(movieId) ||
    movieId < 1
  ) {
    return { error: "get_movie needs a whole-number id from search_movies" };
  }

  const movie = await getMovie(movieId);
  if (!movie) return { error: `No film with id ${movieId}` };

  return {
    id: movie.id,
    title: movie.title,
    year: yearOf(movie.release_date),
    genres: movie.genres?.map((genre) => genre.name) ?? [],
    runtime: movie.runtime ?? null,
    director:
      movie.credits?.crew?.find((person) => person.job === "Director")?.name ??
      null,
    cast:
      movie.credits?.cast?.slice(0, CAST_LIMIT).map((person) => person.name) ??
      [],
    score: score(movie.vote_average),
    overview: shorten(movie.overview),
  };
}

/**
 * Run one tool the model asked for. Never throws: a failure comes back as
 * `{ error }` so the model can apologise or try something else, instead of
 * killing the whole answer.
 */
export async function runMovieTool(name: string, rawArguments: string) {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArguments || "{}");
  } catch {
    return { error: `Could not read the arguments for ${name}` };
  }

  try {
    if (name === "search_movies") return await runSearch(args.query);
    if (name === "get_movie") return await runDetails(args.id);
    return { error: `There is no tool called ${name}` };
  } catch (problem) {
    console.error(`Chat tool ${name} failed:`, problem);
    return { error: "TMDB did not answer. Say so rather than guessing." };
  }
}
