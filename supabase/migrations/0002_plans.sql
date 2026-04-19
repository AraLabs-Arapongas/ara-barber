-- supabase/migrations/0002_plans.sql
-- Catálogo global de planos (Starter/Pro/Premium). Leitura livre para autenticados, escrita só para platform admin.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  transaction_fee_type public.transaction_fee_type not null default 'NONE',
  transaction_fee_value integer not null default 0 check (transaction_fee_value >= 0),
  transaction_fee_fixed_cents integer check (transaction_fee_fixed_cents is null or transaction_fee_fixed_cents >= 0),
  trial_days_default integer not null default 30 check (trial_days_default >= 0),
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Apenas um plano pode ser default por vez.
create unique index plans_default_unique
  on public.plans (is_default)
  where is_default = true;

-- updated_at trigger reutilizável (idempotente).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

-- RLS habilitado (o trigger automático do projeto já faz, mas declaramos explícito).
alter table public.plans enable row level security;
