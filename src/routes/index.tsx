import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge, type TurnoStatus } from "@/components/StatusBadge";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  getDashboardData,
  cancelarTurno,
  marcarLibre,
  searchPacientes,
  asignarPaciente,
  type TurnoRow,
  type WaitlistRow,
  type MonthlyMetrics,
} from "@/utils/dashboard.functions";
import { procesarExpiraciones } from "@/utils/notificaciones.functions";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  validateSearch: (search) => ({
    fecha: (search.fecha as string) || new Date().toISOString().split("T")[0],
    banner: (search.banner as string) || undefined,
    bannerHora: (search.bannerHora as string) || undefined,
    bannerPaciente: (search.bannerPaciente as string) || undefined,
  }),
  loaderDeps: ({ search: { fecha } }) => ({ fecha }),
  loader: ({ deps: { fecha } }) => getDashboardData({ data: { fecha } }),
  component: Dashboard,
  pendingComponent: DashboardSkeleton,
  errorComponent: DashboardError,
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
  caido: "caido",
  en_proceso: "process",
  cubierto: "covered",
  libre: "free",
  sin_cubrir: "fallen",
};

function getTurnoUiStatus(turno: TurnoRow): TurnoStatus {
  if (turno.status === "en_proceso" && !turno.has_active_notifs) return "caido";
  return statusDbToUi[turno.status] || "free";
}

const accentMap: Record<TurnoStatus, string> = {
  confirmed: "accent-confirmed",
  pending: "accent-pending",
  fallen: "accent-fallen",
  caido: "accent-fallen",
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

type BannerState = {
  type: "cubierto" | "sin_cubrir";
  hora: string;
  paciente?: string;
  turnoId?: string;
} | null;

// Bug 9: Skeleton loader
function DashboardSkeleton() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </AppLayout>
  );
}

// Bug 9: Error component
function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-destructive">No se pudieron cargar los datos.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reintentar
        </button>
      </div>
    </AppLayout>
  );
}

