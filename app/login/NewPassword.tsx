"use client";

// "Choose a new password" — the last step of "Forgot password?". The code from
// the email has already signed you in, and that session is allowed to set a
// new password.
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import ConfirmPasswordField from "./ConfirmPasswordField";
import styles from "./login.module.css";

type Props = {
  email: string;
  onDone: () => void;
};

export default function NewPassword({ email, onDone }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password !== confirmation) {
      setError("Passwords don't match. Type the same password in both fields.");
      confirmRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "That's your current password. Choose a different one."
          : // e.g. "weak_password" — Supabase's message says what's missing.
            updateError.message,
      );
      return;
    }

    onDone();
  }

  return (
    <div className={styles.card}>
      <div className={styles.logo}>🔒</div>
      <h1 className={styles.title}>Choose a new password</h1>
      <p className={styles.subtitle}>
        For
        <strong className={styles.email}>{email}</strong>
      </p>

      <form
        className={`${styles.form} ${styles.formSpaced}`}
        onSubmit={handleSubmit}
      >
        {/* Hidden, but tells password managers which account this is for. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />

        <label className={styles.field}>
          <span className={styles.label}>New password</span>
          <input
            className={styles.input}
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        <ConfirmPasswordField
          password={password}
          value={confirmation}
          onChange={setConfirmation}
          inputRef={confirmRef}
        />

        <button className={styles.submit} type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save password"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
