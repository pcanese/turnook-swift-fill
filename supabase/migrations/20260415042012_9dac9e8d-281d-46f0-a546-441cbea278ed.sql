
-- Configuracion table for Bug 8
CREATE TABLE public.configuracion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id uuid NOT NULL,
  timer_minutos integer NOT NULL DEFAULT 10,
  hora_inicio time NOT NULL DEFAULT '08:00',
  hora_fin time NOT NULL DEFAULT '12:00',
  duracion_turno integer NOT NULL DEFAULT 30,
  ventana_horaria integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to configuracion" ON public.configuracion FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_configuracion_updated_at
  BEFORE UPDATE ON public.configuracion
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
