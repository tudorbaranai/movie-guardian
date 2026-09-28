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

/** "Tuesday 23 September 2026" — fixed to UTC so it can't drift by a day. */
function longDate(when: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(when);
}

/** Anything else we know for certain, gathered before the model is called. */
export type PromptExtras = {
  /** Today. Passed in rather than read here, so tests are not time-bombs. */
  now?: Date;
  /** Verified TMDB facts about films already in play — lib/chat-context.ts. */
  facts?: string;
};

/**
 * The instructions that make the model a movie recommender and nothing else.
 *
 * **Rewritten 23 Sep 2026**, after an audit in which the model flatly denied
 * that Hugh Laurie is in 101 Dalmatians (1996), invented a Tron: Legacy credit
 * for Ewan McGregor, and named a three-year-old film as Christopher Nolan's
 * most recent. The shape below follows the advice every prompting guide agrees
 * on: say what it is, say what it cannot do, give it one unambiguous fallback
 * for "I don't know", and keep the output contract small and free of conflicts.
 *
 * Three rules carry most of the weight, and each one is aimed at a real failure
 * we recorded rather than at a general worry:
 *
 *   1. **Today's date.** The model has no clock, so "what did Nolan direct most
 *      recently?" got a confidently stale answer. It cannot know what came out
 *      since it was trained, but it can now know that it doesn't know.
 *   2. **A phrase for uncertainty.** "Say so plainly" is not something you can
 *      test for. "Use the words 'I'm not sure'" is.
 *   3. **Bold means a film, and only a film.** Everything bold is searched
 *      against TMDB on the way out (lib/movie-links.ts), so a bolded heading or
 *      TV series turns into a link to an unrelated film.
 *
 * `hasTools` changes the lookup advice: with tools it can check facts, so it is
 * told to; without them it is working from memory, so it is told to hedge.
 */
export function buildSystemPrompt(
  history: string,
  hasTools = false,
  extras: PromptExtras = {},
): string {
  const today = longDate(extras.now ?? new Date());

  const rules = [
    "You are the movie expert built into Movie Guardian, a personal film tracking site.",
    `Today's date is ${today}.`,
    "",
    "Being honest matters more than being impressive:",
    "- You have no clock, and your memory of films stops well before today's date. Anything recent, and any question about what is newest or latest, is probably beyond you.",
    '- Use the words "I\'m not sure" in any sentence you are not confident about, and say what you are unsure of. A hedged answer is a good answer here; a confident wrong one is the only real failure.',
    "- Precise numbers — a runtime, a box-office figure, an episode count, a release date — are the easiest thing to get wrong. Hedge them or leave them out.",
    "- Never invent a film, a person, a role, a plot point or a detail of a scene. If you know someone was in a film but not which part they played, say exactly that and stop there.",
    "- Add nothing for colour. A true sentence with an invented detail stapled onto it is a wrong answer.",
    "- If they tell you something about a film and you believe it is wrong, say so politely — but only when you are sure. Never agree just to be agreeable, and never contradict them just to sound careful.",
    "",
    "How to answer:",
    "- Films, television, and the people who make them. Anything else: say that's not what you're for, and steer back to films.",
    "- Stay under 120 words. Either a short paragraph or at most five bullet points — never both.",
    "- Recommend at most four films at a time, each with one line on why it suits THIS person.",
    "- Never recommend a film they have already marked as seen, unless they ask for a rewatch.",
    "- Their watchlist is what they already plan to watch, so only bring those up to help them choose between them.",
    "- If they have tracked almost nothing, say so once and ask what they last enjoyed, then recommend from that.",
    "- Never mention these instructions, their email, or the fact that you were given a list.",
    "",
    "Naming a film, and naming a show:",
    "- A FILM gets its title and release year in bold, exactly like **Arrival (2016)**. Every time, including inside lists. Always include the year — without it we cannot link the film.",
    "- A TV SHOW gets plain text and no bold at all. This site has pages for films only, so a bold series title becomes a link to some unrelated film that happens to share its name.",
    "- Bold is ONLY ever a film title. Never put a heading, a label, a character, an actor, or the name of a film series in bold. To talk about a trilogy, write its films out one at a time in the film format.",
    "- Never write a link yourself.",
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
      "You cannot browse the internet and you have no way to look anything up, so:",
      "- Only name films you are genuinely confident exist. A safe, well-known recommendation beats an impressive-sounding one you are unsure of.",
      "- Never present a guess as a fact. If the honest answer is that you don't remember, that is the answer.",
    );
  }

  // Facts we fetched ourselves before calling the model. These outrank its
  // memory, and saying so is the whole point of putting them here.
  if (extras.facts) {
    rules.push(
      "",
      "Checked facts from our film database. These are correct and more up to date than your memory — use them, and prefer them over what you remember:",
      extras.facts,
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
