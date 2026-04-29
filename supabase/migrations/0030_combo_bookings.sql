-- Combo bookings: cliente reserva N serviços numa única ação,
-- executados back-to-back. Spec em
-- docs/superpowers/specs/2026-04-29-combo-bookings-design.md.
--
-- Decisões:
--   - `appointment_groups` agrega N appointments num combo único.
--   - `appointments.group_id` é nullable; single bookings têm null
--     e mantém 100% do comportamento atual (backward compat).
--   - `appointments.position` define a ordem dos serviços no combo.
--   - `tenants.combo_buffer_minutes` define a transição entre profs
--     diferentes (default 10, configurável pelo staff em Regras).

create table public.appointment_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status public.appointment_status not null default 'SCHEDULED',
  total_duration_minutes integer not null,
  total_price_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointment_groups_tenant_idx
  on public.appointment_groups (tenant_id);
create index appointment_groups_customer_idx
  on public.appointment_groups (customer_id);

alter table public.appointments
  add column group_id uuid references public.appointment_groups(id) on delete set null,
  add column position integer;

create index appointments_group_idx
  on public.appointments (group_id)
  where group_id is not null;

alter table public.tenants
  add column combo_buffer_minutes integer not null default 10
    check (combo_buffer_minutes between 0 and 60);

-- RLS: espelha appointments. Staff lê/escreve do próprio tenant;
-- cliente lê/insere/atualiza só os próprios groups.
alter table public.appointment_groups enable row level security;

create policy appointment_groups_tenant_staff_all on public.appointment_groups
  for all using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy appointment_groups_platform_admin on public.appointment_groups
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy appointment_groups_customer_read on public.appointment_groups
  for select to authenticated
  using (customer_id in (
    select id from public.customers where user_id = (select auth.uid())
  ));

create policy appointment_groups_customer_insert on public.appointment_groups
  for insert to authenticated
  with check (customer_id in (
    select id from public.customers where user_id = (select auth.uid())
  ));

create policy appointment_groups_customer_update on public.appointment_groups
  for update to authenticated
  using (customer_id in (
    select id from public.customers where user_id = (select auth.uid())
  ));
