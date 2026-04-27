-- supabase/seed.sql
-- Seed idempotente (on conflict do nothing) com planos + tenant de dev.
-- Roda automático no `supabase start` e `supabase db reset`.
-- Staff user NÃO é seedado aqui — criar via Studio local (apontar p/ dashboard).

-- Planos: PRO é base (agenda + email), PREMIUM adiciona retenção (push, WhatsApp,
-- fidelidade, no-show protection). AraLabs nunca cobra % da receita do salão —
-- monetização é 100% subscription. Valores aspiracionais; billing_status=TRIALING
-- no piloto significa "grátis pro salão piloto". Modelo final em BT-03.
insert into public.plans (id, code, name, description, monthly_price_cents, transaction_fee_type, transaction_fee_value, trial_days_default, is_active, is_default)
values
  (
    '00000000-0000-0000-0000-000000000002',
    'PRO',
    'Pro',
    'Agenda online, multi-profissional, branding, email transacional.',
    7990,
    'NONE',
    0,
    14,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'PREMIUM',
    'Premium',
    'Pro + push, WhatsApp bot, fidelidade/pontos, no-show protection, retenção automática.',
    14990,
    'NONE',
    0,
    14,
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
  '00000000-0000-0000-0000-000000000002',
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

-- ============================================================================
-- tenant_message_templates: 6 defaults pro tenant de dev (3 EMAIL + 3 WHATSAPP)
-- Edge function on-appointment-event lê dessa tabela com fallback hard-coded.
-- ============================================================================

insert into public.tenant_message_templates (tenant_id, channel, event, subject, body)
values
  ('c699b22a-c663-4831-862e-a61c474802ae', 'EMAIL',    'BOOKING_CONFIRMATION', 'Seu agendamento foi confirmado',  'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}.'),
  ('c699b22a-c663-4831-862e-a61c474802ae', 'EMAIL',    'BOOKING_CANCELLATION', 'Seu agendamento foi cancelado',   'Oi {nome}, infelizmente seu agendamento de {servico} para {horario} foi cancelado.'),
  ('c699b22a-c663-4831-862e-a61c474802ae', 'EMAIL',    'BOOKING_REMINDER',     'Lembrete do seu agendamento',     'Oi {nome}, lembrete: você tem {servico} com {profissional} {horario}.'),
  ('c699b22a-c663-4831-862e-a61c474802ae', 'WHATSAPP', 'BOOKING_CONFIRMATION', null, 'Oi {nome}, seu agendamento de {servico} com {profissional} está confirmado para {horario}. Qualquer coisa, me avisa por aqui!'),
  ('c699b22a-c663-4831-862e-a61c474802ae', 'WHATSAPP', 'BOOKING_REMINDER',     null, 'Oi {nome}, lembrete: você tem {servico} {horario}. Te espero!'),
  ('c699b22a-c663-4831-862e-a61c474802ae', 'WHATSAPP', 'SHARE_LINK',           null, 'Oi! Agora você pode agendar comigo direto por aqui: {link}')
on conflict (tenant_id, channel, event) do nothing;

-- ============================================================================
-- Staff owner pra login local: dono@dev.test / dev1234
-- Usa pgcrypto.crypt + bf pra gerar bcrypt compatível com Supabase Auth.
-- Email confirmado, sem reset/invite. Só pra dev — NUNCA usar em prod.
-- ============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, recovery_sent_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'b5d8c7c4-3a0a-4f7e-8c4b-1a0e1e2e3a4b',
  'authenticated',
  'authenticated',
  'dono@dev.test',
  crypt('dev1234', gen_salt('bf')),
  now(),
  null,
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '', '', '', ''
)
on conflict (id) do nothing;

-- Identidade auth (Supabase exige row em auth.identities pra usuário email/password)
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
values (
  'b5d8c7c4-3a0a-4f7e-8c4b-1a0e1e2e3a4b',
  'b5d8c7c4-3a0a-4f7e-8c4b-1a0e1e2e3a4b',
  '{"sub": "b5d8c7c4-3a0a-4f7e-8c4b-1a0e1e2e3a4b", "email": "dono@dev.test", "email_verified": true}',
  'email',
  'b5d8c7c4-3a0a-4f7e-8c4b-1a0e1e2e3a4b',
  now(),
  now(),
  now()
)
on conflict (provider, provider_id) do nothing;

-- user_profile linkando o auth.user ao tenant como BUSINESS_OWNER
insert into public.user_profiles (user_id, tenant_id, role, name)
values (
  'b5d8c7c4-3a0a-4f7e-8c4b-1a0e1e2e3a4b',
  'c699b22a-c663-4831-862e-a61c474802ae',
  'BUSINESS_OWNER',
  'Dono Dev'
)
on conflict (user_id, tenant_id) do nothing;

