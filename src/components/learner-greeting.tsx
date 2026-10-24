"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLumaAuth } from "@/components/auth-provider";
import { firstDisplayName } from "@/lib/profile-name";
import styles from "./learner-greeting.module.css";

function daypart() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * /learn is statically prerendered. A build-time daypart will disagree with
 * the learner's local clock, causing a React hydration mismatch (#418) and
 * potentially a full client replacement of the already-painted home.
 *
 * Render deterministic copy on the server AND during hydration. Update to
 * local time after mount; keep the same DOM structure while auth resolves.
 */
export function LearnerGreeting() {
  const { user, loading } = useLumaAuth();
  const [greeting, setGreeting] = useState("Hola");
  const name = useMemo(
    () => firstDisplayName(user?.displayName, ""),
    [user?.displayName],
  );

  useEffect(() => {
    const updateGreeting = () => setGreeting(daypart());
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") updateGreeting();
    };
    updateGreeting();
    window.addEventListener("focus", updateGreeting);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", updateGreeting);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div className={styles.guestGreeting}>
      <p className={styles.greeting}>
        {greeting}{!loading && user ? ", " + (name || "Participante") : ""}.
      </p>
      {!loading && !user && (
        <Link href="/login">Accede para personalizar tu experiencia</Link>
      )}
    </div>
  );
}
