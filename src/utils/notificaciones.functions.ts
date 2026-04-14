import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export type NotificacionRow = {
  id: string;
  turno_id: string;
  estado: string;
  orden: number;
  timer_expira_at: string;
  respondido_at: string | null;
  created_at: string;
  paciente: { id: string; nombre: string; apellido: string; obra_social: string | null; celular: string };
};

export type TurnoNotifContext = {
  id: string;
  hora: string;
  fecha: string;
  status: string;
  cancelado_at: string | null;
  paciente_original: { nombre: string; apellido: string } | null;
};

export type NotificacionesData = {
  turno: TurnoNotifContext | null;
  notificaciones: NotificacionRow[];
};

export const getNotificaciones = createServerFn({ method: "GET" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }): Promise<NotificacionesData> => {
    const { turnoId } = data;

    const { data: turno } = await supabase
      .from("turnos")
      .select(`
        id, hora, fecha, status, cancelado_at,
        paciente_original:pacientes!turnos_paciente_original_id_fkey(nombre, apellido)
      `)
      .eq("id", turnoId)
      .single();

    const { data: notificaciones, error } = await supabase
      .from("notificaciones")
      .select(`
        id, turno_id, estado, orden, timer_expira_at, respondido_at, created_at,
        paciente:pacientes!notificaciones_paciente_id_fkey(id, nombre, apellido, obra_social, celular)
      `)
      .eq("turno_id", turnoId)
      .order("orden");

    if (error) {
      console.error("Error fetching notificaciones:", error);
      throw new Error("Failed to fetch notificaciones");
    }

    return {
      turno: (turno as unknown as TurnoNotifContext) || null,
      notificaciones: (notificaciones || []) as unknown as NotificacionRow[],
    };
  });

export const confirmarTurno = createServerFn({ method: "POST" })
  .inputValidator((data: { notificacionId: string; turnoId: string; pacienteId: string }) => data)
  .handler(async ({ data }) => {
    const now = new Date().toISOString();

    // Mark this notification as confirmed
    const { error: notifError } = await supabase
      .from("notificaciones")
      .update({ estado: "confirmado" as any, respondido_at: now })
      .eq("id", data.notificacionId);

    if (notifError) throw new Error("Failed to confirm notification");

    // Cancel remaining notifications for this turno
    await supabase
      .from("notificaciones")
      .update({ estado: "cancelado" as any })
      .eq("turno_id", data.turnoId)
      .neq("id", data.notificacionId)
      .in("estado", ["enviado", "entregado", "leido"] as any);

    // Update turno as covered
    await supabase
      .from("turnos")
      .update({
        status: "cubierto" as any,
        cubierto_por_paciente_id: data.pacienteId,
        cubierto_at: now,
        paciente_id: data.pacienteId,
      } as any)
      .eq("id", data.turnoId);

    return { success: true };
  });
