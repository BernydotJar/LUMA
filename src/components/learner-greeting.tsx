"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLumaAuth } from "@/components/auth-provider";
import { firstDisplayName } from "@/lib/profile-name";
import styles from "./learner-greeting.module.css";

function daypart() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function LearnerGreeting() {
  const { user, loading } = useLumaAuth();

  const name = useMemo(
    () => firstDisplayName(user?.displayName, ""),
    [user?.displayName],
  );

  if (loading) return <p className={styles.greeting}>{daypart()}.</p>;

  if (!user) {
    return (
      <div className={styles.guestGreeting}>
        <p className={styles.greeting}>{daypart()}.</p>
        <Link href="/login">Accede para personalizar tu experiencia</Link>
      </div>
    );
  }

  return <p className={styles.greeting}>{daypart()}, {name || "Participante"}.</p>;
}
