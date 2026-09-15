// Tests for the login page (app/login/page.tsx): signing in, creating an
// account, "Forgot password?", and how it moves between those screens.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// `vi.mock` runs before everything else in the file, so anything it uses must
// be created with `vi.hoisted`.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resend: vi.fn(),
      verifyOtp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import LoginPage from "@/app/login/page";
import { CODE_LENGTH } from "@/app/login/VerifyCode";

const auth = vi.mocked(supabase.auth);
const EMAIL = "reader@example.com";
// Only ever sent to the mocked Supabase above.
const PASSWORD = "test-password-123";

beforeEach(() => {
  vi.clearAllMocks();
  // Signed out, unless a test says otherwise.
  auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  } as never);
});

async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  fields: Record<string, string>,
) {
  for (const [label, value] of Object.entries(fields)) {
    await user.type(await screen.findByLabelText(label), value);
  }
}

describe("LoginPage", () => {
  it("sends visitors who are already signed in to the homepage", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    render(<LoginPage />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("signs in and goes to the homepage", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillIn(user, { Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
  });

  it("shows the code screen after creating an account", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [{ id: "identity-1" }] }, session: null },
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      await screen.findByRole("tab", { name: "Create account" }),
    );
    await fillIn(user, {
      Nickname: "  Reader  ",
      Email: EMAIL,
      Password: PASSWORD,
      "Confirm password": PASSWORD,
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(auth.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: { data: { nickname: "Reader" } },
    });
    expect(
      await screen.findByRole("heading", { name: "Enter your code" }),
    ).toBeTruthy();
    expect(screen.getByText(EMAIL)).toBeTruthy();
  });

  it("only asks to confirm the password when creating an account", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.queryByLabelText("Confirm password")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Create account" }));
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
  });

  it("won't create the account when the two passwords differ", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      await screen.findByRole("tab", { name: "Create account" }),
    );
    await fillIn(user, {
      Nickname: "Reader",
      Email: EMAIL,
      Password: PASSWORD,
      "Confirm password": `${PASSWORD}x`,
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText(/Passwords don't match/)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByLabelText("Confirm password"),
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("warns as soon as the confirmation stops matching, not before", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      await screen.findByRole("tab", { name: "Create account" }),
    );
    await fillIn(user, { Password: "abcdef" });
    const confirm = screen.getByLabelText("Confirm password");

    // A correct beginning isn't an error yet…
    await user.type(confirm, "abc");
    expect(screen.queryByText("Doesn't match the password above")).toBeNull();
    expect(confirm.getAttribute("aria-invalid")).toBe("false");

    // …but a wrong character is.
    await user.type(confirm, "x");
    expect(screen.getByText("Doesn't match the password above")).toBeTruthy();
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
  });

  it("points to Sign in when the email already has an account", async () => {
    // Supabase answers "already registered" with a user that has no identities.
    auth.signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(
      await screen.findByRole("tab", { name: "Create account" }),
    );
    await fillIn(user, {
      Nickname: "Reader",
      Email: EMAIL,
      Password: PASSWORD,
      "Confirm password": PASSWORD,
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText(/already an account with this email/),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Enter your code" }),
    ).toBeNull();
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

    expect(
      await screen.findByRole("heading", { name: "Enter your code" }),
    ).toBeTruthy();
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: EMAIL });
    expect(screen.getByRole("status").textContent).toMatch(
      /sent you a new code/,
    );
  });

  it("shows Supabase's message for other sign-in errors", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      },
    } as never);
    const user = userEvent.setup();
    render(<LoginPage />);

    await fillIn(user, { Email: EMAIL, Password: PASSWORD });
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  describe("Forgot password", () => {
    it("is offered on Sign in, not on Create account", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      expect(
        await screen.findByRole("button", { name: "Forgot password?" }),
      ).toBeTruthy();

      await user.click(screen.getByRole("tab", { name: "Create account" }));
      expect(
        screen.queryByRole("button", { name: "Forgot password?" }),
      ).toBeNull();
    });

    it("goes email → code → new password → homepage", async () => {
      auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null,
      } as never);
      auth.verifyOtp.mockResolvedValue({ data: {}, error: null } as never);
      auth.updateUser.mockResolvedValue({
        data: { user: {} },
        error: null,
      } as never);
      const user = userEvent.setup();
      render(<LoginPage />);

      // 1. Start from Sign in, with the email already typed.
      await fillIn(user, { Email: EMAIL });
      await user.click(
        screen.getByRole("button", { name: "Forgot password?" }),
      );
      expect(
        screen.getByRole("heading", { name: "Reset your password" }),
      ).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Send code" }));
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL);

      // 2. The code screen, with a message that doesn't reveal whether the
      //    account exists.
      expect(
        await screen.findByRole("heading", { name: "Enter your code" }),
      ).toBeTruthy();
      expect(screen.getByRole("status").textContent).toMatch(
        /If there's an account for this email/,
      );
      await user.paste("7".repeat(CODE_LENGTH));
      expect(auth.verifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: EMAIL, type: "recovery" }),
      );

      // 3. Choose the new password.
      expect(
        await screen.findByRole("heading", { name: "Choose a new password" }),
      ).toBeTruthy();
      await user.type(screen.getByLabelText("New password"), PASSWORD);
      await user.type(screen.getByLabelText("Confirm password"), PASSWORD);
      await user.click(screen.getByRole("button", { name: "Save password" }));

      // 4. Done: signed in, off to the homepage.
      expect(auth.updateUser).toHaveBeenCalledWith({ password: PASSWORD });
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    });

    it("'Back to sign in' returns to the form", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.click(
        await screen.findByRole("button", { name: "Forgot password?" }),
      );
      await user.click(screen.getByRole("button", { name: "Back to sign in" }));

      expect(
        screen.getByRole("heading", { name: "Welcome back" }),
      ).toBeTruthy();
    });
  });
});
