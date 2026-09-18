// @vitest-environment node
// Tests for the "dossier" we staple to the front of every AI conversation
// (lib/watch-history.ts). Pure text in, pure text out — nothing to mock.
import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildWatchHistory,
  type WatchedMovie,
} from "@/lib/watch-history";

function seen(title: string, rating: number | null = null): WatchedMovie {
  return { title, status: "seen", rating };
}

function watchlist(title: string): WatchedMovie {
  return { title, status: "watchlist", rating: null };
}

describe("buildWatchHistory", () => {
  it("says nothing at all when nothing is tracked", () => {
    expect(buildWatchHistory([])).toBe("");
  });

  it("separates loved, hated, unrated and watchlist films", () => {
    const context = buildWatchHistory([
      seen("Arrival", 9),
      seen("Cats", 2),
      seen("Heat"),
      watchlist("Dune"),
    ]);

    expect(context).toContain("Loved");
    expect(context).toContain("Arrival 9/10");
    expect(context).toContain("Rated lowest");
    expect(context).toContain("Cats 2/10");
    expect(context).toContain("Also already watched");
    expect(context).toContain("Heat");
    expect(context).toContain("watchlist");
    expect(context).toContain("Dune");
    expect(context).toContain("3 films marked as seen");
  });

  it("caps a huge history, keeping both ends and never repeating a film", () => {
    // 1000 rated films, scores 1..10 repeating.
    const rows = Array.from({ length: 1000 }, (_, index) =>
      seen(`Film ${index}`, (index % 10) + 1),
    );

    const context = buildWatchHistory(rows);
    const mentioned = context.match(/Film \d+/g) ?? [];

    // 30 loved + 10 middling + 15 disliked, and no film named twice.
    expect(mentioned).toHaveLength(55);
    expect(new Set(mentioned).size).toBe(mentioned.length);
    // Both ends of the scale survived the cut.
    expect(context).toContain("10/10");
    expect(context).toContain("1/10");
    // The whole dossier still fits comfortably in a prompt.
    expect(context.length).toBeLessThan(3000);
  });

  it("keeps a rating of 0 rather than treating it as 'no score'", () => {
    const context = buildWatchHistory([seen("The Room", 0)]);

    expect(context).toContain("The Room 0/10");
    expect(context).not.toContain("no score given");
  });
});

describe("buildSystemPrompt", () => {
  it("carries the dossier and the house rules", () => {
    const prompt = buildSystemPrompt(buildWatchHistory([seen("Arrival", 9)]));

    expect(prompt).toContain("Movie Guardian");
    expect(prompt).toContain("Arrival 9/10");
    // It shows the model the exact format the server can turn into a link.
    expect(prompt).toContain("**Arrival (2016)**");
  });

  it("tells the model to ask when it knows nothing yet", () => {
    expect(buildSystemPrompt("")).toContain("has not tracked any films yet");
  });

  it("tells it to look films up only when it actually can", () => {
    const withTools = buildSystemPrompt("", true);
    expect(withTools).toContain("search_movies");
    expect(withTools).not.toContain("no way to look anything up");

    // The default. Promising it tools it doesn't have is how you get a model
    // inventing release years with total confidence.
    const without = buildSystemPrompt("");
    expect(without).not.toContain("search_movies");
    expect(without).toContain("no way to look anything up");
  });
});
