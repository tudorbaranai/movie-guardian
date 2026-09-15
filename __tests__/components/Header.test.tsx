// Tests for the site header's account menu (components/Header.tsx).
import {
  createElement,
  type AnchorHTMLAttributes,
  type ImgHTMLAttributes,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// Plain elements stand in for Next's link and image components.
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", props),
}));
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement("img", props),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

const auth = vi.mocked(supabase.auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Header", () => {
  it("signed out: offers Sign in, no account menu", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    render(<Header />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });

  it("signed in: the account menu links to My Movies and Account", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          email: "reader@example.com",
          user_metadata: { nickname: "Reader" },
        },
      },
      error: null,
    } as never);
    const user = userEvent.setup();

    render(<Header />);
    await user.click(await screen.findByRole("button", { name: /Reader/ }));

    const menu = screen.getByRole("menu");
    const items = [...menu.querySelectorAll('[role="menuitem"]')].map(
      (item) => item.textContent,
    );
    expect(items).toEqual(["My Movies", "Account", "Sign out"]);
    expect(
      screen.getByRole("menuitem", { name: "Account" }).getAttribute("href"),
    ).toBe("/account");
  });
});
