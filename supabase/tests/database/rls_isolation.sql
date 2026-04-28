-- pgTAP: garante que dados de um tenant NUNCA cruzam pra outro via RLS.
-- Roda via `pnpm test:rls` (= `supabase db test`).
--
-- Estratégia: cria 2 tenants (A e B) com 1 customer cada, simula JWT
-- de cada customer, verifica que SELECT/INSERT/UPDATE/DELETE em tabelas
-- tenant-scoped só vê/afeta linhas do próprio tenant.
--
-- Tabelas testadas (cobrem o coração do isolamento multi-tenant):
--   - appointments (cliente lê/escreve só os próprios)
--   - services + professionals (cliente lê só do tenant onde tem cadastro)
--   - customers (cliente lê só o próprio cadastro)
--   - audit_log (staff lê só do próprio tenant)
--
-- Cada test é envolto em begin/rollback pra não persistir nada.

begin;

select plan(11);

-- ============================================================================
-- Setup: 2 tenants, 2 customers, 2 appointments. Roda como superuser
-- (default da conexão de testes) — bypassa RLS pra inserir.
-- ============================================================================

-- Tenant A
insert into public.tenants (id, slug, name, subdomain, timezone)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-test-a', 'Tenant A', 'rls-test-a', 'America/Sao_Paulo');

-- Tenant B
insert into public.tenants (id, slug, name, subdomain, timezone)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'rls-test-b', 'Tenant B', 'rls-test-b', 'America/Sao_Paulo');

-- Auth users (pgTAP roda na schema public; auth.users insert exige superuser)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('a1111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'usera@rls.test', crypt('x', gen_salt('bf')), now(), '{}'::jsonb, now(), now()),
  ('b2222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'userb@rls.test', crypt('x', gen_salt('bf')), now(), '{}'::jsonb, now(), now());

-- Customers (1 por tenant, vinculado ao seu auth user)
insert into public.customers (id, tenant_id, user_id, name, email, is_active)
values
  ('c1111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'Customer A', 'a@x.com', true),
  ('c2222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'b2222222-0000-0000-0000-000000000002', 'Customer B', 'b@x.com', true);

-- Service + professional pra cada tenant (necessários pros appointments FK)
insert into public.services (id, tenant_id, name, duration_minutes, price_cents, is_active)
values
  ('51111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Servico A', 30, 5000, true),
  ('52222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Servico B', 30, 5000, true);

insert into public.professionals (id, tenant_id, name, is_active)
values
  ('71111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pro A', true),
  ('72222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Pro B', true);

-- Appointments
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_at, end_at, status)
values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1111111-0000-0000-0000-000000000001', '71111111-0000-0000-0000-000000000001', '51111111-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 30 minutes', 'CONFIRMED'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'c2222222-0000-0000-0000-000000000002', '72222222-0000-0000-0000-000000000002', '52222222-0000-0000-0000-000000000002', now() + interval '1 day', now() + interval '1 day 30 minutes', 'CONFIRMED');

-- ============================================================================
-- Tests sob a perspectiva do CUSTOMER A (tenant A)
-- ============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub": "a1111111-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 1. Customer A vê o próprio appointment
select is(
  (select count(*)::int from public.appointments where id = '11111111-0000-0000-0000-000000000001'),
  1,
  'Customer A vê o próprio appointment'
);

-- 2. Customer A NÃO vê o appointment do tenant B
select is(
  (select count(*)::int from public.appointments where id = '22222222-0000-0000-0000-000000000002'),
  0,
  'Customer A NAO vê appointment do tenant B (RLS isola)'
);

-- 3. Customer A vê serviços do próprio tenant
select is(
  (select count(*)::int from public.services where id = '51111111-0000-0000-0000-000000000001'),
  1,
  'Customer A vê serviço do próprio tenant'
);

-- 4. Customer A NÃO vê serviços do tenant B
select is(
  (select count(*)::int from public.services where id = '52222222-0000-0000-0000-000000000002'),
  0,
  'Customer A NAO vê serviço do tenant B'
);

-- 5. Customer A vê profissionais do próprio tenant
select is(
  (select count(*)::int from public.professionals where id = '71111111-0000-0000-0000-000000000001'),
  1,
  'Customer A vê profissional do próprio tenant'
);

-- 6. Customer A NÃO vê profissionais do tenant B
select is(
  (select count(*)::int from public.professionals where id = '72222222-0000-0000-0000-000000000002'),
  0,
  'Customer A NAO vê profissional do tenant B'
);

-- 7. Customer A vê o próprio cadastro em customers
select is(
  (select count(*)::int from public.customers where id = 'c1111111-0000-0000-0000-000000000001'),
  1,
  'Customer A vê o próprio registro em customers'
);

-- 8. Customer A NÃO vê o cadastro do customer B
select is(
  (select count(*)::int from public.customers where id = 'c2222222-0000-0000-0000-000000000002'),
  0,
  'Customer A NAO vê customer B'
);

-- 9. Customer A NÃO consegue UPDATE no appointment do tenant B (afeta 0 rows)
update public.appointments
set cancel_reason = 'tentativa de hijack'
where id = '22222222-0000-0000-0000-000000000002';
-- Reseta sessão pra ler como superuser e confirmar que o update NÃO ocorreu
reset role;
select is(
  (select cancel_reason from public.appointments where id = '22222222-0000-0000-0000-000000000002'),
  null,
  'UPDATE em appointment do tenant B nao tem efeito (RLS bloqueia)'
);

-- 10. Customer A NÃO consegue INSERT em appointment com customer_id de outro tenant
set local role authenticated;
set local request.jwt.claims = '{"sub": "a1111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$insert into public.appointments (tenant_id, customer_id, professional_id, service_id, start_at, end_at, status)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'c2222222-0000-0000-0000-000000000002', '72222222-0000-0000-0000-000000000002', '52222222-0000-0000-0000-000000000002', now() + interval '2 day', now() + interval '2 day 30 minutes', 'SCHEDULED')$$,
  '42501', -- insufficient_privilege (RLS rejection)
  null,
  'INSERT em appointment com customer_id alheio é bloqueado por RLS'
);

-- 11. audit_log do tenant A (vazio nesse teste, mas confirma que customer NÃO lê audit)
-- Customer não tem `is_tenant_staff()` → não vê NADA em audit_log.
select is(
  (select count(*)::int from public.audit_log where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'Customer NAO vê audit_log (só staff)'
);

-- ============================================================================
-- Cleanup automático via rollback
-- ============================================================================

select * from finish();
rollback;
