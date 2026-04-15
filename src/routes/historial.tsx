import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { getHistorialTurnos } from "@/utils/notificaciones.functions";

export const Route = createFileRoute("/historial")({
  loader: () => getHistorialTurnos(),
  component: HistorialPage,
  head: () => ({
    meta: [
      { title: "TurnoOk — Historial" },
      { name: "description", content: "Historial de turnos con estados finales" },
    ],
  }),
});

const statusLabel: Record<string, string> = {
  caido: "Caído",
  en_proceso: "En proceso",
  cubierto: "Cubierto",
  sin_cubrir: "Sin cubrir",
};

const statusBadge: Record<string, string> = {
  caido: "badge-fallen",
  en_proceso: "badge-process",
  cubierto: "badge-covered",
  sin_cubrir: "badge-fallen",
};

function HistorialPage() {
  const turnos = Route.useLoaderData();

  return (
    <AppLayout>
      <h1 className="text-base font-medium text-foreground">Historial de turnos</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">{turnos.length} turnos con actividad</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Hora</th>
              <th className="px-4 py-2.5 font-medium">Paciente original</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Cubierto por</th>
              <th className="px-4 py-2.5 font-medium">Tiempo recupero</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t: any) => {
              const recuperoTime = t.cancelado_at && t.cubierto_at
                ? Math.round((new Date(t.cubierto_at).getTime() - new Date(t.cancelado_at).getTime()) / 60000)
                : null;

              return (
                <tr key={t.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{t.fecha}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{t.hora?.slice(0, 5)}</td>
                  <td className="px-4 py-2.5 text-foreground">
                    {t.paciente_original ? `${t.paciente_original.nombre} ${t.paciente_original.apellido}` : t.paciente ? `${t.paciente.nombre} ${t.paciente.apellido}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge[t.status] || "badge-free"}`}>
                      {statusLabel[t.status] || t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground">
                    {t.cubierto_por ? `${t.cubierto_por.nombre} ${t.cubierto_por.apellido}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {recuperoTime !== null ? `${recuperoTime} min` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {turnos.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No hay historial disponible</div>
        )}
      </div>
    </AppLayout>
  );
}
