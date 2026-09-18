// @vitest-environment node
// Tests for the two TMDB lookups the assistant can call (lib/movie-tools.ts).
//
// The point of these is mostly the TRIMMING: TMDB's real answers are enormous
// and every field we pass on is paid for again on every later message, so the
// tests assert what comes out, not just that it works.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  searchMovies: vi.fn(),
  getMovie: vi.fn(),
}));

import { getMovie, searchMovies } from "@/lib/tmdb";
import { MOVIE_TOOLS, runMovieTool } from "@/lib/movie-tools";

const search = vi.mocked(searchMovies);
const details = vi.mocked(getMovie);

function fakeSearchHit(n: number) {
  return {
    id: n,
    title: `Movie ${n}`,
    release_date: "1995-12-15",
    poster_path: `/p${n}.jpg`,
    backdrop_path: `/b${n}.jpg`,
    overview: "Some plot.",
    vote_average: 7.334999,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the tool menu", () => {
  it("offers exactly search_movies and get_movie", () => {
    expect(MOVIE_TOOLS.map((tool) => tool.function.name)).toEqual([
      "search_movies",
      "get_movie",
    ]);
  });

  it("stays small — the menu is re-sent on every single message", () => {
    expect(JSON.stringify(MOVIE_TOOLS).length).toBeLessThan(1000);
  });
});

describe("search_movies", () => {
  it("returns at most 5 hits, with only 4 fields each", async () => {
    search.mockResolvedValue([1, 2, 3, 4, 5, 6, 7].map(fakeSearchHit));

    const result = await runMovieTool("search_movies", '{"query":"heat"}');

    expect(search).toHaveBeenCalledWith("heat");
    expect(result).toEqual({
      results: [1, 2, 3, 4, 5].map((n) => ({
        id: n,
        title: `Movie ${n}`,
        year: "1995",
        score: 7.3, // rounded — TMDB's extra decimals are noise
      })),
    });
  });

  it("refuses an empty query instead of searching for nothing", async () => {
    const result = await runMovieTool("search_movies", '{"query":"  "}');

    expect(result).toMatchObject({ error: expect.any(String) });
    expect(search).not.toHaveBeenCalled();
  });
});

describe("get_movie", () => {
  const heat = {
    id: 949,
    title: "Heat",
    release_date: "1995-12-15",
    poster_path: "/p.jpg",
    backdrop_path: "/b.jpg",
    overview: "A".repeat(500),
    vote_average: 7.9,
    runtime: 170,
    tagline: "A Los Angeles crime saga",
    vote_count: 9000,
    genres: [
      { id: 28, name: "Action" },
      { id: 80, name: "Crime" },
    ],
    credits: {
      cast: [1, 2, 3, 4, 5, 6].map((n) => ({
        id: n,
        name: `Actor ${n}`,
        character: "",
        profile_path: null,
      })),
      crew: [
        { id: 10, name: "Somebody Else", job: "Editor" },
        { id: 11, name: "Michael Mann", job: "Director" },
      ],
    },
    // The fields below are the reason this trimming exists: TMDB sends them,
    // we must not pass them on.
    videos: {
      results: [
        {
          key: "x",
          name: "T",
          site: "YouTube",
          type: "Trailer",
          official: true,
        },
      ],
    },
    recommendations: { results: [1, 2, 3].map(fakeSearchHit) },
  };

  it("returns 9 small fields and drops everything else TMDB sent", async () => {
    details.mockResolvedValue(heat as never);

    const result = await runMovieTool("get_movie", '{"id":949}');

    expect(result).toEqual({
      id: 949,
      title: "Heat",
      year: "1995",
      genres: ["Action", "Crime"],
      runtime: 170,
      director: "Michael Mann",
      cast: ["Actor 1", "Actor 2", "Actor 3"],
      score: 7.9,
      overview: `${"A".repeat(200)}…`,
    });

    // The expensive parts of TMDB's reply never reach the model.
    const sent = JSON.stringify(result);
    expect(sent).not.toContain("recommendations");
    expect(sent).not.toContain("YouTube");
    expect(sent.length).toBeLessThan(500);
  });

  it("accepts an id the model sent as a string", async () => {
    details.mockResolvedValue(heat as never);

    expect(await runMovieTool("get_movie", '{"id":"949"}')).toMatchObject({
      id: 949,
    });
  });

  it("says so when the film doesn't exist", async () => {
    details.mockResolvedValue(null);

    expect(await runMovieTool("get_movie", '{"id":1}')).toEqual({
      error: "No film with id 1",
    });
  });

  it("refuses a nonsense id without calling TMDB", async () => {
    expect(await runMovieTool("get_movie", '{"id":"Heat"}')).toMatchObject({
      error: expect.any(String),
    });
    expect(details).not.toHaveBeenCalled();
  });
});

describe("when things go wrong", () => {
  it("turns a TMDB outage into an error the model can read, not a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    search.mockRejectedValue(new Error("TMDB request failed (503)"));

    expect(
      await runMovieTool("search_movies", '{"query":"heat"}'),
    ).toMatchObject({ error: expect.stringContaining("TMDB") });
  });

  it("survives arguments that aren't valid JSON", async () => {
    expect(await runMovieTool("get_movie", "{oops")).toMatchObject({
      error: expect.any(String),
    });
  });

  it("refuses a tool it doesn't have", async () => {
    expect(await runMovieTool("delete_everything", "{}")).toEqual({
      error: "There is no tool called delete_everything",
    });
  });
});
