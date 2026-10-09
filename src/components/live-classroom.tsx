"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "@firebase/auth";
import Link from "next/link";
import {
  LiveKitRoom, PreJoin, VideoConference, useParticipants, useRoomContext,
} from "@livekit/components-react";
import { ArrowLeft, Radio, ShieldCheck, Users, VideoOff } from "lucide-react";
import { DisconnectReason } from "livekit-client";
import { useLumaAuth } from "./auth-provider";
import { firebaseAuth } from "@/lib/firebase-client";
import styles from "./live-classroom.module.css";

type UserChoices = { audioEnabled: boolean; videoEnabled: boolean };
type ClassroomSession = {
  title: string; offeringTitle: string; scheduledAt: string;
  durationMinutes: number; recordingPolicy: string;
};
type Credentials = {
  token: string; serverUrl: string; role: "instructor" | "learner";
  classroom: ClassroomSession;
};

const accessErrors: Record<string, string> = {
  classroom_not_open: "El aula se habilita 30 minutos antes de la sesión.",
  classroom_closed: "Esta sesión ya concluyó o no admite nuevos ingresos.",
  classroom_access_denied: "Tu cuenta no tiene una matrícula activa para esta cohorte.",
  classroom_access_revoked: "El equipo del programa ha restringido tu acceso a esta sesión.",
  classroom_rate_limited: "Has realizado muchos intentos de ingreso. Intenta de nuevo en unos segundos.",
  classroom_not_found: "No encontramos esta sesión. Revisa tu agenda.",
  classroom_not_enabled: "El aula todavía no está habilitada por la organización.",
  classroom_provider_unconfigured: "El proveedor de video aún no está configurado.",
  classroom_provider_unavailable: "El servicio de video no está disponible. Intenta nuevamente.",
  authentication_required: "Inicia sesión para ingresar al aula.",
};

