import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import { useState } from "react";
import { getPacientes, toggleOptin, agregarPaciente } from "@/utils/pages.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/pacientes")({
  loader: () => getPacientes(),
  component: PacientesPage,
  head: () => ({
    meta: [
      { title: "TurnoOk — Pacientes" },
      { name: "description", content: "Gestión de pacientes del consultorio" },
    ],
  }),
});

function PacientesPage() {
  const pacientes = Route.useLoaderData();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nombre: "", apellido: "", celular: "", obraSocial: "" });

  const handleToggle = async (id: string, value: boolean) => {
    try {
      await toggleOptin({ data: { pacienteId: id, value } });
      toast.success(value ? "Opt-in activado." : "Opt-in desactivado.");
      router.invalidate();
    } catch {
      toast.error("Ocurrió un error.");
    }
  };

  const handleAdd = async () => {
    if (!form.nombre || !form.apellido || !form.celular) {
      toast.error("Completá nombre, apellido y celular.");
      return;
    }
    try {
      await agregarPaciente({ data: form });
      toast.success("Paciente agregado.");
      setShowAdd(false);
      setForm({ nombre: "", apellido: "", celular: "", obraSocial: "" });
      router.invalidate();
    } catch {
      toast.error("Ocurrió un error.");
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-medium text-foreground">Pacientes</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{pacientes.length} registrados</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>+ Agregar paciente</Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Paciente</th>
              <th className="px-4 py-2.5 font-medium">Obra social</th>
              <th className="px-4 py-2.5 font-medium">Celular</th>
              <th className="px-4 py-2.5 font-medium text-center">Opt-in adelanto</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((p: any) => (
              <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-muted/50">
                <td className="px-4 py-2.5 font-medium text-foreground">{p.apellido}, {p.nombre}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.obra_social || "Particular"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.celular}</td>
                <td className="px-4 py-2.5 text-center">
                  <Switch checked={p.optin_adelanto} onCheckedChange={(v) => handleToggle(p.id, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pacientes.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No hay pacientes registrados</div>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <Input placeholder="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            <Input placeholder="Celular (ej: +5491112345678)" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
            <Input placeholder="Obra social (opcional)" value={form.obraSocial} onChange={(e) => setForm({ ...form, obraSocial: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAdd}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
