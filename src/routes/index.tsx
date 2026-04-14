import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge, type TurnoStatus } from "@/components/StatusBadge";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "TurnoOk — Dashboard" },
      { name: "description", content: "Dashboard de agenda y recupero automático de turnos" },
    ],
  }),
});

type Turno = {
  time: string;
  name: string;
  detail: string;
  status: TurnoStatus;
  accent: string;
  action?: { label: string; primary?: boolean; href?: string };
};

const turnos: Turno[] = [
  { time: "08:00", name: "Ana Rodríguez", detail: "OSDE 210 · Control cardiológico", status: "confirmed", accent: "accent-confirmed" },
  { time: "08:30", name: "Jorge Méndez", detail: "Particular · Ecocardiograma", status: "confirmed", accent: "accent-confirmed" },
  { time: "09:00", name: "Claudia Fernández", detail: "Swiss Medical · Canceló 08:47 — notificando lista de espera", status: "process", accent: "accent-process", action: { label: "Ver estado", href: "/notificaciones/turno-0900" } },
  { time: "09:30", name: "Roberto Suárez", detail: "OSDE 410 · Primera consulta", status: "confirmed", accent: "accent-confirmed" },
  { time: "10:00", name: "María Castro", detail: "Galeno · Cubrió el turno de las 09:30 cancelado ayer", status: "covered", accent: "accent-covered" },
  { time: "10:30", name: "Turno libre", detail: "No-show · Notificaciones enviadas sin respuesta", status: "fallen", accent: "accent-fallen", action: { label: "Reintentar", primary: true } },
  { time: "11:00", name: "Luis Herrera", detail: "Particular · Pendiente de confirmación", status: "pending", accent: "accent-pending" },
  { time: "11:30", name: "—", detail: "Sin turno asignado", status: "free", accent: "accent-free", action: { label: "+ Asignar" } },
];

const waitlist = [
  { initials: "SR", name: "Sandra Rivas", since: "En espera desde hace 3 días" },
  { initials: "PM", name: "Pablo Morales", since: "En espera desde hace 5 días" },
  { initials: "LC", name: "Laura Correia", since: "En espera desde ayer" },
];

type FilterType = "all" | "fallen" | "process";

function Dashboard() {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredTurnos = turnos.filter((t) => {
    if (filter === "all") return true;
    if (filter === "fallen") return t.status === "fallen";
    if (filter === "process") return t.status === "process";
    return true;
  });

  return (
    <AppLayout
      rightPanel={
        <DashboardPanel />
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-medium text-foreground">Agenda del día</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Martes 15 de abril · 18 turnos totales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted">
            ‹
          </button>
          <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
            Hoy
          </span>
          <button className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted">
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard label="Turnos confirmados" value={11} sub="de 18 totales" />
        <MetricCard label="Caídos hoy" value={3} sub="2 con aviso · 1 no-show" valueColor="pending" />
        <MetricCard label="Recuperados hoy" value={2} sub="$80.000 recuperados" valueColor="teal" />
        <MetricCard label="Recuperados este mes" value={14} sub="$560.000 recuperados" valueColor="teal" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-foreground">Turnos</span>
          <div className="flex gap-1.5">
            {([
              ["all", "Todos"],
              ["fallen", "Caídos"],
              ["process", "En proceso"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                  filter === key
                    ? "border-teal bg-teal-lighter text-teal-dark"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredTurnos.map((turno) => (
          <div
            key={turno.time}
            className="flex items-center border-b border-border last:border-b-0 hover:bg-muted/50"
          >
            <div className="w-[60px] shrink-0 py-3 pl-4 text-xs font-medium text-foreground">
              {turno.time}
            </div>
            <div className={`h-12 w-[3px] shrink-0 ${turno.accent}`} />
            <div className="flex-1 px-3.5 py-2.5">
              <div className="text-[13px] font-medium text-foreground">{turno.name}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{turno.detail}</div>
            </div>
            <div className="shrink-0 px-3">
              <StatusBadge status={turno.status} />
            </div>
            {turno.action && (
              <div className="shrink-0 pr-3.5">
                {turno.action.href ? (
                  <Link
                    to={turno.action.href}
                    className={`rounded-md border px-2.5 py-1 text-[11px] whitespace-nowrap ${
                      turno.action.primary
                        ? "border-teal bg-teal-lighter text-teal-dark"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {turno.action.label}
                  </Link>
                ) : (
                  <button
                    className={`rounded-md border px-2.5 py-1 text-[11px] whitespace-nowrap ${
                      turno.action.primary
                        ? "border-teal bg-teal-lighter text-teal-dark"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {turno.action.label}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  );
}

function DashboardPanel() {
  return (
    <>
      {/* Waitlist */}
      <div className="mb-5">
        <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lista de espera activa
        </div>
        {waitlist.map((p, i) => (
          <div key={p.initials} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-process-bg text-[10px] font-medium text-status-process">
              {p.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">{p.name}</div>
              <div className="text-[10px] text-muted-foreground">{p.since}</div>
            </div>
            <span className="text-[11px] text-muted-foreground">#{i + 1}</span>
          </div>
        ))}
        <div className="mt-2 text-[11px] text-muted-foreground">+4 más en lista</div>
      </div>

      {/* Active notification */}
      <div className="mb-5">
        <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Notificación en curso
        </div>
        <Link
          to="/notificaciones/turno-0900"
          className="mb-2 block rounded-lg border border-status-process bg-status-process-bg p-2.5 transition-colors hover:opacity-90"
        >
          <div className="text-xs font-medium text-status-process">
            Turno 09:00 — buscando paciente
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Enviado a 3 pacientes · hace 4 min
          </div>
          <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border">
            <div className="h-full w-[55%] rounded-full bg-status-process animate-pulse-soft" />
          </div>
        </Link>
        <div className="rounded-lg border border-status-covered bg-status-covered-bg p-2.5">
          <div className="text-xs font-medium text-status-covered">
            Turno 10:00 — cubierto por M. Castro
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            Confirmado hoy a las 08:12
          </div>
        </div>
      </div>

      {/* Monthly stats */}
      <div>
        <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Resumen del mes
        </div>
        {[
          { label: "Turnos caídos", value: "38" },
          { label: "Recuperados", value: "14", green: true },
          { label: "Tasa de recupero", value: "37%", green: true },
          { label: "$ recuperado", value: "$560.000", green: true },
        ].map((stat) => (
          <div key={stat.label} className="flex justify-between border-b border-border py-1.5 text-xs last:border-b-0">
            <span className="text-muted-foreground">{stat.label}</span>
            <span className={`font-medium ${stat.green ? "text-teal-dark" : "text-foreground"}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
