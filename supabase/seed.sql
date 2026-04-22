-- supabase/seed.sql
-- Seed idempotente (on conflict do nothing) com planos + tenant de dev.
-- Roda automático no `supabase start` e `supabase db reset`.
-- Staff user NÃO é seedado aqui — criar via Studio local (apontar p/ dashboard).

insert into public.plans (id, code, name, description, monthly_price_cents, transaction_fee_type, transaction_fee_value, trial_days_default, is_active, is_default)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'STARTER',
    'Starter',
    'Plano inicial — ideal para salões pequenos.',
    4900,
    'PERCENTAGE',
    700,
    30,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'PRO',
    'Pro',
    'Plano intermediário — até 5 profissionais, taxa reduzida.',
    12900,
    'PERCENTAGE',
    300,
    30,
    true,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'PREMIUM',
    'Premium',
    'Plano premium — sem taxa por transação, recursos completos.',
    24900,
    'NONE',
    0,
    30,
    true,
    false
  )
on conflict (id) do nothing;

-- ============================================================================
-- Tenant de dev: Bela Imagem Centro de Beleza
-- ============================================================================

insert into public.tenants (
  id, slug, name, subdomain, timezone,
  primary_color, accent_color,
  current_plan_id, billing_status, billing_model
)
values (
  'c699b22a-c663-4831-862e-a61c474802ae',
  'salao-bela-imagem',
  'Bela Imagem Centro de Beleza',
  'salao-bela-imagem',
  'America/Sao_Paulo',
  '#9d4d6e',
  '#e6c8a0',
  '00000000-0000-0000-0000-000000000001',
  'TRIALING',
  'TRIAL'
)
on conflict (id) do nothing;

-- Horários: seg-sáb 9h-19h, domingo fechado (weekday 0=dom)
insert into public.business_hours (tenant_id, weekday, start_time, end_time, is_open)
values
  ('c699b22a-c663-4831-862e-a61c474802ae', 0, '09:00', '19:00', false),
  ('c699b22a-c663-4831-862e-a61c474802ae', 1, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', 2, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', 3, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', 4, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', 5, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', 6, '09:00', '19:00', true)
on conflict (tenant_id, weekday) do nothing;

-- Serviços
insert into public.services (id, tenant_id, name, description, duration_minutes, price_cents, is_active)
values
  (
    'e87fe32d-c33f-4d47-b0af-1d9427334432',
    'c699b22a-c663-4831-862e-a61c474802ae',
    'Corte feminino',
    'Lavagem, corte e finalização com escova.',
    60,
    12000,
    true
  ),
  (
    '8ab3143b-b603-4f1c-87fc-d0dc933c3a06',
    'c699b22a-c663-4831-862e-a61c474802ae',
    'Manicure',
    'Esmaltação comum ou em gel, com cuticulagem.',
    45,
    6500,
    true
  ),
  (
    'ae927845-0bfa-422e-87f2-6fb99b37ee04',
    'c699b22a-c663-4831-862e-a61c474802ae',
    'Design de sobrancelhas',
    'Modelagem com pinça e finalização com henna opcional.',
    30,
    5000,
    true
  )
on conflict (id) do nothing;

-- Profissionais
insert into public.professionals (id, tenant_id, name, display_name, is_active)
values
  (
    '03a8df2d-e155-4b51-af3e-4b967720a2ed',
    'c699b22a-c663-4831-862e-a61c474802ae',
    'Mariana Oliveira',
    'Mari',
    true
  ),
  (
    '98fd8218-090a-4d88-a16a-85f780bd6478',
    'c699b22a-c663-4831-862e-a61c474802ae',
    'Joana Costa',
    'Jô',
    true
  )
on conflict (id) do nothing;

-- professional_services: Mari faz todos; Jô faz manicure + sobrancelhas
insert into public.professional_services (tenant_id, professional_id, service_id)
values
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 'e87fe32d-c33f-4d47-b0af-1d9427334432'),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', '8ab3143b-b603-4f1c-87fc-d0dc933c3a06'),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 'ae927845-0bfa-422e-87f2-6fb99b37ee04'),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', '8ab3143b-b603-4f1c-87fc-d0dc933c3a06'),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 'ae927845-0bfa-422e-87f2-6fb99b37ee04')
on conflict (tenant_id, professional_id, service_id) do nothing;

-- professional_availability: ambas trabalham seg-sáb 9h-19h (casa com business_hours)
insert into public.professional_availability (tenant_id, professional_id, weekday, start_time, end_time, is_available)
values
  -- Mariana
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 1, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 2, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 3, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 4, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 5, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '03a8df2d-e155-4b51-af3e-4b967720a2ed', 6, '09:00', '19:00', true),
  -- Joana
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 1, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 2, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 3, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 4, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 5, '09:00', '19:00', true),
  ('c699b22a-c663-4831-862e-a61c474802ae', '98fd8218-090a-4d88-a16a-85f780bd6478', 6, '09:00', '19:00', true)
on conflict (tenant_id, professional_id, weekday, start_time) do nothing;
