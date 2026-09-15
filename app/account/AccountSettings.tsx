"use client";

// Signed-in only: shows who you are and the "Change password" form.
// Signed-out visitors are sent to the login page.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import ChangePasswordForm from "./ChangePasswordForm";
import loginStyles from "../login/login.module.css";
import styles from "./account.module.css";

export default function AccountSettings() {
  const router = useRouter();
  // `undefined` = still checking, `null` = signed out.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        // `replace` so Back doesn't bounce you between here and the login page.
        router.replace("/login");
        return;
      }
      setUser(data.user);
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Nothing to show until we know who's here (and never to signed-out visitors).
  if (!user) return <main className={loginStyles.main} />;

  const nickname = user.user_metadata?.nickname;

  return (
    <main className={loginStyles.main}>
      <div className={loginStyles.card}>
        <h1 className={loginStyles.title}>Account</h1>
        <p className={loginStyles.subtitle}>
          Signed in as
          <strong className={loginStyles.email}>{user.email}</strong>
        </p>
        {typeof nickname === "string" && nickname.trim() && (
          <p className={styles.detail}>
            Nickname: <span className={styles.value}>{nickname.trim()}</span>
          </p>
        )}

        <section className={styles.section} aria-labelledby="change-password">
          <h2 id="change-password" className={styles.sectionTitle}>
            Change password
          </h2>
          <ChangePasswordForm email={user.email ?? ""} />
        </section>
      </div>
    </main>
  );
}
