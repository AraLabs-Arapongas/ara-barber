-- supabase/seed.sql
-- Seed de planos Starter/Pro/Premium. Idempotente via on conflict.
-- Aplicado no projeto cloud em 2026-04-18 via MCP execute_sql.
-- Mantido aqui para documentação e para quando o CLI local for usado.

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
