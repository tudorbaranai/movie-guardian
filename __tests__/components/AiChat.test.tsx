// Tests for the ✨ chat panel in the nav bar (components/AiChat.tsx).
// Supabase and `fetch` are faked, so no network call and no AI spend.
import { createElement, type AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", props),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "token-123" } },
      })),
    },
  },
}));

import AiChat from "@/components/AiChat";

/** A fetch whose body arrives in pieces, like the real streaming answer. */
function streamingFetch(pieces: string[]) {
  const encoder = new TextEncoder();
  return vi.fn(async () => ({
    ok: true,
    body: {
      getReader() {
        let index = 0;
        return {
          async read() {
            if (index >= pieces.length) return { value: undefined, done: true };
            return { value: encoder.encode(pieces[index++]), done: false };
          },
        };
      },
    },
  })) as unknown as typeof fetch;
}

function failingFetch(status: number, message: string) {
  return vi.fn(async () => ({
    ok: false,
    status,
    body: null,
    json: async () => ({ error: message }),
  })) as unknown as typeof fetch;
}

function openPanel() {
  return userEvent.setup().click(screen.getByRole("button", { name: /AI/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AiChat", () => {
  it("is closed until you click the sticker", async () => {
    render(<AiChat signedIn />);

    expect(screen.queryByRole("dialog")).toBeNull();
    await openPanel();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("signed out: offers a sign-in link instead of the chat box", async () => {
    render(<AiChat signedIn={false} />);
    await openPanel();

    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sends the question and types the answer out as it streams in", async () => {
    vi.stubGlobal("fetch", streamingFetch(["Try ", "**Heat (1995)**."]));
    const user = userEvent.setup();

    render(<AiChat signedIn />);
    await openPanel();
    await user.type(screen.getByRole("textbox"), "what next?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("what next?")).toBeTruthy();
    // The title the model wrote in **bold** becomes a real <strong>.
    const title = await screen.findByText("Heat (1995)");
    expect(title.tagName).toBe("STRONG");

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe("/api/chat");
    const request = call[1] as RequestInit & {
      headers: Record<string, string>;
    };
    expect(request.headers.Authorization).toBe("Bearer token-123");
    expect(JSON.parse(String(request.body))).toEqual({
      messages: [{ role: "user", content: "what next?" }],
    });
  });

  it("turns a film the model linked into a link to our own movie page", async () => {
    vi.stubGlobal(
      "fetch",
      streamingFetch(["Try [Heat ", "(1995)](/movie/949) tonight."]),
    );
    const user = userEvent.setup();

    render(<AiChat signedIn />);
    await openPanel();
    await user.type(screen.getByRole("textbox"), "what next?");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const link = await screen.findByRole("link", { name: "Heat (1995)" });
    expect(link.getAttribute("href")).toBe("/movie/949");

    // Clicking it navigates, so the panel gets out of the way.
    await user.click(link);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("refuses to render a link to anywhere except our own movie pages", async () => {
    // Whatever the model is told, this is what actually stops a chat bubble
    // handing someone a link to somewhere else.
    vi.stubGlobal(
      "fetch",
      streamingFetch([
        "See [this](https://evil.example/pwned) and [that](/account).",
      ]),
    );
    const user = userEvent.setup();

    render(<AiChat signedIn />);
    await openPanel();
    await user.type(screen.getByRole("textbox"), "hi");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText(/evil\.example/, { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "this" })).toBeNull();
    expect(screen.queryByRole("link", { name: "that" })).toBeNull();
  });

  it("a suggested question sends itself", async () => {
    vi.stubGlobal("fetch", streamingFetch(["Sure."]));
    const user = userEvent.setup();

    render(<AiChat signedIn />);
    await openPanel();
    await user.click(
      screen.getByRole("button", { name: "What should I watch tonight?" }),
    );

    expect(await screen.findByText("Sure.")).toBeTruthy();
  });

  it("shows the server's own message when the call is refused", async () => {
    vi.stubGlobal("fetch", failingFetch(429, "That's a lot of questions!"));
    const user = userEvent.setup();

    render(<AiChat signedIn />);
    await openPanel();
    await user.type(screen.getByRole("textbox"), "again");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("That's a lot of questions!");
    // The empty answer bubble is cleaned up, so nothing looks half-written.
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});
