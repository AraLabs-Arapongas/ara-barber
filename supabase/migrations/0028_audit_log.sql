-- Audit log de mutations sensíveis. Captura "quem fez o quê" pra
-- suporte interno, troubleshooting, eventual auditoria LGPD.
--
-- Escopo (Fase 1):
--   - Cancelamento de appointment (cliente self-cancel + staff cancel)
--   - Criação de appointment (cliente via /book + staff via wizard manual)
--   - Mudança de regras do tenant (Mais → Regras)
--   - Auto-exclusão de conta do cliente
--
-- Fora de escopo (entra depois conforme aparecer demanda):
--   - Edição de serviços/profissionais (CRUD não-destrutivo)
--   - Atualização de perfil/branding (cosmético)
--   - Login/logout (Supabase Auth já tem audit interno)
--
-- Escrita: SOMENTE via service role (helper `recordAudit` no lib/audit).
-- Não há RLS de INSERT — secret client bypassa qualquer forma. Mantemos
-- rota única pra garantir que toda escrita passa pelo helper (que injeta
-- actor + role + tenant consistentes).

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  -- actor pode ser null em jobs/cron/edge functions sem usuário autenticado.
  actor_user_id uuid references auth.users(id) on delete set null,
  -- snapshot do role no momento da ação (não vira FK pra enum porque o
  -- valor pode ficar histórico mesmo após rebrand de roles).
  actor_role text,
  -- ação canônica em formato `entidade.verbo` (snake_case com ponto).
  -- Ex: `appointment.cancel`, `tenant.rules.update`, `customer.delete`.
  action text not null,
  -- referência opcional à entidade afetada (pra timeline por entity).
  entity_type text,
  entity_id uuid,
  -- payload livre pra contexto: before/after, motivo, ip, etc. JSONB pra
  -- query (ex: `changes->>'cancel_reason'`).
  changes jsonb,
  created_at timestamptz not null default now()
);

-- Listagem mais comum: timeline do tenant. Index DESC pra `order by ... desc limit N`.
create index audit_log_tenant_created_idx
  on public.audit_log (tenant_id, created_at desc);

-- Lookup por entidade: "quem mexeu nesse appointment?"
create index audit_log_entity_idx
  on public.audit_log (entity_type, entity_id)
  where entity_type is not null;

alter table public.audit_log enable row level security;

-- Staff do tenant lê audit do próprio tenant. Nada de cross-tenant.
create policy audit_log_tenant_staff_read on public.audit_log
  for select to authenticated
  using (public.is_tenant_staff(tenant_id));

-- Platform admin lê tudo (suporte cross-tenant).
create policy audit_log_platform_admin_read on public.audit_log
  for select to authenticated
  using (public.is_platform_admin());

-- DELIBERADAMENTE sem policies de INSERT/UPDATE/DELETE.
-- Toda escrita passa pelo `recordAudit()` que usa service role
-- (createSecretClient). Inserções diretas via JWT do cliente são
-- bloqueadas por padrão (RLS sem policy permissiva = nega tudo).
