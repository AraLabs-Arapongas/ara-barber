-- Auto-completion de appointments após end_at passar.
--
-- Comportamento: a cada 5 minutos, marca como COMPLETED qualquer appointment
-- ativo (SCHEDULED ou CONFIRMED) cujo end_at já passou há pelo menos 15min
-- (grace period pra cobrir relógio dessincronizado e atrasos pequenos).
--
-- Staff pode reverter pra NO_SHOW ou CANCELED depois (ver status-rules.ts).

CREATE OR REPLACE FUNCTION public.auto_complete_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
  SET status = 'COMPLETED', updated_at = now()
  WHERE status IN ('SCHEDULED', 'CONFIRMED')
    AND end_at < now() - interval '15 minutes';
END;
$$;

-- Agenda o job a cada 5 minutos. unschedule prévio garante idempotência.
DO $$
BEGIN
  PERFORM cron.unschedule('auto-complete-appointments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-complete-appointments',
  '*/5 * * * *',
  $$ SELECT public.auto_complete_appointments(); $$
);
