import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge, type TurnoStatus } from "@/components/StatusBadge";
import { useState, useMemo } from "react";
import { getDashboardData, cancelarTurno, type TurnoRow, type WaitlistRow } from "@/utils/dashboard.functions";

export const Route = createFileRoute("/")({
  validateSearch: (search) => ({
    fecha: (search.fecha as string) || new Date().toISOString().split("T")[0],
  }),
  loaderDeps: ({ search: { fecha } }) => ({ fecha }),
  loader: ({ deps: { fecha } }) => getDashboardData({ data: { fecha } }),
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "TurnoOk — Dashboard" },
      { name: "description", content: "Dashboard de agenda y recupero automático de turnos" },
    ],
  }),
});

const statusDbToUi: Record<string, TurnoStatus> = {
  confirmado: "confirmed",
  pendiente: "pending",
  caido: "fallen",
  en_proceso: "process",
  cubierto: "covered",
  libre: "free",
  sin_cubrir: "fallen",
};

const accentMap: Record<TurnoStatus, string> = {
  confirmed: "accent-confirmed",
  pending: "accent-pending",
  fallen: "accent-fallen",
  process: "accent-process",
  covered: "accent-covered",
  free: "accent-free",
};

type FilterType = "all" | "fallen" | "process";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function Dashboard() {
  const data = Route.useLoaderData();
  const { fecha } = Route.useSearch();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const navigate = Route.useNavigate();

  const goToDate = (newFecha: string) => {
    navigate({ search: { fecha: newFecha } });
  };

  const filteredTurnos = useMemo(() => {
    return data.turnos.filter((t: TurnoRow) => {
      const uiStatus = statusDbToUi[t.status] || "free";
      if (filter === "all") return true;
      if (filter === "fallen") return uiStatus === "fallen";
      if (filter === "process") return uiStatus === "process";
      return true;
    });
  }, [data.turnos, filter]);

  const metrics = useMemo(() => {
    const total = data.turnos.length;
    const confirmados = data.turnos.filter((t: TurnoRow) => t.status === "confirmado").length;
    const caidos = data.turnos.filter((t: TurnoRow) => ["caido", "sin_cubrir"].includes(t.status)).length;
    const cubiertos = data.turnos.filter((t: TurnoRow) => t.status === "cubierto").length;
    return { total, confirmados, caidos, cubiertos };
  }, [data.turnos]);

  const handleCancelar = async (turnoId: string) => {
    setCancelingId(turnoId);
    try {
      await cancelarTurno({ data: { turnoId } });
      router.invalidate();
    } catch (e) {
      console.error(e);
    } finally {
      setCancelingId(null);
    }
  };

  const medicoLabel = data.medico
    ? `Dr. ${data.medico.nombre} ${data.medico.apellido} · ${data.medico.especialidad}`
    : "";

  return (
    <AppLayout rightPanel={<DashboardPanel waitlist={data.waitlist} turnos={data.turnos} />}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-medium text-foreground">Agenda del día</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(fecha)} · {data.turnos.length} turnos totales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToDate(addDays(fecha, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted"
          >
            ‹
          </button>
          <button
            onClick={() => goToDate(new Date().toISOString().split("T")[0])}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
              isToday(fecha)
                ? "border-teal bg-teal-lighter text-teal-dark"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => goToDate(addDays(fecha, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard label="Turnos confirmados" value={metrics.confirmados} sub={`de ${metrics.total} totales`} />
        <MetricCard label="Caídos hoy" value={metrics.caidos} sub="" valueColor="pending" />
        <MetricCard label="Recuperados hoy" value={metrics.cubiertos} sub={`$${(metrics.cubiertos * 40000).toLocaleString("es-AR")} recuperados`} valueColor="teal" />
        <MetricCard label="En proceso" value={data.turnos.filter((t: TurnoRow) => t.status === "en_proceso").length} sub="Buscando reemplazo" valueColor="default" />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-[13px] font-medium text-foreground">Turnos</span>
          <div className="flex gap-1.5">
            {([["all", "Todos"], ["fallen", "Caídos"], ["process", "En proceso"]] as const).map(
              ([key, label]) => (
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
              )
            )}
          </div>
        </div>

        {filteredTurnos.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay turnos con este filtro
          </div>
        ) : (
          filteredTurnos.map((turno: TurnoRow) => {
            const uiStatus = statusDbToUi[turno.status] || "free";
            const accent = accentMap[uiStatus];
            const pacienteName = turno.paciente
              ? `${turno.paciente.nombre} ${turno.paciente.apellido}`
              : turno.status === "libre" ? "—" : "Turno libre";

            const detail = buildDetail(turno);

            return (
              <div
                key={turno.id}
                className="flex items-center border-b border-border last:border-b-0 hover:bg-muted/50"
              >
                <div className="w-[60px] shrink-0 py-3 pl-4 text-xs font-medium text-foreground">
                  {turno.hora.slice(0, 5)}
                </div>
                <div className={`h-12 w-[3px] shrink-0 ${accent}`} />
                <div className="min-w-0 flex-1 px-3.5 py-2.5">
                  <div className="truncate text-[13px] font-medium text-foreground">{pacienteName}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</div>
                </div>
                <div className="shrink-0 px-3">
                  <StatusBadge status={uiStatus} />
                </div>
                <div className="shrink-0 pr-3.5">
                  <TurnoActions turno={turno} uiStatus={uiStatus} onCancel={handleCancelar} canceling={cancelingId === turno.id} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}

function buildDetail(turno: TurnoRow): string {
  const parts: string[] = [];
  if (turno.paciente?.obra_social) parts.push(turno.paciente.obra_social);
  else if (turno.paciente) parts.push("Particular");

  if (turno.status === "cubierto" && turno.cubierto_por) {
    parts.push(`Cubierto por ${turno.cubierto_por.nombre} ${turno.cubierto_por.apellido}`);
  } else if (turno.status === "en_proceso" && turno.cancelado_at) {
    parts.push("Notificando lista de espera");
  } else if (turno.status === "sin_cubrir") {
    parts.push("Notificaciones enviadas sin respuesta");
  } else if (turno.motivo) {
    parts.push(turno.motivo);
  }

  return parts.join(" · ") || "Sin turno asignado";
}

function TurnoActions({
  turno,
  uiStatus,
  onCancel,
  canceling,
}: {
  turno: TurnoRow;
  uiStatus: TurnoStatus;
  onCancel: (id: string) => void;
  canceling: boolean;
}) {
  if (uiStatus === "process") {
    return (
      <Link
        to="/notificaciones/turno-0900"
        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted"
      >
        Ver estado
      </Link>
    );
  }

  if (uiStatus === "confirmed" || uiStatus === "pending") {
    return (
      <button
        onClick={() => onCancel(turno.id)}
        disabled={canceling}
        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted disabled:opacity-50"
      >
        {canceling ? "Cancelando..." : "Cancelar"}
      </button>
    );
  }

  if (uiStatus === "fallen") {
    return (
      <button className="rounded-md border border-teal bg-teal-lighter px-2.5 py-1 text-[11px] text-teal-dark whitespace-nowrap">
        Reintentar
      </button>
    );
  }

  if (uiStatus === "free") {
    return (
      <button className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted">
        + Asignar
      </button>
    );
  }

  return null;
}

function DashboardPanel({ waitlist, turnos }: { waitlist: WaitlistRow[]; turnos: TurnoRow[] }) {
  const enProceso = turnos.filter((t) => t.status === "en_proceso");
  const cubiertos = turnos.filter((t) => t.status === "cubierto");

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "En espera desde hoy";
    if (days === 1) return "En espera desde ayer";
    return `En espera desde hace ${days} días`;
  }

  return (
    <>
      {/* Waitlist */}
      <div className="mb-5">
        <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lista de espera activa
        </div>
        {waitlist.slice(0, 3).map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 border-b border-border py-2 last:border-b-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-process-bg text-[10px] font-medium text-status-process">
              {item.paciente.nombre[0]}{item.paciente.apellido[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">
                {item.paciente.nombre} {item.paciente.apellido}
              </div>
              <div className="text-[10px] text-muted-foreground">{timeAgo(item.fecha_registro)}</div>
            </div>
            <span className="text-[11px] text-muted-foreground">#{i + 1}</span>
          </div>
        ))}
        {waitlist.length > 3 && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            +{waitlist.length - 3} más en lista
          </div>
        )}
      </div>

      {/* Active notifications */}
      {(enProceso.length > 0 || cubiertos.length > 0) && (
        <div className="mb-5">
          <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Estado de recupero
          </div>
          {enProceso.map((t) => (
            <Link
              key={t.id}
              to="/notificaciones/turno-0900"
              className="mb-2 block rounded-lg border border-status-process bg-status-process-bg p-2.5 transition-colors hover:opacity-90"
            >
              <div className="text-xs font-medium text-status-process">
                Turno {t.hora.slice(0, 5)} — buscando paciente
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Notificando lista de espera
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border">
                <div className="h-full w-[55%] rounded-full bg-status-process animate-pulse-soft" />
              </div>
            </Link>
          ))}
          {cubiertos.map((t) => (
            <div key={t.id} className="mb-2 rounded-lg border border-status-covered bg-status-covered-bg p-2.5">
              <div className="text-xs font-medium text-status-covered">
                Turno {t.hora.slice(0, 5)} — cubierto
                {t.cubierto_por ? ` por ${t.cubierto_por.nombre} ${t.cubierto_por.apellido[0]}.` : ""}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {t.cubierto_at ? `Confirmado ${new Date(t.cubierto_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

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
