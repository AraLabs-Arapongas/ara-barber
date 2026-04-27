-- M3 do revamp 2026-04-26 — templates editáveis de e-mail e WhatsApp por tenant.
-- Edge function `on-appointment-event` lê dessa tabela com fallback hard-coded.

create table public.tenant_message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel text not null check (channel in ('EMAIL', 'WHATSAPP')),
  event text not null check (event in (
    'BOOKING_CONFIRMATION',
    'BOOKING_CANCELLATION',
    'BOOKING_REMINDER',
    'BOOKING_THANKS',
    'SHARE_LINK',
    'CUSTOM'
  )),
  enabled boolean not null default true,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel, event)
);

create index tenant_message_templates_tenant_idx
  on public.tenant_message_templates (tenant_id);

alter table public.tenant_message_templates enable row level security;

create policy tenant_message_templates_staff_all on public.tenant_message_templates
  for all using (public.is_tenant_staff(tenant_id))
  with check (public.is_tenant_staff(tenant_id));

create policy tenant_message_templates_platform_admin on public.tenant_message_templates
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());
