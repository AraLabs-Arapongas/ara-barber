-- Tenant pode escolher: reservas do cliente já entram CONFIRMED (sem
-- precisar staff aprovar manualmente). Útil pra negócios de alto volume
-- e baixa criticidade (barbearia, lava-jato). Default false mantém
-- comportamento atual (SCHEDULED → staff confirma).
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auto_confirm_bookings BOOLEAN NOT NULL DEFAULT false;
