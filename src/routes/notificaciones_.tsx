import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { getHistorialNotificaciones } from "@/utils/notificaciones.functions";

export const Route = createFileRoute("/notificaciones_")({
  loader: () => getHistorialNotificaciones(),
  component: NotificacionesHistorialPage,
  head: () => ({
    meta: [
      { title: "TurnoOk — Historial de notificaciones" },
      { name: "description", content: "Historial de todas las notificaciones enviadas" },
    ],
  }),
});

const estadoLabel: Record<string, string> = {
  enviado: "Enviado",
  entregado: "Entregado",
  leido: "Leído",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

const estadoColor: Record<string, string> = {
  enviado: "badge-process",
  entregado: "badge-process",
  leido: "badge-pending",
  confirmado: "badge-covered",
  rechazado: "badge-fallen",
  expirado: "badge-fallen",
  cancelado: "badge-free",
};

function NotificacionesHistorialPage() {
  const notificaciones = Route.useLoaderData();

  return (
    <AppLayout>
      <h1 className="text-base font-medium text-foreground">Historial de notificaciones</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">{notificaciones.length} registros</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Turno</th>
              <th className="px-4 py-2.5 font-medium">Paciente</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5 font-medium">Respondido</th>
            </tr>
          </thead>
          <tbody>
            {notificaciones.map((n: any) => (
              <tr key={n.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {new Date(n.created_at).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {n.turno?.hora?.slice(0, 5) || "—"} · {n.turno?.fecha || "—"}
                </td>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {n.paciente?.nombre} {n.paciente?.apellido}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoColor[n.estado] || "badge-free"}`}>
                    {estadoLabel[n.estado] || n.estado}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {n.respondido_at
                    ? new Date(n.respondido_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {notificaciones.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No hay notificaciones registradas</div>
        )}
      </div>
    </AppLayout>
  );
}
