"use client";

// The bar at the top of every page: logo, search, and who's signed in.
// It's a client component because it has to know the current user AND open a
// dropdown menu — both need JavaScript running in the browser.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import SearchBar from "./SearchBar";
import AiChat from "./AiChat";
import styles from "./Header.module.css";

// What to call someone in the nav bar. We ask for a nickname when they create
// an account and store it on the user; accounts made before that fall back to
// the part of their email before the "@", so nobody ever sees a blank name.
function displayNameOf(user: User) {
  const nickname = user.user_metadata?.nickname;
  if (typeof nickname === "string" && nickname.trim()) return nickname.trim();
  return user.email?.split("@")[0] ?? "Account";
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // A "ref" is a handle on the real HTML element, so we can ask questions like
  // "was this click inside the menu or outside it?"
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Who's logged in right now?
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    // Then stay in sync when someone logs in or out.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the dropdown when you click anywhere else, or press Escape.
  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const name = user ? displayNameOf(user) : "";

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}>🎬</span>
          <span className={styles.brandName}>Movie Guardian</span>
        </Link>

        <div className={styles.search}>
          <SearchBar size="compact" />
        </div>

        <nav className={styles.nav}>
          {/* Always here, signed in or not — signed out it explains itself. */}
          <AiChat signedIn={Boolean(user)} />

          {user ? (
            <>
              <Link href="/my-movies" className={styles.navLink}>
                My Movies
              </Link>

              <div className={styles.account} ref={menuRef}>
                <button
                  className={styles.accountButton}
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.accountName}>{name}</span>
                  <span className={styles.caret} aria-hidden="true">
                    ▾
                  </span>
                </button>

                {menuOpen && (
                  <div className={styles.menu} role="menu">
                    <div className={styles.menuHead}>
                      <span className={styles.menuName}>{name}</span>
                      <span className={styles.menuEmail}>{user.email}</span>
                    </div>

                    <Link
                      href="/my-movies"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => setMenuOpen(false)}
                    >
                      My Movies
                    </Link>

                    <Link
                      href="/account"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => setMenuOpen(false)}
                    >
                      Account
                    </Link>

                    <div className={styles.menuDivider} />

                    <button
                      role="menuitem"
                      className={`${styles.menuItem} ${styles.menuSignOut}`}
                      onClick={handleSignOut}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className={styles.signIn}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
