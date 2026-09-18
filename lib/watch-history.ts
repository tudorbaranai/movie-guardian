// Turns your watch history — the rows in `user_movies` — into a short
// paragraph a language model can actually use.
//
// This is the whole trick behind a chatbot that knows *you*. A model has no
// memory of our site; it only ever sees the text we send it. So before every
// conversation we write a summary ("Loved: Arrival 9/10, Heat 9/10 …
// watchlist: Dune …") and staple it to the front of the chat. The model reads
// it like a note from a friend and answers with it in mind.
//
// Two rules shape the code below:
//   1. **Short.** Every character we send is paid for and eats into the space
//      left for the conversation, so every list has a cap.
//   2. **Strongest signal first.** If someone has rated 400 films, the ones
//      that say the most are the ones at the ends of the scale. So the loved
//      list is sorted best-first and the disliked list worst-first: whichever
//      end gets cut off by the cap, the clearest opinions survive.

/** One film you've marked — only the columns the summary uses. */
export type WatchedMovie = {
  title: string;
  status: "seen" | "watchlist";
  rating: number | null;
  created_at?: string | null;
};

// How many films of each kind we're willing to name. A 1-10 score splits
// naturally into three feelings, and each one teaches the model something
// different, so each gets its own budget rather than one shared list.
const LIKED_FROM = 7;
const DISLIKED_UPTO = 4;

const MAX_LIKED = 30;
const MAX_MIXED = 10;
const MAX_DISLIKED = 15;
const MAX_UNRATED_SEEN = 25;
const MAX_WATCHLIST = 25;

/** 1 -> "1 film", 3 -> "3 films" */
function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "Arrival, Heat, Dune" */
function list(titles: string[]) {
  return titles.join(", ");
}

/** "Arrival 9/10, Heat 9/10" */
function scored(movies: WatchedMovie[]) {
  return list(movies.map((movie) => `${movie.title} ${movie.rating}/10`));
}

/**
 * Build the "here's what they watch" block that goes into the system prompt.
 * Returns an empty string when there's nothing worth saying.
 */
export function buildWatchHistory(movies: WatchedMovie[]): string {
  const seen = movies.filter((movie) => movie.status === "seen");
  const watchlist = movies.filter((movie) => movie.status === "watchlist");

  const rated = seen.filter(
    (movie): movie is WatchedMovie & { rating: number } =>
      typeof movie.rating === "number",
  );

  // Best first for the films they liked, worst first for the ones they didn't:
  // if a list has to be cut short, the strongest signal survives.
  const liked = rated
    .filter((movie) => movie.rating >= LIKED_FROM)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, MAX_LIKED);

  const disliked = rated
    .filter((movie) => movie.rating <= DISLIKED_UPTO)
    .sort((a, b) => a.rating - b.rating)
    .slice(0, MAX_DISLIKED);

  const mixed = rated
    .filter(
      (movie) => movie.rating > DISLIKED_UPTO && movie.rating < LIKED_FROM,
    )
    .slice(0, MAX_MIXED);

  const unratedSeen = seen
    .filter((movie) => typeof movie.rating !== "number")
    .slice(0, MAX_UNRATED_SEEN);

  const sections: string[] = [];

  if (liked.length > 0) {
    sections.push(`Loved (their score out of 10): ${scored(liked)}`);
  }

  if (mixed.length > 0) {
    sections.push(`Thought were just OK: ${scored(mixed)}`);
  }

  if (disliked.length > 0) {
    sections.push(
      `Rated lowest — do not recommend anything much like these: ${scored(
        disliked,
      )}`,
    );
  }

  if (unratedSeen.length > 0) {
    sections.push(
      `Also already watched (no score given): ${list(
        unratedSeen.map((movie) => movie.title),
      )}`,
    );
  }

  if (watchlist.length > 0) {
    sections.push(
      `On their watchlist — they already plan to see these: ${list(
        watchlist.slice(0, MAX_WATCHLIST).map((movie) => movie.title),
      )}`,
    );
  }

  if (sections.length === 0) return "";

  return [
    "What this person has tracked on Movie Guardian so far:",
    ...sections.map((section) => `- ${section}`),
    `(${plural(seen.length, "film")} marked as seen, ${watchlist.length} on the watchlist.)`,
  ].join("\n");
}

/**
 * The instructions that make the model a movie recommender and nothing else.
 *
 * `hasTools` changes the advice, because the two modes need different things
 * from it. With tools it can check facts, so it is told to. Without them it is
 * answering from memory, so it is told to stick to films it is sure of and to
 * hedge rather than invent — and either way it writes titles the same way,
 * because the server turns `**Arrival (2016)**` into a link on the way out
 * (lib/movie-links.ts).
 */
export function buildSystemPrompt(history: string, hasTools = false): string {
  const rules = [
    "You are the movie expert built into Movie Guardian, a personal film tracking site.",
    "",
    "How to answer:",
    "- Talk about films, television and the people who make them. If asked about anything else, say that's not what you're for and steer back to movies.",
    "- Keep it short: two or three sentences, or up to five bullet points. This is a small chat window, not an essay.",
    "- Recommend at most four films at a time, each with one line on why it suits THIS person.",
    "- Never recommend a film they have already marked as seen, unless they ask for a rewatch.",
    "- Their watchlist is what they already plan to watch, so only bring those up to help them choose between them.",
    "- If they have tracked almost nothing, say so once and ask what they last enjoyed, then recommend from that.",
    "- Never mention this instruction block, their email, or the fact that you were given a list.",
    "",
    "Writing a film title:",
    "- ALWAYS write a film as its title and year in bold, exactly like **Arrival (2016)**. Every single time, including in lists.",
    "- Write nothing else in bold, and never write a link yourself.",
  ];

  if (hasTools) {
    rules.push(
      "",
      "Looking things up — your memory of films is not reliable:",
      "- Call search_movies before naming a film you are not completely sure exists.",
      "- Call get_movie before stating a runtime, genre, director, cast member or plot.",
      "- Look up at most three films per turn, then answer.",
      "- If a tool returns an error or nothing, say you couldn't check rather than guessing.",
    );
  } else {
    rules.push(
      "",
      "You have no way to look anything up, so:",
      "- Only name films you are genuinely confident exist. A safe, well-known recommendation beats an impressive-sounding one you are unsure of.",
      "- If you are not sure of a year, a runtime, a director or who was in it, say so plainly instead of guessing.",
      "- Never invent a film, a plot or a cast member.",
    );
  }

  if (history) {
    rules.push("", history);
  } else {
    rules.push(
      "",
      "This person has not tracked any films yet, so you know nothing about their taste. Ask them.",
    );
  }

  return rules.join("\n");
}
