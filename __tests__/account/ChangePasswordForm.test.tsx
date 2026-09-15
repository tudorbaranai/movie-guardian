// Tests for "Change password" (app/account/ChangePasswordForm.tsx).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import ChangePasswordForm from "@/app/account/ChangePasswordForm";

const auth = vi.mocked(supabase.auth);
const EMAIL = "reader@example.com";
// Only ever sent to the mocked Supabase above.
const CURRENT = "old-password-1";
const NEW = "new-password-2";

type User = ReturnType<typeof userEvent.setup>;

async function fillForm(
  user: User,
  { current = CURRENT, next = NEW, confirm = NEW, signOutOthers = false } = {},
) {
  await user.type(screen.getByLabelText("Current password"), current);
  await user.type(screen.getByLabelText("New password"), next);
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  if (signOutOthers) {
    await user.click(
      screen.getByRole("checkbox", {
        name: "Also sign me out on other devices",
      }),
    );
  }
  await user.click(screen.getByRole("button", { name: "Save new password" }));
}

function passwordIsCorrect() {
  auth.signInWithPassword.mockResolvedValue({
    data: {},
    error: null,
  } as never);
}

function saveSucceeds() {
  auth.updateUser.mockResolvedValue({
    data: { user: {} },
    error: null,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ChangePasswordForm", () => {
  it("checks the current password, then saves the new one", async () => {
    passwordIsCorrect();
    saveSucceeds();
    const user = userEvent.setup();
    render(<ChangePasswordForm email={EMAIL} />);

    await fillForm(user);

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: CURRENT,
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: NEW });
    expect(screen.getByRole("status").textContent).toBe("Password changed.");
    expect(auth.signOut).not.toHaveBeenCalled();
    // The boxes are emptied afterwards.
    expect(
      (screen.getByLabelText("Current password") as HTMLInputElement).value,
    ).toBe("");
  });

  it("refuses to save when the current password is wrong", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: "invalid_credentials", message: "Invalid login" },
    } as never);
    const user = userEvent.setup();
    render(<ChangePasswordForm email={EMAIL} />);

    await fillForm(user);

    expect(screen.getByRole("alert").textContent).toBe(
      "Your current password isn't right.",
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("won't do anything when the new passwords don't match", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm email={EMAIL} />);

    await fillForm(user, { confirm: `${NEW}x` });

    expect(screen.getByRole("alert").textContent).toMatch(
      /Passwords don't match/,
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText("Confirm password"),
    );
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("won't reuse the current password as the new one", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm email={EMAIL} />);

    await fillForm(user, { next: CURRENT, confirm: CURRENT });

    expect(screen.getByRole("alert").textContent).toMatch(/must be different/);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows Supabase's reason when the new password is too weak", async () => {
    passwordIsCorrect();
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: {
        code: "weak_password",
        message: "Password should contain at least one number.",
      },
    } as never);
    const user = userEvent.setup();
    render(<ChangePasswordForm email={EMAIL} />);

    await fillForm(user, { next: "abcdefg", confirm: "abcdefg" });

    expect(screen.getByRole("alert").textContent).toBe(
      "Password should contain at least one number.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("can also sign out every other device", async () => {
    passwordIsCorrect();
    saveSucceeds();
    auth.signOut.mockResolvedValue({ error: null } as never);
    const user = userEvent.setup();
    render(<ChangePasswordForm email={EMAIL} />);

    await fillForm(user, { signOutOthers: true });

    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(screen.getByRole("status").textContent).toMatch(
      /other devices have been signed out/,
    );
  });
});
