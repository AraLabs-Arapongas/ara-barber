-- Bug histórico: coluna `plans.id` não tinha default `gen_random_uuid()`,
-- então o seed inicial inseriu IDs placeholder ('00000000-0000-...0002').
-- Esses IDs causam confusão visual no admin e podem mascarar bugs futuros
-- (ex: comparações por prefix, geração colidente, etc).

-- 1) Default automático pra plans futuros nascerem com UUID real.
ALTER TABLE public.plans
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2) Substituir os IDs placeholder por UUIDs reais propagando pra
--    tenants.current_plan_id. FK não tem CASCADE e plans_default_unique
--    impede ter 2 plans is_default=true simultâneos — sequência é:
--    a) clona com novo ID e is_default=false (evita unique)
--    b) reaponta tenants pro novo ID
--    c) deleta o plan antigo
--    d) restaura is_default original e tira sufixo _TMP do code
DO $$
DECLARE
  r RECORD;
  new_id uuid;
  was_default boolean;
BEGIN
  FOR r IN SELECT id, is_default FROM public.plans WHERE id::text LIKE '00000000-0000-0000-0000-%' LOOP
    new_id := gen_random_uuid();
    was_default := r.is_default;

    INSERT INTO public.plans (
      id, code, name, description, monthly_price_cents,
      transaction_fee_type, transaction_fee_value, transaction_fee_fixed_cents,
      trial_days_default, is_active, is_default,
      included_professionals, extra_professional_price_cents,
      created_at, updated_at
    )
    SELECT new_id, code || '_TMP', name, description, monthly_price_cents,
           transaction_fee_type, transaction_fee_value, transaction_fee_fixed_cents,
           trial_days_default, is_active, false,
           included_professionals, extra_professional_price_cents,
           created_at, updated_at
      FROM public.plans WHERE id = r.id;

    UPDATE public.tenants SET current_plan_id = new_id WHERE current_plan_id = r.id;
    DELETE FROM public.plans WHERE id = r.id;

    UPDATE public.plans
       SET code = REPLACE(code, '_TMP', ''),
           is_default = was_default
     WHERE id = new_id;
  END LOOP;
END $$;
