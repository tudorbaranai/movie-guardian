// Tests for the "Something went wrong" page (app/error.tsx).
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPage from "@/app/error";

describe("Error page", () => {
  it("'Try again' calls retry, which reloads the page's data", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorPage error={new Error("TMDB is down")} retry={retry} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
