import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import { useState } from "react";
import { getConfiguracion, guardarConfiguracion } from "@/utils/pages.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/configuracion")({
  loader: () => getConfiguracion(),
  component: ConfiguracionPage,
  head: () => ({
    meta: [
      { title: "TurnoOk — Configuración" },
      { name: "description", content: "Configuración del consultorio" },
    ],
  }),
});

function ConfiguracionPage() {
  const config = Route.useLoaderData() as any;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre_consultorio: config.nombre_consultorio || "",
    especialidad: config.especialidad || "",
    hora_inicio: config.hora_inicio || "08:00",
    hora_fin: config.hora_fin || "12:00",
    duracion_turno: config.duracion_turno || 30,
    timer_minutos: config.timer_minutos || 10,
    ventana_horaria: config.ventana_horaria || 24,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await guardarConfiguracion({
        data: {
          id: config.id || null,
          ...form,
        },
      });
      toast.success("Configuración guardada.");
      router.invalidate();
    } catch {
      toast.error("Ocurrió un error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <h1 className="text-base font-medium text-foreground">Configuración</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">Ajustes del consultorio y el sistema de recupero</p>

      <div className="mt-4 max-w-lg space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <label className="text-xs font-medium text-foreground">Nombre del consultorio</label>
          <Input className="mt-1" value={form.nombre_consultorio} onChange={(e) => setForm({ ...form, nombre_consultorio: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground">Especialidad</label>
          <Input className="mt-1" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground">Horario inicio</label>
            <Input className="mt-1" type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Horario fin</label>
            <Input className="mt-1" type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-foreground">Duración turno (min)</label>
            <Input className="mt-1" type="number" value={form.duracion_turno} onChange={(e) => setForm({ ...form, duracion_turno: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Timer respuesta (min)</label>
            <Input className="mt-1" type="number" value={form.timer_minutos} onChange={(e) => setForm({ ...form, timer_minutos: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Ventana horaria (hs)</label>
            <Input className="mt-1" type="number" value={form.ventana_horaria} onChange={(e) => setForm({ ...form, ventana_horaria: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
