-- Tempos de regra agora em MINUTOS pra granularidade fina e
-- consistência (slot_interval e combo_buffer já eram minutos).
-- Migra valores existentes multiplicando por 60.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS min_advance_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_window_minutes integer NOT NULL DEFAULT 120;

UPDATE public.tenants
   SET min_advance_minutes = COALESCE(min_advance_hours, 0) * 60,
       cancellation_window_minutes = COALESCE(cancellation_window_hours, 2) * 60;

ALTER TABLE public.tenants DROP COLUMN IF EXISTS min_advance_hours;
ALTER TABLE public.tenants DROP COLUMN IF EXISTS cancellation_window_hours;

COMMENT ON COLUMN public.tenants.min_advance_minutes IS
  'Antecedência mínima (em minutos) que cliente precisa pra agendar a partir de agora.';
COMMENT ON COLUMN public.tenants.cancellation_window_minutes IS
  'Quantos minutos antes do horário o cliente ainda pode cancelar.';
