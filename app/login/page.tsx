"use client";

// Runs in the browser so it can hold what you type and react to clicks.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import VerifyCode from "./VerifyCode";
import styles from "./login.module.css";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Sign-up only: the password typed a second time, to catch typos.
  const [confirmPassword, setConfirmPassword] = useState("");
  const confirmRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  // True until we know whether someone is already signed in, so the form
  // doesn't flash on screen right before we send them away.
  const [checking, setChecking] = useState(true);
  // Set once we're waiting for someone to type the code we emailed them.
  // While it's set, the code screen replaces the form.
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);

  // Already signed in? There's nothing to do on this page, so go home.
  // `replace` (not `push`) so the Back button doesn't return you here.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (data.user) router.replace("/");
      else setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  // True as soon as the confirmation can no longer match — e.g. "abx" when the
  // password is "abcdef" — but not while it's still a correct beginning.
  const passwordsDiverge =
    mode === "signup" &&
    confirmPassword !== "" &&
    !password.startsWith(confirmPassword);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (mode === "signup" && password !== confirmPassword) {
      setMessage(
        "Passwords don't match. Type the same password in both fields.",
      );
      setIsError(true);
      confirmRef.current?.focus();
      return;
    }

    setLoading(true);
    setMessage(null);
    setIsError(false);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error?.code === "email_not_confirmed") {
        // They created an account but never entered the code (closed the tab,
        // lost the email…). Send a fresh code and take them straight to it.
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email,
        });
        setLoading(false);
        setCodeNotice(
          resendError
            ? "Your email isn't confirmed yet. Enter the code from your latest email."
            : "Your email isn't confirmed yet, so we sent you a new code.",
        );
        setCodeEmail(email);
        return;
      }

      setLoading(false);
      if (error) {
        setMessage(error.message);
        setIsError(true);
      } else {
        goHome();
      }
      return;
    }

    // `options.data` is saved on the account as "user metadata" — that's where
    // the nickname lives, so the header can greet you by name instead of email.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname: nickname.trim() } },
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      setIsError(true);
    } else if (data.session) {
      // Email confirmation is off in Supabase, so we're signed in straight away.
      goHome();
    } else if (data.user?.identities?.length === 0) {
      // Supabase's way of saying "this email already has a confirmed account":
      // it sends no code, so don't leave them waiting for one.
      setMode("signin");
      setMessage(
        "There's already an account with this email. Sign in instead.",
      );
      setIsError(true);
    } else {
      // Supabase has emailed a code. Swap the form for the code screen.
      setCodeNotice(null);
      setCodeEmail(email);
    }
  }

  function goHome() {
    router.push("/");
    router.refresh();
  }

  if (checking) {
    return <main className={styles.main} />;
  }

  if (codeEmail) {
    return (
      <main className={styles.main}>
        <VerifyCode
          email={codeEmail}
          initialNotice={codeNotice}
          onVerified={goHome}
          onBack={() => {
            setCodeEmail(null);
            setCodeNotice(null);
            setPassword("");
            switchMode("signup");
          }}
        />
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.logo}>🎬</div>
        <h1 className={styles.title}>
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className={styles.subtitle}>
          {mode === "signin"
            ? "Sign in to track the films you watch."
            : "Start tracking films and building your watchlist."}
        </p>

        <div className={styles.switcher} role="tablist">
          <button
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? styles.switchActive : styles.switch}
            onClick={() => switchMode("signin")}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? styles.switchActive : styles.switch}
            onClick={() => switchMode("signup")}
          >
            Create account
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Only asked for when creating an account. */}
          {mode === "signup" && (
            <label className={styles.field}>
              <span className={styles.label}>Nickname</span>
              <input
                className={styles.input}
                type="text"
                placeholder="What should we call you?"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="nickname"
                required
                maxLength={24}
              />
            </label>
          )}

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

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={6}
            />
          </label>

          {/* Only asked for when creating an account. */}
          {mode === "signup" && (
            // A <div>, not a wrapping <label>: the hint below must not become
            // part of the field's name that screen readers announce.
            <div className={styles.field}>
              <label htmlFor="confirm-password" className={styles.label}>
                Confirm password
              </label>
              <input
                id="confirm-password"
                ref={confirmRef}
                className={styles.input}
                type="password"
                placeholder="Type the same password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                aria-invalid={passwordsDiverge}
                aria-describedby={
                  passwordsDiverge ? "confirm-password-hint" : undefined
                }
              />
              {passwordsDiverge && (
                <span id="confirm-password-hint" className={styles.fieldError}>
                  Doesn&apos;t match the password above
                </span>
              )}
            </div>
          )}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {message && (
          <p className={isError ? styles.error : styles.notice}>{message}</p>
        )}
      </div>
    </main>
  );
}
