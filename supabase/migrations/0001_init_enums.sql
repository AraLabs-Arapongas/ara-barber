-- supabase/migrations/0001_init_enums.sql
-- Enums base do ara-barber: papéis de usuário, status de tenant e modelos de billing.

create type public.user_role as enum (
  'PLATFORM_ADMIN',
  'SALON_OWNER',
  'RECEPTIONIST',
  'PROFESSIONAL',
  'CUSTOMER'
);

create type public.tenant_status as enum (
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

create type public.billing_status as enum (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELED'
);

create type public.billing_model as enum (
  'TRIAL',
  'SUBSCRIPTION_WITH_TRANSACTION_FEE'
);

create type public.transaction_fee_type as enum (
  'PERCENTAGE',
  'FIXED',
  'NONE'
);
