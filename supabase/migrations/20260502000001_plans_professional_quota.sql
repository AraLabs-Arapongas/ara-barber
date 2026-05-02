-- Adiciona regra de cobrança por profissional aos plans:
-- R$ 79/mês inclui até 10 profissionais ativos. Acima disso,
-- R$ 19,90/mês por profissional adicional.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS included_professionals integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS extra_professional_price_cents integer NOT NULL DEFAULT 1990;

COMMENT ON COLUMN public.plans.included_professionals IS
  'Quantos profissionais ativos o tenant pode ter sem custo extra. Acima disso, cobra extra_professional_price_cents por profissional adicional.';

COMMENT ON COLUMN public.plans.extra_professional_price_cents IS
  'Preço mensal em centavos por profissional ativo acima de included_professionals.';

UPDATE public.plans
   SET included_professionals = 10,
       extra_professional_price_cents = 1990
 WHERE included_professionals IS NULL
    OR extra_professional_price_cents IS NULL
    OR included_professionals = 0;
