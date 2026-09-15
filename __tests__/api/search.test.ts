// @vitest-environment node
// Tests for our search endpoint (app/api/search/route.ts). TMDB's search is
// replaced with a fake; the small helpers (posterUrl, yearOf) stay real.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  searchMovies: vi.fn(),
}));

import { searchMovies, type Movie } from "@/lib/tmdb";
import { GET } from "@/app/api/search/route";

const search = vi.mocked(searchMovies);

function callSearch(query: string) {
  return GET(
    new Request(`http://localhost/api/search?q=${encodeURIComponent(query)}`),
  );
}

function fakeMovie(n: number, overrides: Partial<Movie> = {}): Movie {
  return {
    id: n,
    title: `Movie ${n}`,
    release_date: "2020-05-01",
    poster_path: `/poster-${n}.jpg`,
    backdrop_path: null,
    overview: "",
    vote_average: 7,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("doesn't search until there are at least 2 letters", async () => {
    const response = await callSearch(" a ");

    expect(await response.json()).toEqual({ results: [] });
    expect(search).not.toHaveBeenCalled();
  });

  it("returns at most 7 suggestions with only the fields the box needs", async () => {
    search.mockResolvedValue([
      fakeMovie(1),
      fakeMovie(2, { poster_path: null, release_date: "" }),
      ...[3, 4, 5, 6, 7, 8, 9, 10].map((n) => fakeMovie(n)),
    ]);

    const response = await callSearch("movie");
    const { results } = await response.json();

    expect(search).toHaveBeenCalledWith("movie");
    expect(response.status).toBe(200);
    expect(results).toHaveLength(7);
    expect(results[0]).toEqual({
      id: 1,
      title: "Movie 1",
      year: "2020",
      poster: "https://image.tmdb.org/t/p/w185/poster-1.jpg",
    });
    expect(results[1]).toMatchObject({ poster: null, year: null });
  });

  it("answers 502 with an error when TMDB fails, instead of 'no results'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    search.mockRejectedValue(new Error("TMDB request failed (503)"));

    const response = await callSearch("matrix");

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      results: [],
      error: expect.any(String),
    });
  });
});
