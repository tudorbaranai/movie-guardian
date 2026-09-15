"use client";

// "Change password" for someone who is signed in and KNOWS their password.
// (Forgot it? That's the "Forgot password?" flow on the login page.)
//
// Why ask for the current password? So nobody can change it from a laptop
// you left signed in. Supabase's own "Require current password when updating"
// setting stays OFF on purpose — turning it on would break "Forgot password?",
// because those users don't know their current password. So this form checks
// the current password itself, by signing in with it, before saving.
import { useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import ConfirmPasswordField from "../login/ConfirmPasswordField";
import loginStyles from "../login/login.module.css";
import styles from "./account.module.css";

export default function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);

    if (newPassword !== confirmation) {
      setError(
        "Passwords don't match. Type the same new password in both fields.",
      );
      confirmRef.current?.focus();
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from the current one.");
      return;
    }

    setSaving(true);

    // 1. Prove it's really you: the current password must sign in.
    const { error: checkError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (checkError) {
      setSaving(false);
      setError(
        checkError.code === "invalid_credentials"
          ? "Your current password isn't right."
          : checkError.message,
      );
      return;
    }

    // 2. Save the new password.
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      setSaving(false);
      setError(
        updateError.code === "same_password"
          ? "Your new password must be different from the current one."
          : // e.g. "weak_password" — Supabase's message says what's missing.
            updateError.message,
      );
      return;
    }

    // 3. Optionally sign out everywhere else (this device stays signed in).
    let othersNote = "";
    if (signOutOthers) {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "others",
      });
      othersNote = signOutError
        ? " We couldn't sign out your other devices — try again later."
        : " Your other devices have been signed out.";
    }

    setSaving(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setSignOutOthers(false);
    setDone(`Password changed.${othersNote}`);
  }

  return (
    <>
      <form className={loginStyles.form} onSubmit={handleSubmit}>
        {/* Hidden, but tells password managers which account this is for. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />

        <label className={loginStyles.field}>
          <span className={loginStyles.label}>Current password</span>
          <input
            className={loginStyles.input}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label className={loginStyles.field}>
          <span className={loginStyles.label}>New password</span>
          <input
            className={loginStyles.input}
            type="password"
            placeholder="At least 6 characters"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        <ConfirmPasswordField
          password={newPassword}
          value={confirmation}
          onChange={setConfirmation}
          inputRef={confirmRef}
        />

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(event) => setSignOutOthers(event.target.checked)}
          />
          Also sign me out on other devices
        </label>

        <button className={loginStyles.submit} type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save new password"}
        </button>
      </form>

      {error && (
        <p className={loginStyles.error} role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className={loginStyles.notice} role="status">
          {done}
        </p>
      )}
    </>
  );
}
