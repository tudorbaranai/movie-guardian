// @vitest-environment node
// Tests for the TMDB helpers (lib/tmdb.ts). They run on the server, so this
// file uses Node instead of the pretend browser. `fetch` is replaced with a
// fake, so no real request ever reaches TMDB.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMovie } from "@/lib/tmdb";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getMovie", () => {
  it.each([
    "abc",
    "../genre/movie/list",
    "..%2Fgenre%2Fmovie%2Flist",
    "603?language=fr",
    "-1",
    "1.5",
    "",
  ])("refuses the id %j without calling TMDB", async (id) => {
    expect(await getMovie(id)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks TMDB for a numeric id, using our token", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ id: 603, title: "The Matrix" }),
    );

    const movie = await getMovie("603");

    expect(movie?.title).toBe("The Matrix");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.themoviedb.org/3/movie/603?append_to_response=credits,videos,recommendations&language=en-US",
    );
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("returns null when TMDB doesn't know the movie", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));

    expect(await getMovie(999999999)).toBeNull();
  });
});
