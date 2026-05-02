-- Pioneiros: tenants que aderirem até 31/07/2026 ganham 60 dias de
-- trial + selo "Pioneiro" permanente no perfil público.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_pioneer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pioneer_since timestamptz;

COMMENT ON COLUMN public.tenants.is_pioneer IS
  'Tenant entrou no período de pioneiros (criado até 2026-07-31). Selo permanente.';
COMMENT ON COLUMN public.tenants.pioneer_since IS
  'Quando o flag foi marcado (proxy de quando o tenant aderiu).';

-- Trigger automático: tenants criados até 2026-07-31 23:59:59 em
-- America/Sao_Paulo (= 2026-08-01 03:00 UTC) entram como pioneiros.
-- Preserva idempotência: roda no INSERT, ajusta NEW antes do commit.
CREATE OR REPLACE FUNCTION public.tenants_set_pioneer_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_at < TIMESTAMPTZ '2026-08-01 03:00:00+00' THEN
    NEW.is_pioneer := true;
    NEW.pioneer_since := COALESCE(NEW.pioneer_since, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_set_pioneer_flag_trigger ON public.tenants;
CREATE TRIGGER tenants_set_pioneer_flag_trigger
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.tenants_set_pioneer_flag();

-- Backfill dos tenants existentes (todos pré-janela viram pioneiros).
UPDATE public.tenants
   SET is_pioneer = true,
       pioneer_since = COALESCE(pioneer_since, created_at)
 WHERE is_pioneer = false
   AND created_at < TIMESTAMPTZ '2026-08-01 03:00:00+00';
