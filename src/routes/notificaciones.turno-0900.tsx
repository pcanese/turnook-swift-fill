import { createFileRoute, Link } from "@tanstack/react-router";
import { AppTopbar } from "@/components/AppTopbar";
import { useState, useEffect, useCallback } from "react";

export const Route = createFileRoute("/notificaciones/turno-0900")({
  component: NotificationLog,
  head: () => ({
    meta: [
      { title: "TurnoOk — Log de notificaciones" },
      { name: "description", content: "Seguimiento en tiempo real de notificaciones enviadas" },
    ],
  }),
});

type StepState = "pending" | "done" | "ok" | "no" | "off";

type PatientCard = {
  initials: string;
  name: string;
  sub: string;
  position: number;
  avatarColor: string;
  steps: StepState[];
  winText?: string;
  dimmed?: boolean;
};

type LogEntry = {
  time: string;
  color: string;
  text: string;
};

const initialPatients: PatientCard[] = [
  { initials: "SR", name: "Sandra Rivas", sub: "OSDE 210 · En lista hace 3 días", position: 1, avatarColor: "bg-teal-lighter text-teal-dark", steps: ["done", "pending", "pending", "pending"] },
  { initials: "PM", name: "Pablo Morales", sub: "Galeno · En lista hace 5 días", position: 2, avatarColor: "bg-status-process-bg text-status-process", steps: ["done", "pending", "pending", "pending"] },
  { initials: "LC", name: "Laura Correia", sub: "Swiss Medical · En lista desde ayer", position: 3, avatarColor: "bg-status-pending-bg text-status-pending", steps: ["done", "pending", "pending", "pending"] },
];

const initialLogs: LogEntry[] = [
  { time: "08:47", color: "bg-status-fallen", text: "<b>Claudia F.</b> canceló el turno" },
  { time: "08:47", color: "bg-status-process", text: "Sistema generó lista priorizada" },
  { time: "08:47", color: "bg-status-process", text: "Notificación enviada a <b>3 pacientes</b>" },
];

const stepLabels = ["Enviado", "Entregado", "Leído", "Respuesta"];

