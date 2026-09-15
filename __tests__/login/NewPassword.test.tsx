// Tests for "Choose a new password" (app/login/NewPassword.tsx).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}));

import { supabase } from "@/lib/supabase";
import NewPassword from "@/app/login/NewPassword";

const auth = vi.mocked(supabase.auth);
const EMAIL = "reader@example.com";
// Only ever sent to the mocked Supabase above.
const NEW_PASSWORD = "brand-new-password-1";

function renderScreen() {
  const onDone = vi.fn();
  render(<NewPassword email={EMAIL} onDone={onDone} />);
  return { onDone };
}

async function typePasswords(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation: string,
) {
  await user.type(screen.getByLabelText("New password"), password);
  await user.type(screen.getByLabelText("Confirm password"), confirmation);
  await user.click(screen.getByRole("button", { name: "Save password" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NewPassword", () => {
  it("shows which account the new password is for", () => {
    renderScreen();

    expect(screen.getByText(EMAIL)).toBeTruthy();
  });

  it("saves the new password and finishes", async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: {} },
      error: null,
    } as never);
    const user = userEvent.setup();
    const { onDone } = renderScreen();

    await typePasswords(user, NEW_PASSWORD, NEW_PASSWORD);

    expect(auth.updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("won't save when the two passwords differ", async () => {
    const user = userEvent.setup();
    const { onDone } = renderScreen();

    await typePasswords(user, NEW_PASSWORD, `${NEW_PASSWORD}x`);

    expect(screen.getByRole("alert").textContent).toMatch(
      /Passwords don't match/,
    );
    expect(document.activeElement).toBe(
      screen.getByLabelText("Confirm password"),
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("explains when the new password is the same as the old one", async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "same_password", message: "New password should differ" },
    } as never);
    const user = userEvent.setup();
    const { onDone } = renderScreen();

    await typePasswords(user, NEW_PASSWORD, NEW_PASSWORD);

    expect(screen.getByRole("alert").textContent).toMatch(
      /That's your current password/,
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows Supabase's reason when the password is too weak", async () => {
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: {
        code: "weak_password",
        message: "Password should contain at least one number.",
      },
    } as never);
    const user = userEvent.setup();
    renderScreen();

    await typePasswords(user, "abcdefg", "abcdefg");

    expect(screen.getByRole("alert").textContent).toBe(
      "Password should contain at least one number.",
    );
  });
});
