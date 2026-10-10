"use client";

import Link from "next/link";
import { Check, LogOut, Pencil, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useLumaAuth } from "@/components/auth-provider";
import { firstDisplayName } from "@/lib/profile-name";
import styles from "./account-menu.module.css";

export function AccountMenu({ mode }: { mode: "learner" | "studio" }) {
  const { user, loading, signOut, updateDisplayName } = useLumaAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditing(false);
        setNotice("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      setEditing(false);
      setNotice("");
      triggerRef.current?.focus();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  if (loading) {
    return <div className={styles.skeleton} role="status" aria-label="Cargando sesión" />;
  }

  if (!user) {
    return (
      <Link className={styles.signInLink} href="/login" aria-label="Acceder">
        <UserRound size={16} />
        <span>Acceder</span>
      </Link>
    );
  }

  const label = firstDisplayName(user.displayName || user.email);
  const initial = label.slice(0, 1).toUpperCase();

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await updateDisplayName(name);
      setEditing(false);
      setNotice("Nombre actualizado");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo actualizar el nombre.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.account} ref={containerRef}>
      <button
        className={styles.accountButton}
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        aria-label={`${open ? "Cerrar" : "Abrir"} perfil de ${label}`}
        onClick={() => {
          setOpen((value) => !value);
          setNotice("");
        }}
      >
        <span className={styles.avatar}>{initial}</span>
        <span className={styles.identity}>
          <strong>{label}</strong>
          <small>{mode === "studio" ? "Vista interna" : "Mi aprendizaje"}</small>
        </span>
      </button>

      {open && (
        <section id={popoverId} className={styles.popover} role="dialog" aria-label="Perfil de LUMA">
          <header>
            <div>
              <span className={styles.avatarLarge}>{initial}</span>
              <div>
                <strong>{user.displayName || "Elige cómo quieres que te llamemos"}</strong>
                <small>{user.email}</small>
              </div>
            </div>
            <button ref={closeRef} type="button" aria-label="Cerrar perfil" onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}>
              <X size={16} />
            </button>
          </header>

          {editing ? (
            <form className={styles.nameForm} onSubmit={saveName}>
              <label htmlFor="preferred-name">¿Cómo quieres que te llamemos?</label>
              <input
                id="preferred-name"
                autoFocus
                autoComplete="nickname"
                maxLength={48}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div>
                <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
                <button type="submit" disabled={saving}>
                  <Check size={15} /> {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          ) : (
            <button
              className={styles.editButton}
              type="button"
              onClick={() => {
                setName(user.displayName || "");
                setEditing(true);
                setNotice("");
              }}
            >
              <Pencil size={15} /> Cambiar nombre en LUMA
            </button>
          )}

          {notice && <p className={styles.notice} role="status">{notice}</p>}

          <button className={styles.signOutButton} type="button" onClick={() => void signOut()}>
            <LogOut size={15} /> Cerrar sesión
          </button>
        </section>
      )}
    </div>
  );
}
