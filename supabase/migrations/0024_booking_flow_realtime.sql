-- Habilita realtime nas tabelas operacionais que afetam o flow de booking
-- público. Sem isso, cliente em /book/horario (já logado) não percebe
-- quando staff bloqueia horário, muda jornada de profissional, fecha um
-- dia — racing condition que só aparece no submit ("Horário não disponível").
--
-- Tabelas incluídas (info operacional, sem PII):
--   - availability_blocks (alto valor: bloqueio mid-booking)
--   - business_hours (staff fecha/abre dia)
--   - professional_availability (staff muda jornada)
--
-- Tabelas DELIBERADAMENTE FORA:
--   - appointments: pra cliente, RLS já filtra (cliente só vê próprios).
--     Conflict check no server (validate_appointment_conflict) cobre
--     "outro cliente bookou enquanto eu olhava".
--   - tenants: contém billing_status, notes_internal etc — SELECT público
--     vazaria info sensível cross-tenant. Regras de agendamento mudam
--     raramente durante uma sessão; aceitar defasagem.
--
-- Escopo: SELECT só pra `authenticated`. Não usamos `anon` no projeto —
-- visitantes pré-login não fazem queries diretas (server fetch via secret
-- client). Realtime no flow /book vai funcionar a partir do passo de login
-- em diante (e em /meus-agendamentos pós-confirmação).
--
-- Pré-requisitos:
--   1. Tabela na publication `supabase_realtime`
--   2. `replica identity full` (filtros postgres_changes precisam payload completo)
--   3. SELECT policy permitindo o subscriber — RLS aplica no broadcast

-- ============================================================================
-- SELECT policies pra authenticated (broadcast realtime)
-- ============================================================================

create policy availability_blocks_authenticated_read on public.availability_blocks
  for select to authenticated
  using (true);

create policy business_hours_authenticated_read on public.business_hours
  for select to authenticated
  using (true);

create policy professional_availability_authenticated_read on public.professional_availability
  for select to authenticated
  using (true);

-- ============================================================================
-- Realtime publication + replica identity
-- ============================================================================

alter publication supabase_realtime add table public.availability_blocks;
alter publication supabase_realtime add table public.business_hours;
alter publication supabase_realtime add table public.professional_availability;

alter table public.availability_blocks replica identity full;
alter table public.business_hours replica identity full;
alter table public.professional_availability replica identity full;
