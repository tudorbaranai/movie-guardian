"use client";

// "Reset your password" — step 1 of "Forgot password?". Asks for the email,
// then Supabase emails a code (the "Reset password" template in the dashboard).
// The code screen comes next.
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./login.module.css";

type Props = {
  /** Whatever was already typed in the sign-in form, so it isn't typed twice. */
  initialEmail: string;
  onCodeSent: (email: string) => void;
  onBack: () => void;
};

export default function ForgotPassword({
  initialEmail,
  onCodeSent,
  onBack,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    setSending(true);
    setError(null);

    // Supabase answers "OK" even when no account uses this email, so nobody
    // can use this form to find out who has an account.
    const { error: sendError } =
      await supabase.auth.resetPasswordForEmail(address);
    setSending(false);

    if (sendError) {
      setError(
        sendError.code === "over_email_send_rate_limit"
          ? "Too many emails in a short time. Wait a minute, then try again."
          : sendError.message,
      );
      return;
    }

    onCodeSent(address);
  }

  return (
    <div className={styles.card}>
      <div className={styles.logo}>🔑</div>
      <h1 className={styles.title}>Reset your password</h1>
      <p className={styles.subtitle}>
        Enter the email you signed up with and we&apos;ll send you a code.
      </p>

      <form
        className={`${styles.form} ${styles.formSpaced}`}
        onSubmit={handleSubmit}
      >
        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <button className={styles.submit} type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send code"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <p className={styles.helper}>
        <button type="button" className={styles.linkButton} onClick={onBack}>
          Back to sign in
        </button>
      </p>
    </div>
  );
}
