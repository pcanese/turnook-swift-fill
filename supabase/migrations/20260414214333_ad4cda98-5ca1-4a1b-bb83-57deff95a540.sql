-- Turno status enum
CREATE TYPE public.turno_status AS ENUM (
  'confirmado',
  'pendiente',
  'caido',
  'en_proceso',
  'cubierto',
  'libre',
  'sin_cubrir'
);

-- Consultorios table
CREATE TABLE public.consultorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  especialidades TEXT[] NOT NULL DEFAULT '{}',
  telefono TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medicos table
CREATE TABLE public.medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultorio_id UUID NOT NULL REFERENCES public.consultorios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  matricula TEXT NOT NULL,
  especialidad TEXT NOT NULL,
  dias_atencion INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  hora_inicio TIME NOT NULL DEFAULT '08:00',
  hora_fin TIME NOT NULL DEFAULT '18:00',
  duracion_turno INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pacientes table
CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultorio_id UUID NOT NULL REFERENCES public.consultorios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  celular TEXT NOT NULL,
  obra_social TEXT,
  optin_adelanto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turnos table
CREATE TABLE public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  status public.turno_status NOT NULL DEFAULT 'pendiente',
  motivo TEXT,
  notas TEXT,
  paciente_original_id UUID REFERENCES public.pacientes(id),
  cancelado_at TIMESTAMPTZ,
  cubierto_at TIMESTAMPTZ,
  cubierto_por_paciente_id UUID REFERENCES public.pacientes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lista de espera table
CREATE TABLE public.lista_espera (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  prioridad INTEGER NOT NULL DEFAULT 0,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (medico_id, paciente_id)
);

-- Indexes
CREATE INDEX idx_turnos_medico_fecha ON public.turnos(medico_id, fecha);
CREATE INDEX idx_turnos_status ON public.turnos(status);
CREATE INDEX idx_lista_espera_medico ON public.lista_espera(medico_id, activo);
CREATE INDEX idx_pacientes_consultorio ON public.pacientes(consultorio_id);

-- Enable RLS on all tables
ALTER TABLE public.consultorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;

-- MVP: Public read/write policies (will be restricted with auth later)
CREATE POLICY "Allow all access to consultorios" ON public.consultorios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to medicos" ON public.medicos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pacientes" ON public.pacientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to turnos" ON public.turnos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to lista_espera" ON public.lista_espera FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_consultorios_updated_at BEFORE UPDATE ON public.consultorios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_medicos_updated_at BEFORE UPDATE ON public.medicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_turnos_updated_at BEFORE UPDATE ON public.turnos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lista_espera_updated_at BEFORE UPDATE ON public.lista_espera FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
