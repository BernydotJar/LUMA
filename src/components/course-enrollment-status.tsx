"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, LockKeyhole } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import { firebaseAuth } from "@/lib/firebase-client";
import styles from "./course-enrollment-status.module.css";

type CourseAccess = {
  uid: string;
  status: "active" | "none" | "unavailable";
  names: string[];
};

const knownProgramNames: Record<string, string> = {
  "pnl-practitioner": "Practitioner PNL",
};

export function CourseEnrollmentStatus() {
  const { user, loading } = useLumaAuth();
  const [access, setAccess] = useState<CourseAccess | null>(null);

  useEffect(() => {
    const uid = user?.uid;
    if (loading || !uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const authUser = firebaseAuth.currentUser;
        if (!authUser || authUser.uid !== uid) return;
        const response = await fetch("/api/commerce/access", {
          cache: "no-store",
          headers: { authorization: `Bearer ${await authUser.getIdToken()}` },
        });
        if (!response.ok) throw new Error("ENROLLMENT_UNAVAILABLE");
        const data = await response.json() as {
          enrollments: { programId: string; status: string }[];
        };
        const programs = data.enrollments
          .filter((entry) => entry.status === "active")
          .map((entry) => knownProgramNames[entry.programId] ?? "Programa inscrito");
        if (!cancelled) setAccess({ uid, status: programs.length ? "active" : "none", names: programs });
      } catch {
        if (!cancelled) setAccess({ uid, status: "unavailable", names: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user?.uid]);

  if (loading) return null;
  if (!user) {
    return <div className={styles.notice} data-status="preview">
      <LockKeyhole size={17} aria-hidden="true" />
      <span><strong>Exploración de muestra.</strong> Estas prácticas introductorias no confirman una matrícula.</span>
      <Link href="/login">Iniciar sesión <ArrowRight size={15} /></Link>
    </div>;
  }
  if (!access || access.uid !== user.uid) return <p className={styles.loading} role="status">Consultando tu inscripción…</p>;
  if (access.status === "unavailable") return <p className={styles.loading} role="status">No pudimos verificar tus cursos. Inténtalo de nuevo al actualizar.</p>;
  if (access.status === "none") return <div className={styles.notice} data-status="preview">
    <LockKeyhole size={17} aria-hidden="true" />
    <span><strong>Sin matrícula vinculada.</strong> Puedes explorar muestras; el contenido exclusivo requiere una compra activa con tu correo verificado.</span>
    <Link href="/learn/experiences">Ver muestras <ArrowRight size={15} /></Link>
  </div>;

  return <div className={styles.notice} data-status="active" data-testid="active-course-access">
    <BookOpenCheck size={19} aria-hidden="true" />
    <span><strong>Tu curso · {access.names[0]}</strong> <small>Matrícula activa{access.names.length > 1 ? ` · ${access.names.length} programas` : ""}. Puedes continuar con tus prácticas.</small></span>
    <Link href="/learn/experiences">Ir al programa <ArrowRight size={15} /></Link>
  </div>;
}
