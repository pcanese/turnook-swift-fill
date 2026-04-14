import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// For MVP: hardcoded medico ID (will come from auth later)
const DEMO_MEDICO_ID = "b0000000-0000-0000-0000-000000000001";
const TIMER_MINUTES = 10;

export type TurnoRow = {
  id: string;
  hora: string;
  fecha: string;
  status: string;
  motivo: string | null;
  notas: string | null;
  cancelado_at: string | null;
  cubierto_at: string | null;
  paciente: { id: string; nombre: string; apellido: string; obra_social: string | null } | null;
  paciente_original: { nombre: string; apellido: string } | null;
  cubierto_por: { nombre: string; apellido: string } | null;
};

export type WaitlistRow = {
  id: string;
  prioridad: number;
  fecha_registro: string;
  paciente: { id: string; nombre: string; apellido: string; obra_social: string | null };
};

export type DashboardData = {
  turnos: TurnoRow[];
  waitlist: WaitlistRow[];
  medico: { nombre: string; apellido: string; especialidad: string } | null;
  fecha: string;
};

export const getDashboardData = createServerFn({ method: "GET" })
  .inputValidator((data: { fecha: string }) => data)
  .handler(async ({ data }): Promise<DashboardData> => {
    const { fecha } = data;

    const { data: turnos, error: turnosError } = await supabase
      .from("turnos")
      .select(`
        id, hora, fecha, status, motivo, notas, cancelado_at, cubierto_at,
        paciente:pacientes!turnos_paciente_id_fkey(id, nombre, apellido, obra_social),
        paciente_original:pacientes!turnos_paciente_original_id_fkey(nombre, apellido),
        cubierto_por:pacientes!turnos_cubierto_por_paciente_id_fkey(nombre, apellido)
      `)
      .eq("medico_id", DEMO_MEDICO_ID)
      .eq("fecha", fecha)
      .order("hora");

    if (turnosError) {
      console.error("Error fetching turnos:", turnosError);
      throw new Error("Failed to fetch turnos");
    }

    const { data: waitlist, error: waitlistError } = await supabase
      .from("lista_espera")
      .select(`
        id, prioridad, fecha_registro,
        paciente:pacientes!lista_espera_paciente_id_fkey(id, nombre, apellido, obra_social)
      `)
      .eq("medico_id", DEMO_MEDICO_ID)
      .eq("activo", true)
      .order("prioridad");

    if (waitlistError) {
      console.error("Error fetching waitlist:", waitlistError);
      throw new Error("Failed to fetch waitlist");
    }

    const { data: medico } = await supabase
      .from("medicos")
      .select("nombre, apellido, especialidad")
      .eq("id", DEMO_MEDICO_ID)
      .single();

    return {
      turnos: (turnos || []) as unknown as TurnoRow[],
      waitlist: (waitlist || []) as unknown as WaitlistRow[],
      medico: medico || null,
      fecha,
    };
  });

export const cancelarTurno = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }) => {
    const { turnoId } = data;

    // 1. Mark turno as "caido" and save original patient
    const { data: turno, error: turnoError } = await supabase
      .from("turnos")
      .select("paciente_id, medico_id")
      .eq("id", turnoId)
      .single();

    if (turnoError || !turno) {
      throw new Error("Turno not found");
    }

    // Save original patient before clearing
    const updatePayload: Record<string, unknown> = {
      status: "caido" as const,
      cancelado_at: new Date().toISOString(),
    };
    if (turno.paciente_id) {
      updatePayload.paciente_original_id = turno.paciente_id;
    }

    const { error: updateError } = await supabase
      .from("turnos")
      .update(updatePayload as any)
      .eq("id", turnoId);

    if (updateError) {
      console.error("Error canceling turno:", updateError);
      throw new Error("Failed to cancel turno");
    }

    // 2. Find top 3 waitlist patients with optin_adelanto = true
    const { data: waitlistEntries, error: wlError } = await supabase
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

    if (wlError) {
      console.error("Error fetching waitlist:", wlError);
      throw new Error("Failed to fetch waitlist");
    }

    // Filter for optin patients, take first 3
    const optinEntries = (waitlistEntries || [])
      .filter((e: any) => e.paciente?.optin_adelanto === true)
      .slice(0, 3);

    if (optinEntries.length === 0) {
      // No patients to notify — mark as sin_cubrir
      await supabase
        .from("turnos")
        .update({ status: "sin_cubrir" as any })
        .eq("id", turnoId);

      return { success: true, notificaciones: 0 };
    }

    // 3. Create notificaciones
    const timerExpira = new Date(Date.now() + TIMER_MINUTES * 60 * 1000).toISOString();
    const notifRows = optinEntries.map((entry: any, idx: number) => ({
      turno_id: turnoId,
      paciente_id: entry.paciente_id,
      estado: "enviado" as const,
      orden: idx + 1,
      timer_expira_at: timerExpira,
    }));

    const { error: notifError } = await supabase
      .from("notificaciones")
      .insert(notifRows as any);

    if (notifError) {
      console.error("Error creating notificaciones:", notifError);
      throw new Error("Failed to create notifications");
    }

    // 4. Update turno to "en_proceso"
    await supabase
      .from("turnos")
      .update({ status: "en_proceso" as any })
      .eq("id", turnoId);

    return { success: true, notificaciones: optinEntries.length };
  });

export const marcarLibre = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("turnos")
      .update({
        status: "libre" as any,
        paciente_id: null,
      })
      .eq("id", data.turnoId);

    if (error) {
      console.error("Error marking turno as libre:", error);
      throw new Error("Failed to mark turno as libre");
    }

    return { success: true };
  });
