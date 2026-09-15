// Tests for the My Movies page (app/my-movies/page.tsx). Supabase is mocked.
import { createElement, type AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The database query ends with `.order(...)`; tests decide what it answers.
const order = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({ select: () => ({ order }) })),
  },
}));
// A plain <a> stands in for Next's link component.
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", props),
}));

import { supabase } from "@/lib/supabase";
import MyMoviesPage from "@/app/my-movies/page";

const auth = vi.mocked(supabase.auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyMoviesPage", () => {
  it("asks signed-out visitors to sign in, without querying the database", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    render(<MyMoviesPage />);

    expect(await screen.findByText(/Sign in to see the films/)).toBeTruthy();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("shows an error with 'Try again' when the movies can't load, then retries", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);
    order
      .mockResolvedValueOnce({ data: null, error: { message: "network" } })
      .mockResolvedValueOnce({ data: [], error: null });
    const user = userEvent.setup();

    render(<MyMoviesPage />);

    // First attempt fails: a real error, not "you haven't marked anything".
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /couldn't load your movies/,
    );
    expect(screen.queryByText(/haven't marked anything/)).toBeNull();

    // Second attempt works.
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText(/haven't marked anything as seen yet/),
    ).toBeTruthy();
    expect(order).toHaveBeenCalledTimes(2);
  });
});
