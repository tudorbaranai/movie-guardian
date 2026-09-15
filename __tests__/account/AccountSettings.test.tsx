// Tests for the Account page's signed-in check (app/account/AccountSettings.tsx).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

import { supabase } from "@/lib/supabase";
import AccountSettings from "@/app/account/AccountSettings";

const auth = vi.mocked(supabase.auth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccountSettings", () => {
  it("sends signed-out visitors to the login page, showing nothing", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    render(<AccountSettings />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("shows who you are and the Change password form", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "reader@example.com",
          user_metadata: { nickname: "Reader" },
        },
      },
      error: null,
    } as never);

    render(<AccountSettings />);

    expect(
      await screen.findByRole("heading", { name: "Change password" }),
    ).toBeTruthy();
    expect(screen.getByText("reader@example.com")).toBeTruthy();
    expect(screen.getByText("Reader")).toBeTruthy();
    expect(screen.getByLabelText("Current password")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
