-- Performance optim das policies RLS + cobertura de FKs sem índice.
--
-- Bugs apontados pelo advisor de performance do Supabase:
--
-- 1) `auth_rls_initplan` (14 ocorrências): policies usando `auth.uid()` ou
--    `current_setting()` direto re-avaliam a função PRA CADA ROW da query.
--    Wrap em `(select auth.uid())` faz o planner avaliar UMA vez por query
--    (initplan). Diferença é negligível em volume baixo, mas se torna
--    significativa em listagens (10k+ rows). Custo zero pra fazer agora.
--
-- 2) `unindexed_foreign_keys` (4 ocorrências): JOINs e DELETE em cascata
--    sem índice de FK fazem seq scan. `appointments_canceled_by_fkey`,
--    `appointments_service_id_fkey`, `professionals_user_id_fkey`,
--    `tenants_current_plan_id_fkey`.
--
-- Refs:
--   https://supabase.com/docs/guides/database/database-advisor?lint=0003_auth_rls_initplan
--   https://supabase.com/docs/guides/database/database-advisor?lint=0001_unindexed_foreign_keys

-- ============================================================================
-- 1. Recria policies com `(select auth.uid())` em vez de `auth.uid()` direto.
-- ============================================================================

-- public.plans
drop policy if exists "plans_read_authenticated" on public.plans;
create policy "plans_read_authenticated" on public.plans
  for select
  using ((select auth.uid()) is not null);

-- public.user_profiles
drop policy if exists "user_profiles_self_read" on public.user_profiles;
create policy "user_profiles_self_read" on public.user_profiles
  for select
  using (user_id = (select auth.uid()));

-- public.customers
drop policy if exists "customers_self_read" on public.customers;
create policy "customers_self_read" on public.customers
  for select
  using (user_id = (select auth.uid()));

drop policy if exists "customers_self_update" on public.customers;
create policy "customers_self_update" on public.customers
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "customers_self_insert" on public.customers;
create policy "customers_self_insert" on public.customers
  for insert
  with check (user_id = (select auth.uid()));

-- public.appointments (3 policies do customer)
drop policy if exists "appointments_customer_read" on public.appointments;
create policy "appointments_customer_read" on public.appointments
  for select to authenticated
  using (
    customer_id in (
      select customers.id from public.customers
      where customers.user_id = (select auth.uid())
    )
  );

drop policy if exists "appointments_customer_insert" on public.appointments;
create policy "appointments_customer_insert" on public.appointments
  for insert to authenticated
  with check (
    customer_id in (
      select customers.id from public.customers
      where customers.user_id = (select auth.uid())
    )
  );

drop policy if exists "appointments_customer_update" on public.appointments;
create policy "appointments_customer_update" on public.appointments
  for update to authenticated
  using (
    customer_id in (
      select customers.id from public.customers
      where customers.user_id = (select auth.uid())
    )
  )
  with check (
    customer_id in (
      select customers.id from public.customers
      where customers.user_id = (select auth.uid())
    )
  );

-- public.services
drop policy if exists "services_customer_read" on public.services;
create policy "services_customer_read" on public.services
  for select
  using (
    exists (
      select 1 from public.customers c
      where c.tenant_id = services.tenant_id
        and c.user_id = (select auth.uid())
    )
  );

-- public.professionals
drop policy if exists "professionals_customer_read" on public.professionals;
create policy "professionals_customer_read" on public.professionals
  for select
  using (
    exists (
      select 1 from public.customers c
      where c.tenant_id = professionals.tenant_id
        and c.user_id = (select auth.uid())
    )
  );

-- public.push_subscriptions (4 policies do self-management)
drop policy if exists "push_subscriptions_self_select" on public.push_subscriptions;
create policy "push_subscriptions_self_select" on public.push_subscriptions
  for select
  using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_self_insert" on public.push_subscriptions;
create policy "push_subscriptions_self_insert" on public.push_subscriptions
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_self_update" on public.push_subscriptions;
create policy "push_subscriptions_self_update" on public.push_subscriptions
  for update
  using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_self_delete" on public.push_subscriptions;
create policy "push_subscriptions_self_delete" on public.push_subscriptions
  for delete
  using (user_id = (select auth.uid()));

-- ============================================================================
-- 2. Índices em FKs sem cobertura.
-- ============================================================================

create index if not exists appointments_canceled_by_idx
  on public.appointments (canceled_by);

create index if not exists appointments_service_id_idx
  on public.appointments (service_id);

create index if not exists professionals_user_id_idx
  on public.professionals (user_id);

create index if not exists tenants_current_plan_id_idx
  on public.tenants (current_plan_id);
