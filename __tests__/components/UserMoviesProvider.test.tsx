// Tests for the thing every poster on the site depends on
// (components/UserMoviesProvider.tsx).
//
// It asks Supabase ONCE — "which films have I marked?" — and shares the answer
// with every MovieCard through React context. That's why a grid of 24 posters
// costs one database query instead of 24.
//
// The interesting parts aren't the happy path, they're the three things that
// actually break in React: an answer that arrives after you've navigated away,
// a subscription that never gets cleaned up, and stale data after signing out.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn(), onAuthStateChange: vi.fn() },
    from: vi.fn(),
  },
}));

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import UserMoviesProvider, {
  useMovieMarks,
} from "@/components/UserMoviesProvider";

const auth = vi.mocked(supabase.auth);
const from = vi.mocked(supabase.from);

const unsubscribe = vi.fn();
/** Lets a test pretend someone signed in or out after the first load. */
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
let fireAuthChange: AuthListener | null = null;

/** A tiny component that just prints what the provider is offering. */
function ShowMarks() {
  const { marks } = useMovieMarks();
  const listed = Object.entries(marks)
    .map(([id, status]) => `${id}:${status}`)
    .sort()
    .join(" ");
  return <p data-testid="marks">{listed || "nothing"}</p>;
}

function renderProvider() {
  return render(
    <UserMoviesProvider>
      <ShowMarks />
    </UserMoviesProvider>,
  );
}

/** Pretend Supabase returns these rows from `user_movies`. */
function givenRows(rows: { movie_id: number; status: string }[]) {
  from.mockReturnValue({
    select: vi.fn(async () => ({ data: rows, error: null })),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.onAuthStateChange.mockImplementation((callback: AuthListener) => {
    fireAuthChange = callback;
    return { data: { subscription: { unsubscribe } } } as never;
  });
});

describe("UserMoviesProvider", () => {
  it("signed out: marks nothing, and doesn't even ask the database", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } } as never);
    givenRows([]);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("marks").textContent).toBe("nothing"),
    );
    // Asking would be wasted work — Row-Level Security would return nothing.
    expect(from).not.toHaveBeenCalled();
  });

  it("signed in: shares your marks, keyed by film", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } } as never);
    givenRows([
      { movie_id: 949, status: "seen" },
      { movie_id: 438631, status: "watchlist" },
    ]);

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("marks").textContent).toBe(
        "438631:watchlist 949:seen",
      ),
    );
    expect(from).toHaveBeenCalledWith("user_movies");
    // Once for the whole page, however many posters are on it.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("reloads when you sign in, so the marks match the account that's active", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } } as never);
    givenRows([]);

    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId("marks").textContent).toBe("nothing"),
    );

    // Now someone signs in, and their films should appear without a reload.
    auth.getUser.mockResolvedValue({ data: { user: { id: "u2" } } } as never);
    givenRows([{ movie_id: 949, status: "seen" }]);
    fireAuthChange?.("SIGNED_IN", null);

    await waitFor(() =>
      expect(screen.getByTestId("marks").textContent).toBe("949:seen"),
    );
  });

  it("lets go of its Supabase subscription when it disappears", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } } as never);
    givenRows([]);

    const { unmount } = renderProvider();
    await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalled());

    unmount();

    // Without this, every page change leaves another listener behind.
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("ignores an answer that arrives after it's gone", async () => {
    // A slow database reply landing after you navigate away used to be a
    // "setState on an unmounted component" warning; the `active` flag in the
    // effect is what prevents it.
    let answer: (value: { data: { user: { id: string } } }) => void = () => {};
    auth.getUser.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve as never;
      }) as never,
    );
    givenRows([{ movie_id: 949, status: "seen" }]);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderProvider();
    unmount();

    // The reply turns up now, long after the component went away.
    answer({ data: { user: { id: "u1" } } });
    await waitFor(() => expect(errors).not.toHaveBeenCalled());
  });
});