function InstructorModeration({ offeringId, sessionId, onSessionClosed }: {
  offeringId: string; sessionId: string; onSessionClosed: () => void;
}) {
  const participants = useParticipants();
  const room = useRoomContext();
  const { user } = useLumaAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState("");
  const others = participants.filter((participant) => participant.identity !== room.localParticipant.identity);
  async function removeParticipant(identity: string) {
    if (!user || !window.confirm("¿Retirar a este participante del aula?")) return;
    setPending(identity);
    setNotice("");
    try {
      const response = await fetch(`/api/live/classrooms/${offeringId}/${sessionId}/moderate`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "remove", identity }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("No se pudo retirar a la persona.");
      setNotice("Se retiró al participante.");
    } catch {
      setNotice("No fue posible aplicar la acción. Intenta nuevamente.");
    } finally {
      setPending(null);
    }
  }
  async function closeSession() {
    if (!user || closing || !window.confirm("¿Terminar esta clase ahora para todas las personas? Esta acción no puede deshacerse.")) return;
    setClosing(true);
    setNotice("");
    try {
      const response = await fetch(`/api/live/classrooms/${offeringId}/${sessionId}/close`, {
        method: "POST",
        headers: { authorization: `Bearer ${await user.getIdToken()}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("classroom_close_failed");
      onSessionClosed();
    } catch {
      setNotice("No se logró cerrar completamente la sesión. Puedes volver a intentarlo.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <aside className={styles.roster} aria-label="Moderación del instructor">
      <h2><Users size={16} /> Participantes <span>{participants.length}</span></h2>
      <p>Administra la asistencia dentro de esta sesión.</p>
      <ul>
        {others.map((participant) => {
          const role = (() => {
            try {
              return (JSON.parse(participant.metadata || "{}") as { role?: string }).role;
            } catch { return undefined; }
          })();
          return (
            <li key={participant.identity}>
              <span className={styles.personName}>{participant.name || "Participante"}</span>
              {role === "instructor" ? <small>Entrenador</small> : (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void removeParticipant(participant.identity)}
                  aria-label={`Retirar a ${participant.name || "participante"}`}
                >{pending === participant.identity ? "Retirando" : "Retirar"}</button>
              )}
            </li>
          );
        })}
      </ul>
      {notice && <p role="status">{notice}</p>}
      <button className={styles.endSession} type="button" disabled={closing || pending !== null} onClick={() => void closeSession()}>
        {closing ? "Cerrando el aula…" : "Terminar clase para todos"}
      </button>
    </aside>
  );
}

export function LiveClassroom({
  offeringId, sessionId,
}: { offeringId: string; sessionId: string }) {
  const { user, loading } = useLumaAuth();
  const [joined, setJoined] = useState<{ credentials: Credentials; choices: UserChoices; uid: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState("");
  const current = joined?.uid === user?.uid ? joined : null;

  useEffect(() => onAuthStateChanged(firebaseAuth, (identity) => {
    if (!identity) setJoined(null);
  }), []);

  async function enterClassroom(choices: UserChoices) {
    if (!user || connecting) return;
    setConnecting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/live/classrooms/${encodeURIComponent(offeringId)}/${encodeURIComponent(sessionId)}/token`,
        {
          method: "POST",
          cache: "no-store",
          headers: { authorization: `Bearer ${await user.getIdToken()}` },
        },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body
          ? String(body.error) : "unknown";
        throw new Error(accessErrors[code] ?? "No fue posible conectar con el aula.");
      }
      const credentials = body as Credentials;
      if (!credentials.token || !credentials.serverUrl || !credentials.classroom) {
        throw new Error("La respuesta del servicio de video fue incompleta.");
      }
      setJoined({ credentials, choices, uid: user.uid });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible ingresar.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/learn" className={styles.back}><ArrowLeft size={18} /> Volver a mi programa</Link>
        <span className={styles.brand}><Radio size={17} /> LUMA LIVE</span>
        <span className={styles.secure}><ShieldCheck size={15} /> Acceso protegido</span>
      </header>
      {loading ? <div className={styles.state} role="status">Validando tu sesión…</div> :
        !user ? (
          <div className={styles.state}>
            <h1>Tu aula te espera</h1>
            <p>Inicia sesión con la cuenta vinculada a tu matrícula.</p>
            <Link href="/login" className={styles.primary}>Iniciar sesión</Link>
          </div>
        ) : closed ? (
          <div className={styles.state} role="status">
            <h1>La clase ha finalizado.</h1>
            <p>El aula se cerró para todas las personas. Puedes regresar a tu programa para continuar aprendiendo.</p>
            <Link href="/learn" className={styles.primary}>Volver al programa</Link>
          </div>
        ) : current ? (
          <section className={styles.classroom} aria-label="Sala de clase en vivo">
            <div className={styles.roomTitle}>
              <div>
                <span className={styles.eyebrow}>Aula virtual · {current.credentials.classroom.offeringTitle}</span>
                <h1>{current.credentials.classroom.title}</h1>
              </div>
              <span className={styles.policy}><VideoOff size={15} /> {
                current.credentials.classroom.recordingPolicy === "none"
                  ? "Sin grabación institucional" : "Grabación según política del programa"
              }</span>
            </div>
            <LiveKitRoom
              serverUrl={current.credentials.serverUrl}
              token={current.credentials.token}
              connect
              audio={current.choices.audioEnabled}
              video={current.choices.videoEnabled}
              onDisconnected={(reason) => {
                setJoined(null);
                if (reason === DisconnectReason.ROOM_DELETED) setClosed(true);
              }}
              onError={() => setError("Se perdió la conexión audiovisual. Puedes volver a ingresar.")}
              className={styles.media}
            >
              <div className={styles.video}><VideoConference /></div>
              {current.credentials.role === "instructor" && (
                <InstructorModeration offeringId={offeringId} sessionId={sessionId}
                  onSessionClosed={() => { setJoined(null); setClosed(true); }} />
              )}
            </LiveKitRoom>
          </section>
        ) : (
          <section className={styles.lobby} aria-labelledby="classroom-title">
            <div className={styles.intro}>
              <span className={styles.eyebrow}><Radio size={15} /> Aula virtual integrada</span>
              <h1 id="classroom-title">Prepárate para una experiencia en vivo.</h1>
              <p>Comprueba tu cámara y micrófono antes de entrar. Tu participación queda vinculada a tu programa, sin salir de LUMA.</p>
              <div className={styles.guidance}>
                <ShieldCheck size={20} />
                <span>La cámara y el micrófono son opcionales al ingresar. La asistencia se registra mediante la conexión verificada, no como evidencia automática de dominio.</span>
              </div>
            </div>
            <div className={styles.prejoin}>
              <PreJoin
                defaults={{
                  username: user.displayName || "Participante",
                  audioEnabled: false,
                  videoEnabled: false,
                }}
                persistUserChoices={false}
                joinLabel={connecting ? "Conectando…" : "Entrar a mi aula"}
                micLabel="Micrófono"
                camLabel="Cámara"
                userLabel="Nombre en el aula"
                onValidate={() => !connecting}
                onSubmit={(choices) => void enterClassroom(choices)}
                onError={() => setError("Revisa los permisos de cámara y micrófono del navegador.")}
              />
              <p className={styles.identityNote}>Tu nombre de identificación se obtiene de tu cuenta LUMA.</p>
            </div>
          </section>
        )}
      {error && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => setError("")}>Cerrar</button></div>}
      <footer className={styles.footer}>LUMA · Seres de Excelencia · Aula virtual profesional</footer>
    </main>
  );
}
