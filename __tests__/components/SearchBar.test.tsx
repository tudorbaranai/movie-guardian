// Tests for the search box with live suggestions (components/SearchBar.tsx).
// Our /api/search endpoint is replaced with a fake `fetch`.
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// A plain <img> stands in for Next's image component.
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement("img", props),
}));

import SearchBar from "@/components/SearchBar";

const fetchMock = vi.fn();
const MATRIX = { id: 603, title: "The Matrix", year: "1999", poster: null };

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const searchBox = () =>
  screen.getByRole("combobox", { name: "Search for a movie" });

describe("SearchBar", () => {
  it("a pre-filled box (search results page) doesn't open its list by itself", async () => {
    fetchMock.mockResolvedValue(Response.json({ results: [MATRIX] }));
    const user = userEvent.setup();
    render(<SearchBar defaultValue="matrix" />);

    // Let the background search finish…
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // …the list must still be closed.
    expect(screen.queryByRole("listbox")).toBeNull();

    // Clicking into the box shows the suggestions straight away.
    await user.click(searchBox());
    expect(screen.getByRole("option", { name: /The Matrix/ })).toBeTruthy();
  });

  it("typing shows suggestions, and Enter opens the highlighted film", async () => {
    fetchMock.mockResolvedValue(Response.json({ results: [MATRIX] }));
    const user = userEvent.setup();
    render(<SearchBar />);

    await user.type(searchBox(), "matrix");
    expect(
      await screen.findByRole("option", { name: /The Matrix/ }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/search?q=matrix",
      expect.anything(),
    );

    await user.keyboard("{ArrowDown}{Enter}");
    expect(router.push).toHaveBeenCalledWith("/movie/603");
  });

  it("says search is unavailable when the server fails, not 'No matches'", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ results: [], error: "down" }, { status: 502 }),
    );
    const user = userEvent.setup();
    render(<SearchBar />);

    await user.type(searchBox(), "matrix");

    expect(
      await screen.findByText(/Search isn't available right now/),
    ).toBeTruthy();
    expect(screen.queryByText("No matches")).toBeNull();
  });
});
