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

    // Get patient name for the banner
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nombre, apellido")
      .eq("id", data.pacienteId)
      .single();

    // Get turno hora
    const { data: turno } = await supabase
      .from("turnos")
      .select("hora")
      .eq("id", data.turnoId)
      .single();

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

    return {
      success: true,
      hora: turno?.hora?.slice(0, 5) || "",
      pacienteNombre: paciente ? `${paciente.nombre} ${paciente.apellido}` : "",
    };
  });

export const procesarExpiraciones = createServerFn({ method: "POST" })
  .handler(async () => {
    const now = new Date().toISOString();

    // Find expired notifications
    const { data: expired, error } = await supabase
      .from("notificaciones")
      .select("id, turno_id")
      .in("estado", ["enviado", "entregado", "leido"] as any)
      .lt("timer_expira_at", now);

    if (error || !expired || expired.length === 0) {
      return { expired: 0, turnosSinCubrir: 0 };
    }

    // Mark as expirado
    const expiredIds = expired.map((e) => e.id);
    await supabase
      .from("notificaciones")
      .update({ estado: "expirado" as any })
      .in("id", expiredIds);

    // Check which turnos have ALL notifications expired/rejected (none confirmed)
    const turnoIds = [...new Set(expired.map((e) => e.turno_id))];
    let turnosSinCubrir = 0;

    for (const turnoId of turnoIds) {
      const { data: remaining } = await supabase
        .from("notificaciones")
        .select("id")
        .eq("turno_id", turnoId)
        .in("estado", ["enviado", "entregado", "leido", "confirmado"] as any);

      if (!remaining || remaining.length === 0) {
        // No active or confirmed notifications — mark turno as sin_cubrir
        const { data: turnoCheck } = await supabase
          .from("turnos")
          .select("status, hora")
          .eq("id", turnoId)
          .single();

        if (turnoCheck && turnoCheck.status === "en_proceso") {
          await supabase
            .from("turnos")
            .update({ status: "sin_cubrir" as any })
            .eq("id", turnoId);
          turnosSinCubrir++;
        }
      }
    }

    return { expired: expiredIds.length, turnosSinCubrir };
  });
