// Tests for the poster card every grid on the site uses
// (components/MovieCard.tsx).
//
// The bit worth protecting is the marker: a green stroke for films you've seen,
// gold for ones on your watchlist. Colour alone says nothing to someone using a
// screen reader, so the card also writes the word out — and that's what these
// tests read, rather than CSS class names, which would break on any restyle.
import { createElement, type AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", props),
}));
vi.mock("next/image", () => ({
  // `fill` and `sizes` are Next-only props; React warns about them on a plain
  // <img>, so strip them rather than let the noise into every test run.
  default: (props: Record<string, unknown>) => {
    const plain = { ...props };
    delete plain.fill;
    delete plain.sizes;
    return createElement("img", plain);
  },
}));

// The card asks the provider "have I marked this film?" — so that answer is
// what each test controls.
const marks: Record<number, "seen" | "watchlist"> = {};
vi.mock("@/components/UserMoviesProvider", () => ({
  useMovieMarks: () => ({ marks, refresh: vi.fn() }),
}));

import MovieCard from "@/components/MovieCard";

function renderCard(extra: Record<string, unknown> = {}) {
  return render(
    <MovieCard id={949} title="Heat" posterPath="/p.jpg" {...extra} />,
  );
}

describe("MovieCard", () => {
  it("links to the film's page and names the poster", () => {
    renderCard();

    expect(screen.getByRole("link").getAttribute("href")).toBe("/movie/949");
    expect(screen.getByAltText("Poster for Heat")).toBeTruthy();
  });

  it("says 'Seen' when you've watched it", () => {
    marks[949] = "seen";

    renderCard();

    expect(screen.getByText("Seen")).toBeTruthy();
    expect(screen.queryByText("On your watchlist")).toBeNull();
  });

  it("says 'On your watchlist' when you've saved it", () => {
    marks[949] = "watchlist";

    renderCard();

    expect(screen.getByText("On your watchlist")).toBeTruthy();
    expect(screen.queryByText("Seen")).toBeNull();
  });

  it("says neither when you haven't marked it", () => {
    delete marks[949];

    renderCard();

    expect(screen.queryByText("Seen")).toBeNull();
    expect(screen.queryByText("On your watchlist")).toBeNull();
  });

  it("shows TMDB's score, but not a meaningless zero", () => {
    delete marks[949];

    const { unmount } = renderCard({ score: 7.94 });
    expect(screen.getByText("7.9")).toBeTruthy();
    unmount();

    // TMDB sends 0 for films nobody has rated; a "0.0" chip would read as a
    // terrible film rather than an unknown one.
    renderCard({ score: 0 });
    expect(screen.queryByText("0.0")).toBeNull();
  });

  it("shows your own rating separately from TMDB's", () => {
    delete marks[949];

    renderCard({ score: 7.9, userRating: 9 });

    expect(screen.getByText("★ 9")).toBeTruthy();
  });
});
