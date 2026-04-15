import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const DEMO_MEDICO_ID = "b0000000-0000-0000-0000-000000000001";
const DEMO_CONSULTORIO_ID = "c0000000-0000-0000-0000-000000000001";

// Lista de espera CRUD
export const getListaEspera = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("lista_espera")
      .select(`
        id, prioridad, fecha_registro, notas, activo,
        paciente:pacientes!lista_espera_paciente_id_fkey(id, nombre, apellido, obra_social)
      `)
      .eq("medico_id", DEMO_MEDICO_ID)
      .eq("activo", true)
      .order("prioridad");

    if (error) throw new Error("Failed to fetch lista espera");
    return (data || []) as any[];
  });

export const eliminarDeListaEspera = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await supabase.from("lista_espera").update({ activo: false }).eq("id", data.id);
    return { success: true };
  });

export const moverPrioridad = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; direction: "up" | "down" }) => data)
  .handler(async ({ data }) => {
    const { data: current } = await supabase
      .from("lista_espera")
      .select("id, prioridad")
      .eq("id", data.id)
      .single();

    if (!current) throw new Error("Not found");

    const newPrioridad = data.direction === "up"
      ? Math.max(0, current.prioridad - 1)
      : current.prioridad + 1;

    // Find the item to swap with
    const { data: swap } = await supabase
      .from("lista_espera")
      .select("id, prioridad")
      .eq("medico_id", DEMO_MEDICO_ID)
      .eq("activo", true)
      .eq("prioridad", newPrioridad)
      .limit(1)
      .single();

    if (swap) {
      await supabase.from("lista_espera").update({ prioridad: current.prioridad } as any).eq("id", swap.id);
    }
    await supabase.from("lista_espera").update({ prioridad: newPrioridad } as any).eq("id", data.id);

    return { success: true };
  });

// Pacientes CRUD
export const getPacientes = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("pacientes")
      .select("id, nombre, apellido, obra_social, celular, optin_adelanto")
      .eq("consultorio_id", DEMO_CONSULTORIO_ID)
      .order("apellido");

    if (error) throw new Error("Failed to fetch pacientes");
    return (data || []) as any[];
  });

export const toggleOptin = createServerFn({ method: "POST" })
  .inputValidator((data: { pacienteId: string; value: boolean }) => data)
  .handler(async ({ data }) => {
    await supabase.from("pacientes").update({ optin_adelanto: data.value }).eq("id", data.pacienteId);
    return { success: true };
  });

export const agregarPaciente = createServerFn({ method: "POST" })
  .inputValidator((data: { nombre: string; apellido: string; celular: string; obraSocial: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await supabase.from("pacientes").insert({
      nombre: data.nombre,
      apellido: data.apellido,
      celular: data.celular,
      obra_social: data.obraSocial || null,
      consultorio_id: DEMO_CONSULTORIO_ID,
      optin_adelanto: true,
    });
    if (error) throw new Error("Failed to add paciente");
    return { success: true };
  });

// Configuracion
export const getConfiguracion = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: config } = await supabase
      .from("configuracion")
      .select("*")
      .eq("consultorio_id", DEMO_CONSULTORIO_ID)
      .single();

    if (config) return config;

    // Also fetch consultorio + medico for display
    const { data: consultorio } = await supabase
      .from("consultorios")
      .select("nombre, especialidades")
      .eq("id", DEMO_CONSULTORIO_ID)
      .single();

    const { data: medico } = await supabase
      .from("medicos")
      .select("especialidad, hora_inicio, hora_fin, duracion_turno")
      .eq("id", DEMO_MEDICO_ID)
      .single();

    return {
      id: null,
      consultorio_id: DEMO_CONSULTORIO_ID,
      timer_minutos: 10,
      hora_inicio: medico?.hora_inicio || "08:00",
      hora_fin: medico?.hora_fin || "12:00",
      duracion_turno: medico?.duracion_turno || 30,
      ventana_horaria: 24,
      nombre_consultorio: consultorio?.nombre || "",
      especialidad: medico?.especialidad || "",
    };
  });

export const guardarConfiguracion = createServerFn({ method: "POST" })
  .inputValidator((data: {
    id: string | null;
    timer_minutos: number;
    hora_inicio: string;
    hora_fin: string;
    duracion_turno: number;
    ventana_horaria: number;
    nombre_consultorio: string;
    especialidad: string;
  }) => data)
  .handler(async ({ data }) => {
    // Update consultorio name
    await supabase
      .from("consultorios")
      .update({ nombre: data.nombre_consultorio } as any)
      .eq("id", DEMO_CONSULTORIO_ID);

    // Update medico
    await supabase
      .from("medicos")
      .update({
        especialidad: data.especialidad,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        duracion_turno: data.duracion_turno,
      } as any)
      .eq("id", DEMO_MEDICO_ID);

    // Upsert configuracion
    if (data.id) {
      await supabase
        .from("configuracion")
        .update({
          timer_minutos: data.timer_minutos,
          hora_inicio: data.hora_inicio,
          hora_fin: data.hora_fin,
          duracion_turno: data.duracion_turno,
          ventana_horaria: data.ventana_horaria,
        } as any)
        .eq("id", data.id);
    } else {
      await supabase.from("configuracion").insert({
        consultorio_id: DEMO_CONSULTORIO_ID,
        timer_minutos: data.timer_minutos,
        hora_inicio: data.hora_inicio,
        hora_fin: data.hora_fin,
        duracion_turno: data.duracion_turno,
        ventana_horaria: data.ventana_horaria,
      } as any);
    }

    return { success: true };
  });
