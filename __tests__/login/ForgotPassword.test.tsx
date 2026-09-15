// Tests for "Reset your password" (app/login/ForgotPassword.tsx).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn() } },
}));

import { supabase } from "@/lib/supabase";
import ForgotPassword from "@/app/login/ForgotPassword";

const auth = vi.mocked(supabase.auth);
const EMAIL = "reader@example.com";

function renderScreen(initialEmail = "") {
  const onCodeSent = vi.fn();
  const onBack = vi.fn();
  render(
    <ForgotPassword
      initialEmail={initialEmail}
      onCodeSent={onCodeSent}
      onBack={onBack}
    />,
  );
  return { onCodeSent, onBack };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForgotPassword", () => {
  it("keeps the email already typed on the sign-in form", () => {
    renderScreen(EMAIL);

    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      EMAIL,
    );
  });

  it("asks Supabase to email a reset code, then moves on", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    } as never);
    const user = userEvent.setup();
    const { onCodeSent } = renderScreen();

    await user.type(screen.getByLabelText("Email"), `  ${EMAIL} `);
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL);
    expect(onCodeSent).toHaveBeenCalledWith(EMAIL);
  });

  it("explains the wait when too many emails were sent", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: {
        code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
      },
    } as never);
    const user = userEvent.setup();
    const { onCodeSent } = renderScreen(EMAIL);

    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(screen.getByRole("alert").textContent).toMatch(/Wait a minute/);
    expect(onCodeSent).not.toHaveBeenCalled();
  });

  it("'Back to sign in' goes back", async () => {
    const user = userEvent.setup();
    const { onBack } = renderScreen();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
