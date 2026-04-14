
-- Create enum for notification status
CREATE TYPE public.notificacion_estado AS ENUM (
  'enviado',
  'entregado',
  'leido',
  'confirmado',
  'rechazado',
  'expirado',
  'cancelado'
);

-- Create notificaciones table
CREATE TABLE public.notificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turno_id UUID NOT NULL REFERENCES public.turnos(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  estado public.notificacion_estado NOT NULL DEFAULT 'enviado',
  orden INTEGER NOT NULL DEFAULT 1,
  timer_expira_at TIMESTAMP WITH TIME ZONE NOT NULL,
  respondido_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- MVP: allow all access (no auth yet)
CREATE POLICY "Allow all access to notificaciones"
ON public.notificaciones
FOR ALL
USING (true)
WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_notificaciones_updated_at
BEFORE UPDATE ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
