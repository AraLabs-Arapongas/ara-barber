-- Serviços nem sempre têm preço fixo (clínica que cobra via plano de saúde,
-- consultoria gratuita, etc). Tornamos a coluna opcional. Quando NULL, UI
-- omite o preço (mostra só nome + duração).
ALTER TABLE public.services ALTER COLUMN price_cents DROP NOT NULL;
COMMENT ON COLUMN public.services.price_cents IS
  'Preço em centavos. NULL quando o serviço não tem preço público (ex: agendamento via plano).';
