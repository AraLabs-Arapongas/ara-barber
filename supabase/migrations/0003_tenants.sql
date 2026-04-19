-- supabase/migrations/0003_tenants.sql
-- Tenants (barbearias/salões) com identidade, branding e snapshot de billing.
-- billing_events (auditoria de mudanças de plano/preço) vem no Épico 7.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),

  -- identidade
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name text not null,
  subdomain text not null unique,
  custom_domain text unique,
  status public.tenant_status not null default 'ACTIVE',
  timezone text not null default 'America/Sao_Paulo',

  -- branding
  logo_url text,
  favicon_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  contact_phone text,
  whatsapp text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,

  -- billing (estado atual + snapshots)
  current_plan_id uuid references public.plans(id) on delete restrict,
  billing_status public.billing_status not null default 'TRIALING',
  billing_model public.billing_model not null default 'TRIAL',
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  transaction_fee_type public.transaction_fee_type not null default 'NONE',
  transaction_fee_value integer not null default 0 check (transaction_fee_value >= 0),
  transaction_fee_fixed_cents integer,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  trial_days_granted integer,
  is_custom_trial boolean not null default false,
  subscription_starts_at timestamptz,
  subscription_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  notes_internal text,

  -- operação
  operation_mode_pin_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_status_idx on public.tenants (status);
create index tenants_billing_status_idx on public.tenants (billing_status);
create index tenants_custom_domain_idx on public.tenants (custom_domain) where custom_domain is not null;

create trigger tenants_touch_updated_at
  before update on public.tenants
  for each row execute function public.touch_updated_at();

alter table public.tenants enable row level security;
