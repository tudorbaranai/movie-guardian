// Tests for the login page (app/login/page.tsx): signing in, creating an
// account, and when it hands over to the code screen.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// `vi.mock` runs before everything else in the file, so anything it uses must
// be created with `vi.hoisted`.
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import LoginPage from "@/app/login/page";

const auth = vi.mocked(supabase.auth);
const EMAIL = "reader@example.com";
// Only ever sent to the mocked Supabase above.
const PASSWORD = "test-password-123";

beforeEach(() => {
  vi.clearAllMocks();
  // Signed out, unless a test says otherwise.
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never);
});

async function fillIn(user: ReturnType<typeof userEvent.setup>, fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    await user.type(await screen.findByLabelText(label), value);
  }
}

describe("LoginPage", () => {
  it("sends visitors who are already signed in to the homepage", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null } as never);

    render(<LoginPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("signs in and goes to the homepage", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillIn(user, { Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
  });

  it("shows the code screen after creating an account", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [{ id: "identity-1" }] }, session: null },
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(await screen.findByRole("tab", { name: "Create account" }));
    await fillIn(user, { Nickname: "  Reader  ", Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(auth.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: { data: { nickname: "Reader" } },
    });
    expect(await screen.findByRole("heading", { name: "Enter your code" })).toBeTruthy();
    expect(screen.getByText(EMAIL)).toBeTruthy();
  });

  it("points to Sign in when the email already has an account", async () => {
    // Supabase answers "already registered" with a user that has no identities.
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(await screen.findByRole("tab", { name: "Create account" }));
    await fillIn(user, { Nickname: "Reader", Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/already an account with this email/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Enter your code" })).toBeNull();
  });

  it("sends a new code when an unconfirmed account tries to sign in", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    } as never);
    auth.resend.mockResolvedValue({ data: {}, error: null } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillIn(user, { Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Enter your code" })).toBeTruthy();
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: EMAIL });
    expect(screen.getByRole("status").textContent).toMatch(/sent you a new code/);
  });

  it("shows Supabase's message for other sign-in errors", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillIn(user, { Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
