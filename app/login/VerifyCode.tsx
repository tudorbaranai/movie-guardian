"use client";

// The "Enter your code" screen, shown right after creating an account.
//
// Supabase emails a short numeric code (see the "Confirm sign up" email
// template in the Supabase dashboard). Typing it here confirms the email AND
// signs you in, all on this page — no link to click, no second browser tab.
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { supabase } from "@/lib/supabase";
import styles from "./login.module.css";

// Must match "Email OTP length" in Supabase (Authentication → Sign In /
// Providers → Email). If you change one, change the other.
export const CODE_LENGTH = 8;

// Supabase won't email the same person more often than this ("Minimum
// interval per user" in the SMTP settings), so the button waits too.
const RESEND_COOLDOWN_SECONDS = 60;

const emptyCode = () => Array<string>(CODE_LENGTH).fill("");

type Props = {
  email: string;
  /** A message to show when the screen opens, e.g. "We sent you a new code". */
  initialNotice?: string | null;
  onVerified: () => void;
  onBack: () => void;
};

export default function VerifyCode({
  email,
  initialNotice = null,
  onVerified,
  onBack,
}: Props) {
  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  // One handle per box, so we can move the cursor between them.
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // Count the resend timer down once a second until it reaches zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Put the cursor in the first box as soon as the screen appears.
  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  // When a check finishes without signing in (wrong code), put the cursor back
  // in the first box. It has to wait until here: the boxes are disabled while
  // checking, and a disabled box can't take the cursor.
  const wasVerifying = useRef(false);
  useEffect(() => {
    if (wasVerifying.current && !verifying) boxes.current[0]?.focus();
    wasVerifying.current = verifying;
  }, [verifying]);

  async function verify(code: string) {
    setVerifying(true);
    setError(null);
    setNotice(null);

    // type "email" = "a code that was emailed for sign-up or sign-in".
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setVerifying(false);
      // Supabase gives the same answer for a mistyped code and an expired one.
      setError(
        verifyError.code === "otp_expired"
          ? "That code is wrong or has expired. Check the email, or send a new code."
          : verifyError.message,
      );
      setDigits(emptyCode());
      return;
    }

    onVerified();
  }

  // Write digits into the boxes starting at `start`. Handles one typed digit
  // and a whole pasted code alike. Submits by itself once every box is full.
  function fill(start: number, text: string) {
    const incoming = text.replace(/\D/g, "").slice(0, CODE_LENGTH - start);
    if (!incoming) return;

    const next = [...digits];
    incoming.split("").forEach((digit, offset) => {
      next[start + offset] = digit;
    });
    setDigits(next);
    setError(null);

    if (next.every(Boolean)) {
      boxes.current[CODE_LENGTH - 1]?.blur();
      verify(next.join(""));
    } else {
      boxes.current[Math.min(start + incoming.length, CODE_LENGTH - 1)]?.focus();
    }
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/\D/g, "");
    if (!raw) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    // Typing into a box that already has a digit gives two characters here;
    // keep only the new one. Anything longer is a pasted or autofilled code.
    const previous = digits[index];
    const typed =
      previous && raw.length === 2 ? (raw[0] === previous ? raw[1] : raw[0]) : raw;
    fill(index, typed);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      // Empty box: step back and clear the previous one, like a normal field.
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      boxes.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      boxes.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    // A full code always starts from the first box, wherever the cursor was.
    fill(pasted.length >= CODE_LENGTH ? 0 : index, pasted);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (digits.some((digit) => !digit)) {
      setError(`Enter all ${CODE_LENGTH} digits from the email.`);
      boxes.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    verify(digits.join(""));
  }

  async function resend() {
    setError(null);
    setNotice(null);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (resendError) {
      setError(
        resendError.code === "over_email_send_rate_limit"
          ? "Too many emails in a short time. Wait a minute, then try again."
          : resendError.message,
      );
      return;
    }

    setNotice("New code sent. Check your inbox, and your spam folder too.");
    setDigits(emptyCode());
    setCooldown(RESEND_COOLDOWN_SECONDS);
    boxes.current[0]?.focus();
  }

  return (
    <div className={styles.card}>
      <div className={styles.logo}>📬</div>
      <h1 className={styles.title}>Enter your code</h1>
      <p className={styles.subtitle}>
        We sent your {CODE_LENGTH}-digit code to
        <strong className={styles.email}>{email}</strong>
      </p>

      <form className={styles.codeForm} onSubmit={handleSubmit} noValidate>
        <div
          className={`${styles.codeRow} ${error ? styles.codeRowError : ""}`}
          role="group"
          aria-label="Confirmation code"
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                boxes.current[index] = element;
              }}
              className={styles.codeBox}
              value={digit}
              onChange={(event) => handleChange(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={(event) => handlePaste(index, event)}
              // Selecting the digit on focus means typing replaces it.
              onFocus={(event) => event.target.select()}
              inputMode="numeric"
              pattern="[0-9]*"
              // Lets phones offer the code from the email automatically.
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={CODE_LENGTH}
              aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
              disabled={verifying}
            />
          ))}
        </div>

        <button className={styles.submit} type="submit" disabled={verifying}>
          {verifying ? "Checking…" : "Confirm email"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <p className={styles.helper}>
        Didn&apos;t get it?{" "}
        {cooldown > 0 ? (
          <span className={styles.countdown}>
            Send a new code in {Math.floor(cooldown / 60)}:
            {String(cooldown % 60).padStart(2, "0")}
          </span>
        ) : (
          <button type="button" className={styles.linkButton} onClick={resend}>
            Send a new code
          </button>
        )}
      </p>
      <p className={styles.helper}>
        <button type="button" className={styles.linkButton} onClick={onBack}>
          Use a different email
        </button>
      </p>
    </div>
  );
}
