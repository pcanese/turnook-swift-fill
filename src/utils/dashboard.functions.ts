import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// For MVP: hardcoded medico ID (will come from auth later)
const DEMO_MEDICO_ID = "b0000000-0000-0000-0000-000000000001";

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

    // Fetch turnos for the day with patient data
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

    // Fetch active waitlist
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

    // Fetch medico info
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
    const { error } = await supabase
      .from("turnos")
      .update({
        status: "caido" as any,
        cancelado_at: new Date().toISOString(),
      })
      .eq("id", data.turnoId);

    if (error) {
      console.error("Error canceling turno:", error);
      throw new Error("Failed to cancel turno");
    }

    return { success: true };
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
