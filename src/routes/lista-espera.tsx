import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import { getListaEspera, eliminarDeListaEspera, moverPrioridad } from "@/utils/pages.functions";

export const Route = createFileRoute("/lista-espera")({
  loader: () => getListaEspera(),
  component: ListaEsperaPage,
  head: () => ({
    meta: [
      { title: "TurnoOk — Lista de espera" },
      { name: "description", content: "Gestión de la lista de espera de pacientes" },
    ],
  }),
});

function ListaEsperaPage() {
  const items = Route.useLoaderData();
  const router = useRouter();

  const handleEliminar = async (id: string) => {
    try {
      await eliminarDeListaEspera({ data: { id } });
      toast.success("Paciente eliminado de la lista.");
      router.invalidate();
    } catch {
      toast.error("Ocurrió un error.");
    }
  };

  const handleMover = async (id: string, direction: "up" | "down") => {
    try {
      await moverPrioridad({ data: { id, direction } });
      router.invalidate();
    } catch {
      toast.error("Ocurrió un error.");
    }
  };

  return (
    <AppLayout>
      <h1 className="text-base font-medium text-foreground">Lista de espera</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">{items.length} pacientes activos</p>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Paciente</th>
              <th className="px-4 py-2.5 font-medium">Obra social</th>
              <th className="px-4 py-2.5 font-medium">Fecha registro</th>
              <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => (
              <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {item.paciente.nombre} {item.paciente.apellido}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {item.paciente.obra_social || "Particular"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {new Date(item.fecha_registro).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleMover(item.id, "up")}
                      disabled={i === 0}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMover(item.id, "down")}
                      disabled={i === items.length - 1}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => handleEliminar(item.id)}
                      className="rounded border border-destructive/30 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No hay pacientes en la lista de espera</div>
        )}
      </div>
    </AppLayout>
  );
}
