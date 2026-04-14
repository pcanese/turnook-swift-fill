import { createFileRoute, Link } from "@tanstack/react-router";
import { AppTopbar } from "@/components/AppTopbar";
import { useState, useEffect, useCallback } from "react";
import {
  getNotificaciones,
  confirmarTurno,
  type NotificacionRow,
  type TurnoNotifContext,
} from "@/utils/notificaciones.functions";

export const Route = createFileRoute("/notificaciones/$turnoId")({
  loader: ({ params }) => getNotificaciones({ data: { turnoId: params.turnoId } }),
  component: NotificationLog,
  head: () => ({
    meta: [
      { title: "TurnoOk — Log de notificaciones" },
      { name: "description", content: "Seguimiento en tiempo real de notificaciones enviadas" },
    ],
  }),
});

const estadoStepMap: Record<string, number> = {
  enviado: 0,
  entregado: 1,
  leido: 2,
  confirmado: 3,
  rechazado: 3,
  expirado: 3,
  cancelado: 3,
};

const stepLabels = ["Enviado", "Entregado", "Leído", "Respuesta"];

type StepState = "pending" | "done" | "ok" | "no" | "off";

function getSteps(notif: NotificacionRow): StepState[] {
  const currentStep = estadoStepMap[notif.estado] ?? 0;
  return stepLabels.map((_, i) => {
    if (notif.estado === "confirmado" && i === 3) return "ok";
    if (notif.estado === "rechazado" && i === 3) return "no";
    if ((notif.estado === "expirado" || notif.estado === "cancelado") && i === 3) return "off";
    if (notif.estado === "cancelado" && i > currentStep) return "off";
    if (i <= currentStep) return "done";
    return "pending";
  });
}

