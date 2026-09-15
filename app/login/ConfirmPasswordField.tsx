"use client";

// The "Confirm password" box, shared by "Create account" and "Choose a new
// password". It warns as soon as the second password can no longer match.
import type { Ref } from "react";
import styles from "./login.module.css";

/**
 * True once `confirmation` can no longer match `password` — e.g. "abx" when the
 * password is "abcdef" — but not while it's still a correct beginning.
 */
export function passwordsDiverge(password: string, confirmation: string) {
  return confirmation !== "" && !password.startsWith(confirmation);
}

type Props = {
  /** The password typed in the box above, to compare against. */
  password: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
};

export default function ConfirmPasswordField({
  password,
  value,
  onChange,
  inputRef,
}: Props) {
  const diverges = passwordsDiverge(password, value);

  return (
    // A <div>, not a wrapping <label>: the hint below must not become part of
    // the field's name that screen readers announce.
    <div className={styles.field}>
      <label htmlFor="confirm-password" className={styles.label}>
        Confirm password
      </label>
      <input
        id="confirm-password"
        ref={inputRef}
        className={styles.input}
        type="password"
        placeholder="Type the same password again"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
        required
        minLength={6}
        aria-invalid={diverges}
        aria-describedby={diverges ? "confirm-password-hint" : undefined}
      />
      {diverges && (
        <span id="confirm-password-hint" className={styles.fieldError}>
          Doesn&apos;t match the password above
        </span>
      )}
    </div>
  );
}
