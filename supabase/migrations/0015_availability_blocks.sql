-- supabase/migrations/0015_availability_blocks.sql
-- Bloqueios pontuais de agenda (férias, folga, consulta médica, etc).
-- Substituem a disponibilidade recorrente numa janela específica (timestamptz).
-- Sem trigger de updated_at — bloqueio é criado/deletado, não editado.
-- Sem policy pública — bloqueio vaza info sensível (ex: médica).

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),

  constraint availability_blocks_time_order check (start_at < end_at)
);

create index availability_blocks_prof_range_idx
  on public.availability_blocks (professional_id, start_at, end_at);

alter table public.availability_blocks enable row level security;

create policy "availability_blocks_platform_admin_all" on public.availability_blocks
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "availability_blocks_tenant_staff_all" on public.availability_blocks
  for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