function NotificationLog() {
  const [patients, setPatients] = useState(initialPatients);
  const [logs, setLogs] = useState(initialLogs);
  const [timer, setTimer] = useState(598);
  const [done, setDone] = useState(false);
  const [overallStatus, setOverallStatus] = useState<"searching" | "covered">("searching");
  const [simProgress, setSimProgress] = useState(0);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  // Simulation sequence
  useEffect(() => {
    const steps = [
      { t: 1500, fn: () => { updateStep(0, 1, "done"); addLog({ time: "08:48", color: "bg-status-process-bg", text: "Entregado a <b>Sandra R.</b>" }); setSimProgress(14); }},
      { t: 2800, fn: () => { updateStep(0, 2, "done"); addLog({ time: "08:48", color: "bg-status-process", text: "<b>Sandra R.</b> abrió el mensaje" }); setSimProgress(28); }},
      { t: 3800, fn: () => { updateStep(1, 1, "done"); addLog({ time: "08:48", color: "bg-status-process-bg", text: "Entregado a <b>Pablo M.</b>" }); setSimProgress(42); }},
      { t: 5000, fn: () => { updateStep(1, 2, "done"); addLog({ time: "08:49", color: "bg-status-process", text: "<b>Pablo M.</b> abrió el mensaje" }); setSimProgress(56); }},
      { t: 6200, fn: () => { updateStep(2, 1, "done"); addLog({ time: "08:49", color: "bg-status-process-bg", text: "Entregado a <b>Laura C.</b>" }); setSimProgress(70); }},
      { t: 8000, fn: () => {
        updateStep(0, 3, "ok");
        addLog({ time: "08:49", color: "bg-teal", text: "<b>Sandra R.</b> confirmó — turno cubierto" });
        setSimProgress(85);
        setTimeout(() => {
          setPatients((prev) =>
            prev.map((p, i) =>
              i === 0
                ? { ...p, steps: p.steps.map((s, j) => j === 3 ? "ok" as StepState : s), winText: "Sandra confirmó — turno cubierto" }
                : { ...p, steps: p.steps.map((s, j) => j === 3 ? "off" as StepState : s), dimmed: true }
            )
          );
          setOverallStatus("covered");
          setDone(true);
          setSimProgress(100);
          addLog({ time: "08:49", color: "bg-muted-foreground", text: "Pablo M. y Laura C.: turno tomado" });
        }, 800);
      }},
    ];

    const timeouts = steps.map((step) => setTimeout(step.fn, step.t));
    return () => timeouts.forEach(clearTimeout);
  }, [addLog]);

  function updateStep(patientIdx: number, stepIdx: number, state: StepState) {
    setPatients((prev) =>
      prev.map((p, i) =>
        i === patientIdx
          ? { ...p, steps: p.steps.map((s, j) => (j === stepIdx ? state : s)) }
          : p
      )
    );
  }

  // Timer countdown
  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => {
      setTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [done]);

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;
  const timerPercent = Math.round((timer / 600) * 100);
  const timerColor = timer > 300 ? "bg-status-process" : timer > 120 ? "bg-status-pending" : "bg-status-fallen";

  return (
    <div className="flex min-h-screen flex-col">
      <AppTopbar backLink={{ label: "Agenda", href: "/" }} />

      {/* Context bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-status-fallen bg-status-fallen-bg px-3 py-1 text-[13px] font-medium text-status-fallen">
            09:00
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">
              Claudia Fernández canceló su turno
            </div>
            <div className="text-xs text-muted-foreground">
              Hoy a las 08:47 · Swiss Medical · Control cardiológico
            </div>
          </div>
        </div>
        <span
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
            overallStatus === "searching"
              ? "border-status-process bg-status-process-bg text-status-process"
              : "border-status-covered bg-status-covered-bg text-status-covered"
          }`}
        >
          {overallStatus === "searching" ? "Buscando reemplazo..." : "Turno cubierto por Sandra R."}
        </span>
      </div>

      {/* Main grid */}
      <div className="flex flex-1">
        {/* Patient cards */}
        <div className="flex-1 border-r border-border p-5">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Pacientes notificados — 3 en lista
          </div>
          {patients.map((patient) => (
            <PatientTracker key={patient.initials} patient={patient} />
          ))}
        </div>

        {/* Right panel */}
        <div className="hidden w-[260px] shrink-0 flex-col gap-3.5 p-4 lg:flex">
          {/* Timer */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Tiempo restante</span>
              <span className="text-[11px] text-muted-foreground">mismo día</span>
            </div>
            <div className={`text-center text-[28px] font-medium tabular-nums ${timer < 120 ? "text-status-fallen" : "text-foreground"}`}>
              {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            <div className="mb-1.5 mt-2 h-[5px] overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all duration-500 ${timerColor}`} style={{ width: `${timerPercent}%` }} />
            </div>
            <div className="text-center text-[11px] text-muted-foreground">
              {done ? "Proceso completado" : "Si nadie confirma, se notifica al médico"}
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
                  <span className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: log.text.replace(/<b>/g, '<span class="font-medium text-foreground">').replace(/<\/b>/g, '</span>') }} />
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

      {/* Simulation bar */}
      <div className="flex items-center gap-3 border-t border-border bg-muted px-5 py-2.5">
        <span className="text-xs text-muted-foreground">
          {done ? "Simulación completada" : "Simulando respuestas en tiempo real"}
        </span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-teal transition-all duration-300" style={{ width: `${simProgress}%` }} />
        </div>
        <Link
          to="/"
          className="rounded-md border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
        >
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}

function PatientTracker({ patient }: { patient: PatientCard }) {
  return (
    <div
      className={`mb-2.5 rounded-xl border bg-card p-4 transition-all ${
        patient.winText
          ? "border-teal bg-teal-lighter/30"
          : patient.dimmed
            ? "border-border opacity-50"
            : "border-border"
      }`}
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${patient.avatarColor}`}>
          {patient.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">{patient.name}</div>
          <div className="text-[11px] text-muted-foreground">{patient.sub}</div>
        </div>
        <span className="text-[11px] text-muted-foreground">#{patient.position} en lista</span>
      </div>

      {/* Progress track */}
      <div className="flex items-center">
        {patient.steps.map((step, i) => (
          <div key={i} className={`flex items-center ${i < patient.steps.length - 1 ? "flex-1" : ""}`}>
            <StepDot state={step} />
            {i < patient.steps.length - 1 && (
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
              patient.steps[i] === "done" ? "text-teal-dark" :
              patient.steps[i] === "ok" ? "font-medium text-status-covered" :
              patient.steps[i] === "no" ? "text-status-fallen" :
              "text-muted-foreground"
            }`}
          >
            {patient.steps[i] === "ok" ? "Confirmó" : patient.steps[i] === "off" ? "Turno tomado" : label}
          </span>
        ))}
      </div>

      {/* Win banner */}
      {patient.winText && (
        <div className="mt-2.5 flex items-center gap-2 rounded-md bg-teal-lighter px-3 py-1.5 text-xs font-medium text-teal-dark">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 7l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {patient.winText}
        </div>
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
