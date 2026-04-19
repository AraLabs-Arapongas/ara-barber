-- supabase/migrations/0016_drop_public_read_policies.sql
-- Decisão: app é 100% autenticado. Nada é visível sem login — nem horário do
-- salão, nem disponibilidade de profissional. Removemos as policies de leitura
-- pública introduzidas nas migrations 0013 e 0014. Toda leitura passa por
-- server action com sessão válida do cliente autenticado.

drop policy if exists "business_hours_public_read" on public.business_hours;
drop policy if exists "professional_availability_public_read" on public.professional_availability;