function Dashboard() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { fecha } = search;
  const router = useRouter();
  const navigate = Route.useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);

  // Bug 11: Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ turnoId: string; nombre: string; hora: string } | null>(null);

  // Bug 1: Assignment modal state
  const [assignModal, setAssignModal] = useState<{ turnoId: string } | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignResults, setAssignResults] = useState<{ id: string; nombre: string; apellido: string; obra_social: string | null }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<string | null>(null);

  // Bug 10: Track dismissed banners in sessionStorage
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = sessionStorage.getItem("turnook_dismissed_banners");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Show cubierto banner from URL params (S09)
  useEffect(() => {
    if (search.banner === "cubierto" && search.bannerHora) {
      setBanner({
        type: "cubierto",
        hora: search.bannerHora,
        paciente: search.bannerPaciente,
      });
      navigate({ search: { fecha }, replace: true });
    }
  }, [search.banner, search.bannerHora, search.bannerPaciente, fecha, navigate]);

  // Auto-dismiss cubierto banner after 5s
  useEffect(() => {
    if (banner?.type === "cubierto") {
      const timeout = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [banner]);

  // Detect sin_cubrir turnos for S10 banner (Bug 10: skip dismissed)
  useEffect(() => {
    const sinCubrir = data.turnos.find(
      (t: TurnoRow) => t.status === "sin_cubrir" && !banner && !dismissedBanners.has(t.id)
    );
    if (sinCubrir) {
      setBanner({
        type: "sin_cubrir",
        hora: sinCubrir.hora.slice(0, 5),
        turnoId: sinCubrir.id,
      });
    }
  }, [data.turnos, dismissedBanners]);

  // Poll for expirations every 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await procesarExpiraciones();
        if (result.turnosSinCubrir > 0) {
          router.invalidate();
        }
      } catch (e) {
        console.error("Expiration check error:", e);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Bug 1: Search pacientes when typing
  useEffect(() => {
    if (!assignModal) return;
    const timer = setTimeout(async () => {
      setAssignLoading(true);
      try {
        const results = await searchPacientes({ data: { query: assignSearch } });
        setAssignResults(results);
      } catch {
        setAssignResults([]);
      } finally {
        setAssignLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [assignSearch, assignModal]);

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

  // Bug 11: Show confirmation dialog before canceling
  const requestCancel = (turno: TurnoRow) => {
    const nombre = turno.paciente ? `${turno.paciente.nombre} ${turno.paciente.apellido}` : "este paciente";
    setConfirmDialog({ turnoId: turno.id, nombre, hora: turno.hora.slice(0, 5) });
  };

  const handleCancelar = async (turnoId: string) => {
    setConfirmDialog(null);
    setCancelingId(turnoId);
    try {
      await cancelarTurno({ data: { turnoId } });
      toast.success("Turno cancelado. Buscando reemplazo...");
      router.invalidate();
    } catch (e) {
      toast.error("Ocurrió un error. Intentá de nuevo.");
      console.error(e);
    } finally {
      setCancelingId(null);
    }
  };

  // Bug 6: Reintentar connected to cancelarTurno
  const handleReintentar = useCallback(async (turnoId: string) => {
    setBanner(null);
    setCancelingId(turnoId);
    try {
      await cancelarTurno({ data: { turnoId } });
      toast.success("Reintentando búsqueda de reemplazo...");
      router.invalidate();
    } catch (e) {
      toast.error("Ocurrió un error. Intentá de nuevo.");
      console.error(e);
    } finally {
      setCancelingId(null);
    }
  }, [router]);

  const handleMarcarLibre = useCallback(async (turnoId: string) => {
    setBanner(null);
    try {
      await marcarLibre({ data: { turnoId } });
      toast.success("Turno marcado como libre.");
      router.invalidate();
    } catch (e) {
      toast.error("Ocurrió un error. Intentá de nuevo.");
      console.error(e);
    }
  }, [router]);

  // Bug 10: Dismiss and persist
  const handleDismissBanner = useCallback(() => {
    if (banner?.turnoId) {
      const newDismissed = new Set(dismissedBanners);
      newDismissed.add(banner.turnoId);
      setDismissedBanners(newDismissed);
      try {
        sessionStorage.setItem("turnook_dismissed_banners", JSON.stringify([...newDismissed]));
      } catch {}
    }
    setBanner(null);
  }, [banner, dismissedBanners]);

  // Bug 1: Handle assignment
  const handleAssign = async () => {
    if (!assignModal || !selectedPaciente) return;
    try {
      await asignarPaciente({ data: { turnoId: assignModal.turnoId, pacienteId: selectedPaciente } });
      toast.success("Paciente asignado al turno.");
      setAssignModal(null);
      setAssignSearch("");
      setSelectedPaciente(null);
      router.invalidate();
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.");
    }
  };

  const medicoLabel = data.medico
    ? `Dr. ${data.medico.nombre} ${data.medico.apellido} · ${data.medico.especialidad}`
    : "";

  return (
    <AppLayout rightPanel={<DashboardPanel waitlist={data.waitlist} turnos={data.turnos} monthlyMetrics={data.monthlyMetrics} />}>
      {/* S09 Banner — Turno cubierto */}
      {banner?.type === "cubierto" && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-status-covered bg-status-covered-bg px-4 py-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-status-covered">
              <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 9l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium text-status-covered">
              Turno de las {banner.hora} cubierto por {banner.paciente}.
            </span>
          </div>
          <button onClick={() => setBanner(null)} className="text-status-covered hover:opacity-70">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* S10 Banner — Hueco sin cubrir */}
      {banner?.type === "sin_cubrir" && (
        <div className="mb-3 rounded-lg border border-status-fallen bg-status-fallen-bg px-4 py-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-status-fallen">
                <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 5.5v4M9 12v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium text-status-fallen">
                No hubo confirmación. El turno de las {banner.hora} sigue disponible.
              </span>
            </div>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={() => banner.turnoId && handleReintentar(banner.turnoId)}
              className="rounded-md border border-teal bg-teal-lighter px-3 py-1.5 text-xs font-medium text-teal-dark hover:opacity-90"
            >
              Reintentar
            </button>
            <button
              onClick={() => banner.turnoId && handleMarcarLibre(banner.turnoId)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Marcar como libre
            </button>
            <button
              onClick={handleDismissBanner}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* Bug 2: Weekend message */}
      {data.isWeekend ? (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-medium text-foreground">Agenda del día</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(fecha)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => goToDate(addDays(fecha, -1))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted">‹</button>
              <button onClick={() => goToDate(new Date().toISOString().split("T")[0])} className={`rounded-md border px-2.5 py-1 text-xs font-medium ${isToday(fecha) ? "border-teal bg-teal-lighter text-teal-dark" : "border-border bg-card text-foreground hover:bg-muted"}`}>Hoy</button>
              <button onClick={() => goToDate(addDays(fecha, 1))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted">›</button>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🏖️</div>
            <p className="text-sm font-medium text-muted-foreground">No hay atención este día</p>
            <p className="mt-1 text-xs text-muted-foreground">Sábados y domingos no se atiende</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-base font-medium text-foreground">Agenda del día</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(fecha)} · {data.turnos.length} turnos totales
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => goToDate(addDays(fecha, -1))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted">‹</button>
              <button onClick={() => goToDate(new Date().toISOString().split("T")[0])} className={`rounded-md border px-2.5 py-1 text-xs font-medium ${isToday(fecha) ? "border-teal bg-teal-lighter text-teal-dark" : "border-border bg-card text-foreground hover:bg-muted"}`}>Hoy</button>
              <button onClick={() => goToDate(addDays(fecha, 1))} className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted">›</button>
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
                  : turno.status === "cubierto" && turno.cubierto_por
                    ? `${turno.cubierto_por.nombre} ${turno.cubierto_por.apellido}`
                    : turno.status === "libre" ? "—" : "Sin paciente";

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
                      <TurnoActions
                        turno={turno}
                        uiStatus={uiStatus}
                        onCancel={requestCancel}
                        onAssign={(turnoId) => { setAssignModal({ turnoId }); setAssignSearch(""); setSelectedPaciente(null); }}
                        canceling={cancelingId === turno.id}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Bug 11: Cancel confirmation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar turno?</DialogTitle>
            <DialogDescription>
              ¿Cancelar el turno de {confirmDialog?.nombre} a las {confirmDialog?.hora}? Esta acción iniciará la búsqueda de reemplazo automáticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Volver</Button>
            <Button variant="destructive" onClick={() => confirmDialog && handleCancelar(confirmDialog.turnoId)}>Sí, cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bug 1: Patient assignment modal */}
      <Dialog open={!!assignModal} onOpenChange={() => { setAssignModal(null); setAssignSearch(""); setSelectedPaciente(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar paciente</DialogTitle>
            <DialogDescription>Buscá y seleccioná un paciente para este turno.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Buscar por nombre o apellido..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {assignLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
            ) : assignResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Sin resultados</div>
            ) : (
              assignResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPaciente(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                    selectedPaciente === p.id ? "bg-teal-lighter" : ""
                  }`}
                >
                  <span className="font-medium text-foreground">{p.apellido}, {p.nombre}</span>
                  <span className="text-xs text-muted-foreground">{p.obra_social || "Particular"}</span>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignModal(null); setAssignSearch(""); setSelectedPaciente(null); }}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedPaciente}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    parts.push("Sin cubrir — ningún paciente confirmó");
  } else if (turno.motivo) {
    parts.push(turno.motivo);
  }

  return parts.join(" · ") || "Sin turno asignado";
}

function TurnoActions({
  turno,
  uiStatus,
  onCancel,
  onAssign,
  canceling,
}: {
  turno: TurnoRow;
  uiStatus: TurnoStatus;
  onCancel: (turno: TurnoRow) => void;
  onAssign: (turnoId: string) => void;
  canceling: boolean;
}) {
  if (uiStatus === "process") {
    return (
      <Link
        to="/notificaciones/$turnoId"
        params={{ turnoId: turno.id }}
        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted"
      >
        Ver estado
      </Link>
    );
  }

  if (uiStatus === "confirmed" || uiStatus === "pending") {
    return (
      <button
        onClick={() => onCancel(turno)}
        disabled={canceling}
        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted disabled:opacity-50"
      >
        {canceling ? "Cancelando..." : "Cancelar"}
      </button>
    );
  }

  if (uiStatus === "fallen" && turno.status === "sin_cubrir") {
    return (
      <Link
        to="/notificaciones/$turnoId"
        params={{ turnoId: turno.id }}
        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted"
      >
        Ver detalle
      </Link>
    );
  }

  if (uiStatus === "fallen") {
    return (
      <Link
        to="/notificaciones/$turnoId"
        params={{ turnoId: turno.id }}
        className="rounded-md border border-teal bg-teal-lighter px-2.5 py-1 text-[11px] text-teal-dark whitespace-nowrap"
      >
        Reintentar
      </Link>
    );
  }

  if (uiStatus === "free") {
    return (
      <button
        onClick={() => onAssign(turno.id)}
        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground whitespace-nowrap hover:bg-muted"
      >
        + Asignar
      </button>
    );
  }

  return null;
}

function DashboardPanel({ waitlist, turnos, monthlyMetrics }: { waitlist: WaitlistRow[]; turnos: TurnoRow[]; monthlyMetrics: MonthlyMetrics }) {
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
              to="/notificaciones/$turnoId"
              params={{ turnoId: t.id }}
              className="mb-2 block rounded-lg border border-status-process bg-status-process-bg p-2.5 transition-colors hover:opacity-90"
            >
              <div className="text-xs font-medium text-status-process">
                Turno {t.hora.slice(0, 5)} — buscando paciente
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">Notificando lista de espera</div>
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

      {/* Bug 7: Monthly stats from DB */}
      <div>
        <div className="mb-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Resumen del mes
        </div>
        {[
          { label: "Turnos caídos", value: String(monthlyMetrics.caidos) },
          { label: "Recuperados", value: String(monthlyMetrics.recuperados), green: true },
          { label: "Tasa de recupero", value: `${monthlyMetrics.tasa}%`, green: true },
          { label: "$ recuperado", value: `$${monthlyMetrics.montoRecuperado.toLocaleString("es-AR")}`, green: true },
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