function NotificationLog() {
  const initialData = Route.useLoaderData();
  const { turnoId } = Route.useParams();
  const [data, setData] = useState(initialData);
  const { turno, notificaciones } = data;

  // Poll every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getNotificaciones({ data: { turnoId } });
        setData(fresh);
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [turnoId]);

  const timerExpira = notificaciones[0]?.timer_expira_at;
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!timerExpira) return;
    const calc = () => Math.max(0, Math.floor((new Date(timerExpira).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());
    const interval = setInterval(() => setSecondsLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [timerExpira]);

  const isCovered = turno?.status === "cubierto";
  const isExpired = secondsLeft <= 0 && !isCovered;
  const confirmedNotif = notificaciones.find((n: NotificacionRow) => n.estado === "confirmado");

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerTotal = 10 * 60;
  const timerPercent = Math.round((secondsLeft / timerTotal) * 100);
  const timerColor = secondsLeft > 300 ? "bg-status-process" : secondsLeft > 120 ? "bg-status-pending" : "bg-status-fallen";

  const handleSimConfirm = useCallback(async (notif: NotificacionRow) => {
    try {
      await confirmarTurno({ data: { notificacionId: notif.id, turnoId, pacienteId: notif.paciente.id } });
      const fresh = await getNotificaciones({ data: { turnoId } });
      setData(fresh);
    } catch (e) {
      console.error("Error confirming:", e);
    }
  }, [turnoId]);

  const originalName = turno?.paciente_original
    ? `${turno.paciente_original.nombre} ${turno.paciente_original.apellido}`
    : "Paciente";

  const overallStatus = isCovered
    ? `Turno cubierto por ${confirmedNotif?.paciente.nombre} ${confirmedNotif?.paciente.apellido[0]}.`
    : isExpired
      ? "Timer expirado — sin respuesta"
      : "Buscando reemplazo...";

  const statusClass = isCovered
    ? "border-status-covered bg-status-covered-bg text-status-covered"
    : isExpired
      ? "border-status-fallen bg-status-fallen-bg text-status-fallen"
      : "border-status-process bg-status-process-bg text-status-process";

  // Build log entries from notificaciones
  const logs = buildLogs(notificaciones, turno);

  return (
    <div className="flex min-h-screen flex-col">
      <AppTopbar backLink={{ label: "Agenda", href: "/" }} />

      {/* Context bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-status-fallen bg-status-fallen-bg px-3 py-1 text-[13px] font-medium text-status-fallen">
            {turno?.hora?.slice(0, 5) || "--:--"}
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">
              {originalName} canceló su turno
            </div>
            <div className="text-xs text-muted-foreground">
              {turno?.cancelado_at
                ? `Hoy a las ${new Date(turno.cancelado_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </div>
          </div>
        </div>
        <span className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${statusClass}`}>
          {overallStatus}
        </span>
      </div>

      {/* Main grid */}
      <div className="flex flex-1">
        {/* Patient cards */}
        <div className="flex-1 border-r border-border p-5">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Pacientes notificados — {notificaciones.length} en lista
          </div>
          {notificaciones.map((notif: NotificacionRow) => (
            <PatientTracker
              key={notif.id}
              notif={notif}
              isCovered={isCovered}
              confirmedId={confirmedNotif?.id}
              onSimConfirm={handleSimConfirm}
            />
          ))}
          {notificaciones.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay notificaciones para este turno
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="hidden w-[260px] shrink-0 flex-col gap-3.5 p-4 lg:flex">
          {/* Timer */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Tiempo restante</span>
              <span className="text-[11px] text-muted-foreground">10 min</span>
            </div>
            <div className={`text-center text-[28px] font-medium tabular-nums ${secondsLeft < 120 ? "text-status-fallen" : "text-foreground"}`}>
              {isCovered ? "✓" : `${minutes}:${seconds.toString().padStart(2, "0")}`}
            </div>
            <div className="mb-1.5 mt-2 h-[5px] overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all duration-500 ${timerColor}`} style={{ width: `${isCovered ? 100 : timerPercent}%` }} />
            </div>
            <div className="text-center text-[11px] text-muted-foreground">
              {isCovered ? "Turno cubierto" : isExpired ? "Timer expirado" : "Si nadie confirma, se notifica al médico"}
            </div>
          </div>

          {/* Activity log */}
          <div className="flex-1 rounded-xl border border-border bg-card p-4">
            <div className="mb-2.5 text-xs font-medium text-foreground">Actividad en tiempo real</div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 text-xs leading-relaxed">
                  <span className="shrink-0 text-[11px] text-muted-foreground">{log.time}</span>
                  <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${log.color}`} />
                  <span
                    className="text-muted-foreground"
                    dangerouslySetInnerHTML={{
                      __html: log.text
                        .replace(/<b>/g, '<span class="font-medium text-foreground">')
                        .replace(/<\/b>/g, "</span>"),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Manual actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2.5 text-xs font-medium text-foreground">Acciones manuales</div>
            {["+ Notificar más pacientes", "Pausar búsqueda", "Marcar como libre"].map((label) => (
              <button
                key={label}
                className="mb-1.5 w-full rounded-md border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors last:mb-0 hover:bg-muted"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildLogs(notificaciones: NotificacionRow[], turno: TurnoNotifContext | null) {
  const logs: { time: string; color: string; text: string }[] = [];

  if (turno?.cancelado_at) {
    const t = new Date(turno.cancelado_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const name = turno.paciente_original
      ? `${turno.paciente_original.nombre} ${turno.paciente_original.apellido[0]}.`
      : "Paciente";
    logs.push({ time: t, color: "bg-status-fallen", text: `<b>${name}</b> canceló el turno` });
  }

  if (notificaciones.length > 0) {
    const t = new Date(notificaciones[0].created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    logs.push({ time: t, color: "bg-status-process", text: "Sistema generó lista priorizada" });
    logs.push({ time: t, color: "bg-status-process", text: `Notificación enviada a <b>${notificaciones.length} pacientes</b>` });
  }

  for (const n of notificaciones) {
    const name = `${n.paciente.nombre} ${n.paciente.apellido[0]}.`;
    if (n.estado === "entregado" || estadoStepMap[n.estado] > 1) {
      logs.push({ time: "", color: "bg-status-process-bg", text: `Entregado a <b>${name}</b>` });
    }
    if (n.estado === "leido" || estadoStepMap[n.estado] > 2) {
      logs.push({ time: "", color: "bg-status-process", text: `<b>${name}</b> abrió el mensaje` });
    }
    if (n.estado === "confirmado") {
      logs.push({ time: "", color: "bg-teal", text: `<b>${name}</b> confirmó — turno cubierto` });
    }
    if (n.estado === "rechazado") {
      logs.push({ time: "", color: "bg-status-fallen", text: `<b>${name}</b> rechazó el turno` });
    }
    if (n.estado === "expirado") {
      logs.push({ time: "", color: "bg-muted-foreground", text: `<b>${name}</b> no respondió (expirado)` });
    }
  }

  return logs;
}

function PatientTracker({
  notif,
  isCovered,
  confirmedId,
  onSimConfirm,
}: {
  notif: NotificacionRow;
  isCovered: boolean;
  confirmedId?: string;
  onSimConfirm: (n: NotificacionRow) => void;
}) {
  const steps = getSteps(notif);
  const isWinner = notif.id === confirmedId;
  const isDimmed = isCovered && !isWinner;
  const initials = `${notif.paciente.nombre[0]}${notif.paciente.apellido[0]}`;

  const avatarColors = [
    "bg-teal-lighter text-teal-dark",
    "bg-status-process-bg text-status-process",
    "bg-status-pending-bg text-status-pending",
  ];

  return (
    <div
      className={`mb-2.5 rounded-xl border bg-card p-4 transition-all ${
        isWinner
          ? "border-teal bg-teal-lighter/30"
          : isDimmed
            ? "border-border opacity-50"
            : "border-border"
      }`}
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${avatarColors[(notif.orden - 1) % avatarColors.length]}`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">
            {notif.paciente.nombre} {notif.paciente.apellido}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {notif.paciente.obra_social || "Particular"}
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">#{notif.orden} en lista</span>
      </div>

      {/* Progress track */}
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={i} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <StepDot state={step} />
            {i < steps.length - 1 && (
              <div className={`h-px flex-1 transition-colors ${step === "done" || step === "ok" ? "bg-teal" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between">
        {stepLabels.map((label, i) => (
          <span
            key={label}
            className={`flex-1 text-center text-[10px] transition-colors ${
              steps[i] === "done" ? "text-teal-dark" :
              steps[i] === "ok" ? "font-medium text-status-covered" :
              steps[i] === "no" ? "text-status-fallen" :
              "text-muted-foreground"
            }`}
          >
            {steps[i] === "ok" ? "Confirmó" : steps[i] === "off" ? "Turno tomado" : label}
          </span>
        ))}
      </div>

      {/* Win banner */}
      {isWinner && (
        <div className="mt-2.5 flex items-center gap-2 rounded-md bg-teal-lighter px-3 py-1.5 text-xs font-medium text-teal-dark">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 7l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {notif.paciente.nombre} confirmó — turno cubierto
        </div>
      )}

      {/* Mock confirm button (for testing) */}
      {!isCovered && notif.estado === "enviado" && (
        <button
          onClick={() => onSimConfirm(notif)}
          className="mt-2.5 w-full rounded-md border border-teal bg-teal-lighter px-3 py-1.5 text-xs font-medium text-teal-dark hover:opacity-90"
        >
          🧪 Simular confirmación
        </button>
      )}
    </div>
  );
}

function StepDot({ state }: { state: StepState }) {
  const base = "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10px] transition-all";
  const styles: Record<StepState, string> = {
    pending: `${base} border-border bg-muted text-muted-foreground`,
    done: `${base} border-teal bg-teal-lighter text-teal-dark`,
    ok: `${base} border-status-covered bg-status-covered-bg text-status-covered`,
    no: `${base} border-status-fallen bg-status-fallen-bg text-status-fallen`,
    off: `${base} border-border bg-muted text-muted-foreground`,
  };

  return (
    <div className={styles[state]}>
      {state === "done" || state === "ok" ? (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : state === "no" ? (
        "✕"
      ) : state === "off" ? (
        "—"
      ) : (
        "···"
      )}
    </div>
  );
}
