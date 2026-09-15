// Tests for the "Enter your code" screen (app/login/VerifyCode.tsx).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// A stand-in for Supabase, so tests never talk to the real project.
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { verifyOtp: vi.fn(), resend: vi.fn() } },
}));

import { supabase } from "@/lib/supabase";
import VerifyCode, { CODE_LENGTH } from "@/app/login/VerifyCode";

const auth = vi.mocked(supabase.auth);
const EMAIL = "reader@example.com";
// "12345678" for 8 digits — built from CODE_LENGTH so the tests follow it.
const FULL_CODE = Array.from({ length: CODE_LENGTH }, (_, i) => (i + 1) % 10).join("");

function renderScreen() {
  const onVerified = vi.fn();
  const onBack = vi.fn();
  render(<VerifyCode email={EMAIL} onVerified={onVerified} onBack={onBack} />);
  return { onVerified, onBack };
}

const boxes = () => screen.getAllByLabelText(/^Digit \d+ of/) as HTMLInputElement[];
const typedCode = () => boxes().map((box) => box.value).join("");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("VerifyCode", () => {
  it("shows one box per digit, the email, and starts in the first box", () => {
    renderScreen();

    expect(boxes()).toHaveLength(CODE_LENGTH);
    expect(screen.getByText(EMAIL)).toBeTruthy();
    expect(document.activeElement).toBe(boxes()[0]);
  });

  it("moves to the next box while typing and ignores letters", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.keyboard("12a3");

    expect(typedCode()).toBe("123");
    expect(document.activeElement).toBe(boxes()[3]);
  });

  it("Backspace in an empty box clears the digit before it", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.keyboard("12{Backspace}");

    expect(typedCode()).toBe("1");
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it("asks for every digit instead of checking a partial code", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.keyboard("12");
    await user.click(screen.getByRole("button", { name: "Confirm email" }));

    expect(screen.getByRole("alert").textContent).toMatch(`Enter all ${CODE_LENGTH} digits`);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("pasting a whole code fills every box, checks it, and signs in", async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null } as never);
    const user = userEvent.setup();
    const { onVerified } = renderScreen();

    await user.paste(`Your code: ${FULL_CODE}`);

    expect(typedCode()).toBe(FULL_CODE);
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: EMAIL,
      token: FULL_CODE,
      type: "email",
    });
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  });

  it("a wrong code shows an error, clears the boxes and returns to the first box", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", message: "Token has expired or is invalid" },
    } as never);
    const user = userEvent.setup();
    const { onVerified } = renderScreen();

    await user.paste(FULL_CODE);

    expect((await screen.findByRole("alert")).textContent).toMatch(/wrong or has expired/);
    expect(typedCode()).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(boxes()[0]));
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("offers a new code only after the cooldown, then sends one", async () => {
    vi.useFakeTimers();
    auth.resend.mockResolvedValue({ data: {}, error: null } as never);
    renderScreen();

    expect(screen.getByText("Send a new code in 1:00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send a new code" })).toBeNull();

    // The countdown ticks once a second; let a minute pass.
    for (let second = 0; second < 60; second++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    const resendButton = screen.getByRole("button", { name: "Send a new code" });
    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: EMAIL });
    expect(screen.getByRole("status").textContent).toMatch(/New code sent/);
    expect(screen.getByText("Send a new code in 1:00")).toBeTruthy();
  });

  it("'Use a different email' goes back", async () => {
    const user = userEvent.setup();
    const { onBack } = renderScreen();

    await user.click(screen.getByRole("button", { name: "Use a different email" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
