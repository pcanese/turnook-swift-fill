import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const DEMO_MEDICO_ID = "b0000000-0000-0000-0000-000000000001";
const TIMER_MINUTES = 10;

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

    const { error: notifError } = await supabase
      .from("notificaciones")
      .update({ estado: "confirmado" as any, respondido_at: now })
      .eq("id", data.notificacionId);

    if (notifError) throw new Error("Failed to confirm notification");

    await supabase
      .from("notificaciones")
      .update({ estado: "cancelado" as any })
      .eq("turno_id", data.turnoId)
      .neq("id", data.notificacionId)
      .in("estado", ["enviado", "entregado", "leido"] as any);

    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nombre, apellido")
      .eq("id", data.pacienteId)
      .single();

    const { data: turno } = await supabase
      .from("turnos")
      .select("hora")
      .eq("id", data.turnoId)
      .single();

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

    const { data: expired, error } = await supabase
      .from("notificaciones")
      .select("id, turno_id")
      .in("estado", ["enviado", "entregado", "leido"] as any)
      .lt("timer_expira_at", now);

    if (error || !expired || expired.length === 0) {
      return { expired: 0, turnosSinCubrir: 0 };
    }

    const expiredIds = expired.map((e) => e.id);
    await supabase
      .from("notificaciones")
      .update({ estado: "expirado" as any })
      .in("id", expiredIds);

    const turnoIds = [...new Set(expired.map((e) => e.turno_id))];
    let turnosSinCubrir = 0;

    for (const turnoId of turnoIds) {
      const { data: remaining } = await supabase
        .from("notificaciones")
        .select("id")
        .eq("turno_id", turnoId)
        .in("estado", ["enviado", "entregado", "leido", "confirmado"] as any);

      if (!remaining || remaining.length === 0) {
        const { data: turnoCheck } = await supabase
          .from("turnos")
          .select("status")
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

// Bug 3: Notify more patients
export const notificarMasPacientes = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }) => {
    const { turnoId } = data;

    // Get turno's medico
    const { data: turno } = await supabase
      .from("turnos")
      .select("medico_id")
      .eq("id", turnoId)
      .single();

    if (!turno) throw new Error("Turno not found");

    // Get already-notified patient IDs for this turno
    const { data: existing } = await supabase
      .from("notificaciones")
      .select("paciente_id")
      .eq("turno_id", turnoId);

    const notifiedIds = (existing || []).map((e) => e.paciente_id);

    // Find waitlist patients not yet notified with optin
    const { data: waitlistEntries } = await supabase
      .from("lista_espera")
      .select(`
        id, paciente_id,
        paciente:pacientes!lista_espera_paciente_id_fkey(id, optin_adelanto)
      `)
      .eq("medico_id", turno.medico_id)
      .eq("activo", true)
      .order("prioridad")
      .order("created_at")
      .limit(20);

    const newEntries = (waitlistEntries || [])
      .filter((e: any) => e.paciente?.optin_adelanto === true && !notifiedIds.includes(e.paciente_id))
      .slice(0, 3);

    if (newEntries.length === 0) {
      return { success: true, notificaciones: 0 };
    }

    // Get max current orden
    const { data: maxOrden } = await supabase
      .from("notificaciones")
      .select("orden")
      .eq("turno_id", turnoId)
      .order("orden", { ascending: false })
      .limit(1);

    const startOrden = (maxOrden?.[0]?.orden || 0) + 1;
    const timerExpira = new Date(Date.now() + TIMER_MINUTES * 60 * 1000).toISOString();

    const notifRows = newEntries.map((entry: any, idx: number) => ({
      turno_id: turnoId,
      paciente_id: entry.paciente_id,
      estado: "enviado" as const,
      orden: startOrden + idx,
      timer_expira_at: timerExpira,
    }));

    await supabase.from("notificaciones").insert(notifRows as any);

    // Ensure turno is en_proceso
    await supabase
      .from("turnos")
      .update({ status: "en_proceso" as any })
      .eq("id", turnoId);

    return { success: true, notificaciones: newEntries.length };
  });

// Bug 3: Pause search
export const pausarBusqueda = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }) => {
    // Cancel all active notifications
    await supabase
      .from("notificaciones")
      .update({ estado: "cancelado" as any })
      .eq("turno_id", data.turnoId)
      .in("estado", ["enviado", "entregado", "leido"] as any);

    // Set turno to caido
    await supabase
      .from("turnos")
      .update({ status: "caido" as any })
      .eq("id", data.turnoId);

    return { success: true };
  });

// Bug 5: Init notifications for en_proceso turno with no notifications
export const initNotificaciones = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }) => {
    const { turnoId } = data;

    const { data: turno } = await supabase
      .from("turnos")
      .select("medico_id")
      .eq("id", turnoId)
      .single();

    if (!turno) throw new Error("Turno not found");

    const { data: waitlistEntries } = await supabase
      .from("lista_espera")
      .select(`
        id, paciente_id,
        paciente:pacientes!lista_espera_paciente_id_fkey(id, optin_adelanto)
      `)
      .eq("medico_id", turno.medico_id)
      .eq("activo", true)
      .order("prioridad")
      .order("created_at")
      .limit(10);

    const optinEntries = (waitlistEntries || [])
      .filter((e: any) => e.paciente?.optin_adelanto === true)
      .slice(0, 3);

    if (optinEntries.length === 0) {
      await supabase
        .from("turnos")
        .update({ status: "sin_cubrir" as any })
        .eq("id", turnoId);
      return { success: true, notificaciones: 0 };
    }

    const timerExpira = new Date(Date.now() + TIMER_MINUTES * 60 * 1000).toISOString();
    const notifRows = optinEntries.map((entry: any, idx: number) => ({
      turno_id: turnoId,
      paciente_id: entry.paciente_id,
      estado: "enviado" as const,
      orden: idx + 1,
      timer_expira_at: timerExpira,
    }));

    await supabase.from("notificaciones").insert(notifRows as any);
    return { success: true, notificaciones: optinEntries.length };
  });

// Historial page
export const getHistorialNotificaciones = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("notificaciones")
      .select(`
        id, estado, orden, created_at, respondido_at, timer_expira_at,
        turno:turnos!notificaciones_turno_id_fkey(hora, fecha, status),
        paciente:pacientes!notificaciones_paciente_id_fkey(nombre, apellido)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error("Failed to fetch historial");
    return (data || []) as any[];
  });

// Historial turnos
export const getHistorialTurnos = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("turnos")
      .select(`
        id, hora, fecha, status, cancelado_at, cubierto_at,
        paciente:pacientes!turnos_paciente_id_fkey(nombre, apellido),
        paciente_original:pacientes!turnos_paciente_original_id_fkey(nombre, apellido),
        cubierto_por:pacientes!turnos_cubierto_por_paciente_id_fkey(nombre, apellido)
      `)
      .eq("medico_id", DEMO_MEDICO_ID)
      .in("status", ["caido", "en_proceso", "cubierto", "sin_cubrir"] as any)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(100);

    if (error) throw new Error("Failed to fetch historial turnos");
    return (data || []) as any[];
  });
