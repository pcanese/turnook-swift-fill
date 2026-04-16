import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

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
  has_active_notifs: boolean;
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

export type MonthlyMetrics = {
  caidos: number;
  recuperados: number;
  tasa: number;
  montoRecuperado: number;
};

export type DashboardData = {
  turnos: TurnoRow[];
  waitlist: WaitlistRow[];
  medico: { nombre: string; apellido: string; especialidad: string } | null;
  fecha: string;
  monthlyMetrics: MonthlyMetrics;
  isWeekend: boolean;
};

// Bug 2: Generate turnos for a weekday if none exist
async function ensureTurnosExist(fecha: string, medicoId: string): Promise<boolean> {
  const d = new Date(fecha + "T12:00:00");
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // weekend

  const { count } = await supabase
    .from("turnos")
    .select("id", { count: "exact", head: true })
    .eq("medico_id", medicoId)
    .eq("fecha", fecha);

  if (count && count > 0) return true;

  // Generate 8:00-12:00 every 30 min
  const slots: { hora: string; fecha: string; medico_id: string; status: string }[] = [];
  for (let h = 8; h < 12; h++) {
    for (const m of [0, 30]) {
      slots.push({
        hora: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
        fecha,
        medico_id: medicoId,
        status: "libre",
      });
    }
  }

  await supabase.from("turnos").insert(slots as any);
  return true;
}

// Bug 7: Monthly metrics from DB
async function fetchMonthlyMetrics(medicoId: string): Promise<MonthlyMetrics> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: monthTurnos } = await supabase
    .from("turnos")
    .select("status")
    .eq("medico_id", medicoId)
    .gte("fecha", firstDay)
    .lte("fecha", lastDay);

  const all = monthTurnos || [];
  const caidos = all.filter((t) => ["caido", "sin_cubrir", "en_proceso", "cubierto"].includes(t.status)).length;
  const recuperados = all.filter((t) => t.status === "cubierto").length;
  const tasa = caidos > 0 ? Math.round((recuperados / caidos) * 100) : 0;

  return { caidos, recuperados, tasa, montoRecuperado: recuperados * 40000 };
}

export const getDashboardData = createServerFn({ method: "GET" })
  .inputValidator((data: { fecha: string }) => data)
  .handler(async ({ data }): Promise<DashboardData> => {
    const { fecha } = data;
    const d = new Date(fecha + "T12:00:00");
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    if (!isWeekend) {
      await ensureTurnosExist(fecha, DEMO_MEDICO_ID);
    }

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

    const monthlyMetrics = await fetchMonthlyMetrics(DEMO_MEDICO_ID);

    // Enrich en_proceso turnos with active notification check
    const rawTurnos = (turnos || []) as any[];
    const enProcesoIds = rawTurnos.filter((t: any) => t.status === "en_proceso").map((t: any) => t.id);
    const activeNotifTurnos = new Set<string>();

    if (enProcesoIds.length > 0) {
      const { data: activeNotifs } = await supabase
        .from("notificaciones")
        .select("turno_id")
        .in("turno_id", enProcesoIds)
        .in("estado", ["enviado", "entregado", "leido"] as any);

      for (const n of activeNotifs || []) {
        activeNotifTurnos.add(n.turno_id);
      }
    }

    const enrichedTurnos = rawTurnos.map((t: any) => ({
      ...t,
      has_active_notifs: activeNotifTurnos.has(t.id),
    }));

    return {
      turnos: enrichedTurnos as unknown as TurnoRow[],
      waitlist: (waitlist || []) as unknown as WaitlistRow[],
      medico: medico || null,
      fecha,
      monthlyMetrics,
      isWeekend,
    };
  });

export const cancelarTurno = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string }) => data)
  .handler(async ({ data }) => {
    const { turnoId } = data;

    const { data: turno, error: turnoError } = await supabase
      .from("turnos")
      .select("paciente_id, medico_id, status, cubierto_por_paciente_id")
      .eq("id", turnoId)
      .single();

    if (turnoError || !turno) {
      throw new Error("Turno not found");
    }

    const updatePayload: Record<string, unknown> = {
      status: "caido" as const,
      cancelado_at: new Date().toISOString(),
    };

    if (turno.status === "cubierto") {
      // Canceling a covered turno: the covering patient is the one canceling
      updatePayload.paciente_original_id = turno.cubierto_por_paciente_id || turno.paciente_id;
      updatePayload.paciente_id = null;
      updatePayload.cubierto_por_paciente_id = null;
      updatePayload.cubierto_at = null;
    } else if (turno.paciente_id) {
      updatePayload.paciente_original_id = turno.paciente_id;
    }

    const { error: updateError } = await supabase
      .from("turnos")
      .update(updatePayload as any)
      .eq("id", turnoId);

    if (updateError) throw new Error("Failed to cancel turno");

    // Find top 3 waitlist patients with optin_adelanto = true
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

    const { error: notifError } = await supabase
      .from("notificaciones")
      .insert(notifRows as any);

    if (notifError) throw new Error("Failed to create notifications");

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

    if (error) throw new Error("Failed to mark turno as libre");
    return { success: true };
  });

// Bug 1: Search pacientes for assignment modal
export const searchPacientes = createServerFn({ method: "GET" })
  .inputValidator((data: { query: string }) => data)
  .handler(async ({ data }) => {
    const q = data.query.trim();
    let query = supabase
      .from("pacientes")
      .select("id, nombre, apellido, obra_social")
      .limit(10);

    if (q) {
      query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%`);
    }

    const { data: pacientes, error } = await query.order("apellido");
    if (error) throw new Error("Failed to search pacientes");
    return (pacientes || []) as { id: string; nombre: string; apellido: string; obra_social: string | null }[];
  });

// Bug 1: Assign patient to turno
export const asignarPaciente = createServerFn({ method: "POST" })
  .inputValidator((data: { turnoId: string; pacienteId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("turnos")
      .update({ paciente_id: data.pacienteId, status: "pendiente" as any } as any)
      .eq("id", data.turnoId);

    if (error) throw new Error("Failed to assign paciente");
    return { success: true };
  });
