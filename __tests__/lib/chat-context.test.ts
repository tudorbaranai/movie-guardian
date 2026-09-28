// @vitest-environment node
// Tests for the facts we look up ourselves before calling the model
// (lib/chat-context.ts). TMDB is faked; nothing leaves the machine.
//
// The case that drove this module: asked whether "doctor house" is in
// 101 Dalmatians, the live model said no. Hugh Laurie plays Jasper in it, and
// TMDB will say so for free — the model just never gets to see it.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  getMovie: vi.fn(),
}));

import { getMovie, type MovieDetails } from "@/lib/tmdb";
import {
  buildChatContext,
  filmFactLine,
  movieIdsInChat,
} from "@/lib/chat-context";

const fetchMovie = vi.mocked(getMovie);

function details(
  id: number,
  title: string,
  date: string,
  extra: Partial<MovieDetails> = {},
): MovieDetails {
  return {
    id,
    title,
    release_date: date,
    poster_path: null,
    backdrop_path: null,
    overview: "",
    vote_average: 7,
    vote_count: 100,
    runtime: 103,
    tagline: null,
    genres: [{ id: 1, name: "Comedy" }],
    ...extra,
  };
}

const dalmatians = details(11674, "101 Dalmatians", "1996-11-27", {
  runtime: 103,
  genres: [{ id: 1, name: "Comedy" }],
  credits: {
    cast: [
      {
        id: 1,
        name: "Glenn Close",
        character: "Cruella de Vil",
        profile_path: null,
      },
      { id: 2, name: "Jeff Daniels", character: "Roger", profile_path: null },
      {
        id: 3,
        name: "Joely Richardson",
        character: "Anita",
        profile_path: null,
      },
      { id: 4, name: "Joan Plowright", character: "Nanny", profile_path: null },
      { id: 5, name: "Hugh Laurie", character: "Jasper", profile_path: null },
      { id: 6, name: "Mark Williams", character: "Horace", profile_path: null },
    ],
    crew: [{ id: 9, name: "Stephen Herek", job: "Director" }],
  },
});

function said(content: string) {
  return { role: "assistant", content };
}
function asked(content: string) {
  return { role: "user", content };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMovie.mockResolvedValue(dalmatians);
});

describe("movieIdsInChat", () => {
  it("finds the films our own link enricher already resolved", () => {
    const ids = movieIdsInChat([
      asked("what next?"),
      said("Try [Heat (1995)](/movie/949) or [Arrival (2016)](/movie/329865)."),
    ]);

    expect(ids).toEqual([949, 329865]);
  });

  it("ignores ids the person typed themselves", () => {
    // Only our own output is trusted, so the ids always came from TMDB.
    expect(movieIdsInChat([asked("what about /movie/1 then")])).toEqual([]);
  });

  it("puts the page they're looking at first", () => {
    const ids = movieIdsInChat([said("[Heat (1995)](/movie/949)")], 11674);

    expect(ids[0]).toBe(11674);
    expect(ids).toContain(949);
  });

  it("prefers the newest mentions and never repeats a film", () => {
    const ids = movieIdsInChat([
      said("[A](/movie/1)"),
      said("[B](/movie/2)"),
      said("[C](/movie/3)"),
      said("[D](/movie/4) and [B again](/movie/2)"),
    ]);

    // Three at most, newest first, each one only once.
    expect(ids).toEqual([4, 2, 3]);
  });

  it("has nothing to say about a conversation with no films in it", () => {
    expect(
      movieIdsInChat([asked("hello"), said("Hi! Ask me anything.")]),
    ).toEqual([]);
  });
});

describe("filmFactLine", () => {
  it("names the cast with the parts they play", () => {
    const line = filmFactLine(dalmatians);

    // The exact fact the model denied, in the exact shape people ask about.
    expect(line).toContain("Hugh Laurie as Jasper");
    expect(line).toContain("101 Dalmatians (1996)");
    expect(line).toContain("directed by Stephen Herek");
    expect(line).toContain("103 min");
    // One line, and short enough that three of them cost almost nothing.
    expect(line).not.toContain("\n");
    expect(line.length).toBeLessThan(400);
  });

  it("copes with a film TMDB knows almost nothing about", () => {
    const bare = details(7, "Untitled", "");

    expect(() => filmFactLine(bare)).not.toThrow();
    expect(filmFactLine(bare)).toContain("Untitled");
  });
});

describe("buildChatContext", () => {
  it("says nothing when no film is in play, and asks TMDB nothing", async () => {
    expect(await buildChatContext({ messages: [asked("hi")] })).toBe("");
    expect(fetchMovie).not.toHaveBeenCalled();
  });

  it("hands over the facts for the film page the chat was opened from", async () => {
    const context = await buildChatContext({
      messages: [asked("is doctor house in this?")],
      pageMovieId: 11674,
    });

    expect(fetchMovie).toHaveBeenCalledWith(11674);
    expect(context).toContain("Hugh Laurie as Jasper");
    expect(context).toContain("looking at right now");
  });

  it("describes films already mentioned earlier in the chat", async () => {
    const context = await buildChatContext({
      messages: [
        asked("what next?"),
        said("Try [101 Dalmatians (1996)](/movie/11674)."),
      ],
    });

    expect(context).toContain("already come up in this conversation");
    expect(context).toContain("101 Dalmatians (1996)");
  });

  it("carries on quietly when TMDB doesn't answer", async () => {
    // A dead lookup must never take the whole chat down with it.
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMovie.mockRejectedValue(new Error("TMDB request failed (503)"));

    expect(await buildChatContext({ messages: [], pageMovieId: 11674 })).toBe(
      "",
    );
  });

  it("carries on quietly when TMDB has never heard of the film", async () => {
    fetchMovie.mockResolvedValue(null);

    expect(await buildChatContext({ messages: [], pageMovieId: 99 })).toBe("");
  });
});
