// @vitest-environment node
// Tests for turning **bold film titles** into links to our own movie pages
// (lib/movie-links.ts). TMDB is faked; nothing leaves the machine.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  searchMovies: vi.fn(),
}));

import { searchMovies, type Movie } from "@/lib/tmdb";
import { MovieLinkEnricher } from "@/lib/movie-links";

const search = vi.mocked(searchMovies);

function tmdbMovie(id: number, title: string, date: string): Movie {
  return {
    id,
    title,
    release_date: date,
    poster_path: null,
    backdrop_path: null,
    overview: "",
    vote_average: 7,
  };
}

/** Push a string through the enricher in fixed-size chunks, like a stream. */
async function streamThrough(text: string, chunkSize = 1) {
  const enricher = new MovieLinkEnricher();
  let out = "";
  for (let at = 0; at < text.length; at += chunkSize) {
    out += await enricher.push(text.slice(at, at + chunkSize));
  }
  return out + (await enricher.finish());
}

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue([tmdbMovie(949, "Heat", "1995-12-15")]);
});

describe("MovieLinkEnricher", () => {
  it("turns a bold title into a link, however the chunks fall", async () => {
    for (const chunkSize of [1, 2, 5, 13, 500]) {
      expect(
        await streamThrough("Try **Heat (1995)** tonight.", chunkSize),
      ).toBe("Try [Heat (1995)](/movie/949) tonight.");
    }
  });

  it("leaves ordinary text completely alone", async () => {
    const text = "I don't have a strong opinion about that one, sorry.";

    expect(await streamThrough(text)).toBe(text);
    expect(search).not.toHaveBeenCalled();
  });

  it("corrects a year the model got wrong", async () => {
    // The model says 1996; TMDB knows it's 1995. TMDB wins.
    expect(await streamThrough("**Heat (1996)**")).toBe(
      "[Heat (1995)](/movie/949)",
    );
  });

  it("leaves a title TMDB has never heard of as plain bold", async () => {
    search.mockResolvedValue([]);

    // Staying bold is the tell that the model may have invented it.
    expect(await streamThrough("**The Wind of Kepler (2019)**")).toBe(
      "**The Wind of Kepler (2019)**",
    );
  });

  it("refuses to link a title that doesn't really match", async () => {
    // Searching "Heat 2" returns the original Heat — close, but not it.
    search.mockResolvedValue([tmdbMovie(949, "Heat", "1995-12-15")]);

    expect(await streamThrough("**Heat 2 (2026)**")).toBe("**Heat 2 (2026)**");
  });

  it("looks a repeated title up only once", async () => {
    await streamThrough("**Heat (1995)** and again **Heat (1995)**", 4);

    expect(search).toHaveBeenCalledTimes(1);
  });

  it("keeps the bold text when TMDB is down", async () => {
    search.mockRejectedValue(new Error("TMDB request failed (503)"));

    expect(await streamThrough("Try **Heat (1995)**.")).toBe(
      "Try **Heat (1995)**.",
    );
  });

  it("handles a title with no year", async () => {
    expect(await streamThrough("**Heat**")).toBe("[Heat (1995)](/movie/949)");
  });

  it("doesn't mangle bold-italic into a link plus a stray asterisk", async () => {
    // ***Heat*** is bold+italic. Naively pairing the asterisks reads the title
    // as "*Heat" and leaves an orphan "*" behind in the bubble.
    expect(await streamThrough("***Heat***")).toBe("***Heat***");
  });

  it("doesn't go looking up bold text that isn't a film", async () => {
    expect(await streamThrough("**Note:** it is long.")).toBe(
      "**Note:** it is long.",
    );
    // And never even asks. A label like this is not a near-miss to be rejected
    // later — "Runtime:" really does match a 2019 film called Runtime.
    expect(search).not.toHaveBeenCalled();
  });

  it("releases a bold span that never closes", async () => {
    // Truncated mid-title: the reader still gets the words.
    expect(await streamThrough("Try **Heat (199")).toBe("Try **Heat (199");
  });
});

// Every case below is something the live model actually wrote during the audit
// on 22 Sep 2026, and every one of them used to produce a link to the wrong
// film. They are here so that can't come back.
describe("MovieLinkEnricher — the audit regressions", () => {
  it("never links a bullet-point label, however real the film behind it", async () => {
    // "**Runtime:**" shipped a link to /movie/617761 — "Runtime" (2019).
    for (const label of ["**Runtime:**", "**Box office:**", "**Director:**"]) {
      expect(await streamThrough(`${label} about 170 minutes.`)).toBe(
        `${label} about 170 minutes.`,
      );
    }
    expect(search).not.toHaveBeenCalled();
  });

  it("never links a whole bolded sentence", async () => {
    // The cap is generous on purpose — "Dr. Strangelove or: How I Learned to
    // Stop Worrying and Love the Bomb" is a real title, and a long one.
    const shout =
      "**I would genuinely rather not guess at this one, because I do not remember it well enough**";

    expect(await streamThrough(shout)).toBe(shout);
    expect(search).not.toHaveBeenCalled();
  });

  it("reads a year written just outside the bold, and prints it only once", async () => {
    search.mockResolvedValue([tmdbMovie(627, "Trainspotting", "1996-02-23")]);

    // The model writes this constantly, however firmly it is asked not to.
    expect(
      await streamThrough("**Trainspotting** (1996) is his breakout."),
    ).toBe("[Trainspotting (1996)](/movie/627) is his breakout.");
  });

  it("keeps the year it didn't use when the film can't be linked", async () => {
    search.mockResolvedValue([]);

    expect(await streamThrough("**The Wind of Kepler** (2019) is great.")).toBe(
      "**The Wind of Kepler** (2019) is great.",
    );
  });

  it("treats a range of years as a TV show and leaves it alone", async () => {
    // "**House** (2004–2012)" is the series. Searching TMDB for "House" finds
    // a 1977 Japanese horror film, which is what the chat used to link to.
    search.mockResolvedValue([tmdbMovie(25623, "House", "1977-08-30")]);

    expect(
      await streamThrough("**House** (2004–2012) is a medical drama."),
    ).toBe("**House** (2004–2012) is a medical drama.");
    expect(search).not.toHaveBeenCalled();
  });

  it("refuses a film whose year is nowhere near the one it was given", async () => {
    // The model asked for House (1977) meaning the TV show. If the only match
    // were the 1995 Heat, linking it would be a confident lie — so we don't.
    search.mockResolvedValue([tmdbMovie(949, "Heat", "1995-12-15")]);

    expect(await streamThrough("**Heat (1977)**")).toBe("**Heat (1977)**");
  });

  it("still forgives a one-year slip, and lets TMDB win", async () => {
    // The behaviour above must not cost us this: it's the reason the enricher
    // checks titles against TMDB at all.
    expect(await streamThrough("**Heat (1996)**")).toBe(
      "[Heat (1995)](/movie/949)",
    );
  });
});
