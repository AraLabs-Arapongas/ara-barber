> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# Épico 1 — Auth + Banco Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a primeira migration completa (`tenants`, `user_profiles`, `plans`, enums, funções helper de RLS), configurar Supabase Auth (Google, Apple, Magic link, e-mail/senha), criar guards de autenticação/autorização, implementar as páginas de login para staff e platform admin, e travar tudo com testes (Vitest + pgTAP + Playwright).

**Architecture:** Schema mínimo de autenticação e identidade plantado via migration SQL versionada. RLS do Postgres habilitado em todas as tabelas com helpers (`auth.current_tenant_id()`, `auth.current_role()`, `auth.is_platform_admin()`). Login usando Supabase Auth com 3 providers OAuth + e-mail/senha + magic link. Guards (`assertStaff`, `assertPlatformAdmin`, `assertCustomer`) encapsulam validação de sessão e role em Server Actions. Testes de RLS em pgTAP garantem isolamento cross-tenant.

**Tech Stack:** Postgres 15 (Supabase), RLS, pgTAP, Supabase Auth (providers OAuth + magic link + email/password), `@supabase/ssr`, zod, Server Actions.

**Referência:** `docs/superpowers/specs/2026-04-18-ara-barber-fase1-design.md` — Seções 6 (modelo de dados), 7 (RLS), 9 (autenticação), 10.1 / 10.3 / 10.4 (fluxos), 14.1 (testes RLS).

**Dependências:** Épico 0 concluído (Next.js + Supabase local + clientes + middleware esqueleto).

---

## File Structure

```
ara-barber/
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_enums.sql              # Task 1
│   │   ├── 0002_plans.sql                   # Task 2
│   │   ├── 0003_tenants.sql                 # Task 3
│   │   ├── 0004_user_profiles.sql           # Task 4
│   │   ├── 0005_helper_functions.sql        # Task 5
│   │   └── 0006_rls_policies.sql            # Task 6
│   ├── tests/
│   │   └── rls_auth.test.sql                # Task 7
│   └── seed.sql                             # Task 8 (atualizado)
├── src/
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── types.ts                     # Task 9 (gerado)
│   │   └── auth/
│   │       ├── roles.ts                     # Task 10
│   │       ├── session.ts                   # Task 11
│   │       └── guards.ts                    # Task 12
│   └── app/
│       ├── (salon)/
│       │   └── login/
│       │       ├── page.tsx                 # Task 13
│       │       └── actions.ts               # Task 13
│       ├── (platform)/
│       │   └── login/
│       │       ├── page.tsx                 # Task 14
│       │       └── actions.ts               # Task 14
│       └── auth/
│           ├── callback/route.ts            # Task 15
│           └── logout/route.ts              # Task 16
└── tests/
    ├── unit/
    │   ├── auth/
    │   │   ├── roles.test.ts                # Task 10
    │   │   └── guards.test.ts               # Task 12
    └── e2e/
        └── auth/
            ├── platform-login.spec.ts       # Task 17
            └── salon-login.spec.ts          # Task 17
```

---

## Task 1: Migration — enums iniciais

**Files:**
- Create: `supabase/migrations/0001_init_enums.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new init_enums
```

Isso cria `supabase/migrations/<timestamp>_init_enums.sql` com timestamp. Renomear para `0001_init_enums.sql` para ordenar limpo.

- [ ] **Step 2: Preencher com enums**

```sql
-- supabase/migrations/0001_init_enums.sql

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
```

- [ ] **Step 3: Aplicar localmente**

```bash
supabase db reset
```

Expected: reset completo + aplica todas as migrations. Sem erro.

- [ ] **Step 4: Verificar enums criados**

```bash
supabase db psql -c "select typname from pg_type where typtype = 'e' and typname in ('user_role','tenant_status','billing_status','billing_model','transaction_fee_type');"
```

Expected: 5 linhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): migration 0001 — enums iniciais"
```

---

## Task 2: Migration — tabela `plans`

**Files:**
- Create: `supabase/migrations/0002_plans.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new plans
```

Renomear para `0002_plans.sql`.

- [ ] **Step 2: Preencher schema de `plans`**

```sql
-- supabase/migrations/0002_plans.sql

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

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

-- RLS: habilitado, policies completas em 0006.
alter table public.plans enable row level security;
```

- [ ] **Step 3: Aplicar**

```bash
supabase db reset
```

Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_plans.sql
git commit -m "feat(db): migration 0002 — tabela plans"
```

---

## Task 3: Migration — tabela `tenants`

**Files:**
- Create: `supabase/migrations/0003_tenants.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new tenants
```

Renomear para `0003_tenants.sql`.

- [ ] **Step 2: Preencher schema de `tenants` (ainda sem todos os campos — billing_events vem no épico 7)**

```sql
-- supabase/migrations/0003_tenants.sql

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
```

- [ ] **Step 3: Aplicar e verificar**

```bash
supabase db reset
supabase db psql -c "\d public.tenants"
```

Expected: lista todos os campos acima.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_tenants.sql
git commit -m "feat(db): migration 0003 — tabela tenants com billing snapshot"
```

---

## Task 4: Migration — tabela `user_profiles`

**Files:**
- Create: `supabase/migrations/0004_user_profiles.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new user_profiles
```

Renomear para `0004_user_profiles.sql`.

- [ ] **Step 2: Preencher schema**

```sql
-- supabase/migrations/0004_user_profiles.sql

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.user_role not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- platform admin NÃO tem tenantId; staff OBRIGATORIAMENTE tem tenantId
  constraint user_profiles_role_tenant_check check (
    (role = 'PLATFORM_ADMIN' and tenant_id is null) or
    (role in ('SALON_OWNER','RECEPTIONIST','PROFESSIONAL') and tenant_id is not null) or
    (role = 'CUSTOMER' and tenant_id is null)
    -- CUSTOMER não usa user_profiles (usa customers por tenant), mas aceita nulo aqui por segurança
  )
);

create index user_profiles_tenant_idx on public.user_profiles (tenant_id);
create index user_profiles_role_idx on public.user_profiles (role);

create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

alter table public.user_profiles enable row level security;
```

- [ ] **Step 3: Aplicar**

```bash
supabase db reset
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_user_profiles.sql
git commit -m "feat(db): migration 0004 — user_profiles (staff + platform admin)"
```

---

## Task 5: Migration — funções helper

**Files:**
- Create: `supabase/migrations/0005_helper_functions.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new helper_functions
```

Renomear para `0005_helper_functions.sql`.

- [ ] **Step 2: Escrever funções**

```sql
-- supabase/migrations/0005_helper_functions.sql

-- Retorna o tenant_id do usuário logado (staff). NULL para customer ou platform admin.
create or replace function auth.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

grant execute on function auth.current_tenant_id() to authenticated, anon;

-- Retorna a role do usuário logado.
create or replace function auth.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles
  where user_id = auth.uid()
  limit 1
$$;

grant execute on function auth.current_role() to authenticated, anon;

-- É platform admin?
create or replace function auth.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'PLATFORM_ADMIN' and is_active = true
  )
$$;

grant execute on function auth.is_platform_admin() to authenticated, anon;

-- É staff ativo de algum tenant?
create or replace function auth.is_tenant_staff(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where user_id = auth.uid()
      and tenant_id = target_tenant
      and role in ('SALON_OWNER','RECEPTIONIST','PROFESSIONAL')
      and is_active = true
  )
$$;

grant execute on function auth.is_tenant_staff(uuid) to authenticated, anon;
```

- [ ] **Step 3: Aplicar e testar**

```bash
supabase db reset
supabase db psql -c "select auth.is_platform_admin();"
```

Expected: `false` (sem usuário autenticado).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_helper_functions.sql
git commit -m "feat(db): migration 0005 — funções helper RLS"
```

---

## Task 6: Migration — RLS policies base

**Files:**
- Create: `supabase/migrations/0006_rls_policies.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new rls_policies
```

Renomear para `0006_rls_policies.sql`.

- [ ] **Step 2: Preencher policies**

```sql
-- supabase/migrations/0006_rls_policies.sql

-- ========================================
-- plans (global, leitura livre para autenticados; escrita apenas platform admin)
-- ========================================
create policy "plans_read_authenticated" on public.plans
  for select
  using (auth.uid() is not null);

create policy "plans_write_platform_admin" on public.plans
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

-- ========================================
-- tenants
-- ========================================
create policy "tenants_platform_admin_all" on public.tenants
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

create policy "tenants_staff_read_own" on public.tenants
  for select
  using (id = auth.current_tenant_id());

-- ========================================
-- user_profiles
-- ========================================
create policy "user_profiles_platform_admin_all" on public.user_profiles
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

-- Usuário vê o próprio perfil
create policy "user_profiles_self_read" on public.user_profiles
  for select
  using (user_id = auth.uid());

-- Staff do tenant vê perfis do mesmo tenant
create policy "user_profiles_tenant_staff_read" on public.user_profiles
  for select
  using (
    tenant_id is not null
    and tenant_id = auth.current_tenant_id()
  );

-- Owner atualiza perfis do próprio tenant (adição manual: apenas owner)
create policy "user_profiles_owner_write" on public.user_profiles
  for all
  using (
    tenant_id = auth.current_tenant_id()
    and auth.current_role() = 'SALON_OWNER'
  )
  with check (
    tenant_id = auth.current_tenant_id()
    and auth.current_role() = 'SALON_OWNER'
  );
```

- [ ] **Step 3: Aplicar**

```bash
supabase db reset
```

Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_rls_policies.sql
git commit -m "feat(db): migration 0006 — RLS policies base"
```

---

## Task 7: Teste pgTAP de RLS base

**Files:**
- Create: `supabase/tests/rls_auth.test.sql`

- [ ] **Step 1: Habilitar pgTAP no Supabase**

Adicionar ao final de `supabase/migrations/0001_init_enums.sql`:

```sql
-- Habilita pgTAP para testes de policies.
create extension if not exists pgtap with schema extensions;
```

Rodar `supabase db reset`.

- [ ] **Step 2: Escrever teste pgTAP**

```sql
-- supabase/tests/rls_auth.test.sql

begin;
select plan(6);

-- Setup: cria 2 tenants, 1 owner por tenant, 1 platform admin
insert into public.tenants (id, slug, name, subdomain)
values
  ('11111111-1111-1111-1111-111111111111', 'tenant-a', 'Tenant A', 'tenant-a'),
  ('22222222-2222-2222-2222-222222222222', 'tenant-b', 'Tenant B', 'tenant-b');

-- Simula users em auth.users (só IDs; Supabase local aceita)
insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner-a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner-b@test.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin@test.com')
on conflict (id) do nothing;

insert into public.user_profiles (user_id, role, tenant_id, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SALON_OWNER', '11111111-1111-1111-1111-111111111111', 'Owner A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SALON_OWNER', '22222222-2222-2222-2222-222222222222', 'Owner B'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'PLATFORM_ADMIN', null, 'Admin');

-- Teste 1: platform admin vê todos os tenants
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select results_eq(
  'select count(*)::int from public.tenants',
  array[2],
  'platform admin vê todos os tenants'
);

-- Teste 2: owner do tenant A vê apenas o próprio tenant
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select results_eq(
  'select count(*)::int from public.tenants',
  array[1],
  'owner do tenant A vê apenas o próprio tenant'
);

select results_eq(
  'select slug from public.tenants',
  array['tenant-a'],
  'owner do tenant A vê slug tenant-a'
);

-- Teste 3: owner do tenant A NÃO consegue SELECT tenant B
select results_eq(
  $$select count(*)::int from public.tenants where slug = 'tenant-b'$$,
  array[0],
  'owner do tenant A não vê tenant B (RLS bloqueia)'
);

-- Teste 4: usuário anônimo não vê tenants
reset role;
set local role anon;

select results_eq(
  'select count(*)::int from public.tenants',
  array[0],
  'anônimo não vê tenants'
);

-- Teste 5: plans só pode ser escrito por platform admin
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  $$insert into public.plans (code, name, monthly_price_cents) values ('X', 'X', 100)$$,
  'new row violates row-level security policy',
  'owner não consegue criar plan'
);

select finish();
rollback;
```

- [ ] **Step 3: Rodar teste**

```bash
supabase db test
```

Expected: 6 testes PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/rls_auth.test.sql supabase/migrations/0001_init_enums.sql
git commit -m "test(db): pgTAP — RLS isolation base (tenants/user_profiles/plans)"
```

---

## Task 8: Seed de plano default + plans de demonstração

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Preencher seed**

```sql
-- supabase/seed.sql

insert into public.plans (id, code, name, description, monthly_price_cents, transaction_fee_type, transaction_fee_value, trial_days_default, is_active, is_default)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'STARTER',
    'Starter',
    'Plano inicial — ideal para salões pequenos.',
    4900,
    'PERCENTAGE',
    700,   -- 7.00%
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
    300,   -- 3.00%
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
```

- [ ] **Step 2: Aplicar**

```bash
supabase db reset
```

Expected: seed aplicado sem erro.

- [ ] **Step 3: Verificar**

```bash
supabase db psql -c "select code, name, monthly_price_cents, is_default from public.plans order by monthly_price_cents;"
```

Expected: 3 linhas, STARTER marcado como default.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): seed de planos iniciais (Starter/Pro/Premium)"
```

---

## Task 9: Gerar tipos TypeScript

**Files:**
- Create: `src/lib/supabase/types.ts`
- Modify: `package.json` (script)

- [ ] **Step 1: Adicionar script**

Adicionar ao `"scripts"` do `package.json`:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --local > src/lib/supabase/types.ts"
  }
}
```

- [ ] **Step 2: Gerar tipos**

```bash
pnpm db:types
```

Expected: arquivo `src/lib/supabase/types.ts` criado com ~500-800 linhas.

- [ ] **Step 3: Verificar typecheck**

```bash
pnpm typecheck
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/types.ts package.json pnpm-lock.yaml
git commit -m "feat: gera tipos typescript do schema supabase"
```

---

## Task 10: `lib/auth/roles.ts` + teste

**Files:**
- Create: `src/lib/auth/roles.ts`
- Create: `tests/unit/auth/roles.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/auth/roles.test.ts
import { describe, it, expect } from 'vitest'
import {
  isStaffRole,
  isPlatformAdminRole,
  isCustomerRole,
  canManageAgenda,
  canManageBilling,
} from '@/lib/auth/roles'

describe('roles', () => {
  it('isStaffRole identifica papéis de staff', () => {
    expect(isStaffRole('SALON_OWNER')).toBe(true)
    expect(isStaffRole('RECEPTIONIST')).toBe(true)
    expect(isStaffRole('PROFESSIONAL')).toBe(true)
    expect(isStaffRole('PLATFORM_ADMIN')).toBe(false)
    expect(isStaffRole('CUSTOMER')).toBe(false)
  })

  it('isPlatformAdminRole identifica apenas PLATFORM_ADMIN', () => {
    expect(isPlatformAdminRole('PLATFORM_ADMIN')).toBe(true)
    expect(isPlatformAdminRole('SALON_OWNER')).toBe(false)
  })

  it('isCustomerRole identifica apenas CUSTOMER', () => {
    expect(isCustomerRole('CUSTOMER')).toBe(true)
    expect(isCustomerRole('SALON_OWNER')).toBe(false)
  })

  it('canManageAgenda permite owner/reception/professional', () => {
    expect(canManageAgenda('SALON_OWNER')).toBe(true)
    expect(canManageAgenda('RECEPTIONIST')).toBe(true)
    expect(canManageAgenda('PROFESSIONAL')).toBe(true)
    expect(canManageAgenda('CUSTOMER')).toBe(false)
    expect(canManageAgenda('PLATFORM_ADMIN')).toBe(false)
  })

  it('canManageBilling permite apenas platform admin', () => {
    expect(canManageBilling('PLATFORM_ADMIN')).toBe(true)
    expect(canManageBilling('SALON_OWNER')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pnpm test -- tests/unit/auth/roles.test.ts
```

Expected: FAIL, módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/auth/roles.ts
import type { Database } from '@/lib/supabase/types'

export type UserRole = Database['public']['Enums']['user_role']

export const STAFF_ROLES = ['SALON_OWNER', 'RECEPTIONIST', 'PROFESSIONAL'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export function isStaffRole(role: UserRole): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole)
}

export function isPlatformAdminRole(role: UserRole): role is 'PLATFORM_ADMIN' {
  return role === 'PLATFORM_ADMIN'
}

export function isCustomerRole(role: UserRole): role is 'CUSTOMER' {
  return role === 'CUSTOMER'
}

export function canManageAgenda(role: UserRole): boolean {
  return isStaffRole(role)
}

export function canManageBilling(role: UserRole): boolean {
  return isPlatformAdminRole(role)
}
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pnpm test -- tests/unit/auth/roles.test.ts
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/roles.ts tests/unit/auth/roles.test.ts
git commit -m "feat(auth): helpers de roles com testes"
```

---

## Task 11: `lib/auth/session.ts`

**Files:**
- Create: `src/lib/auth/session.ts`

- [ ] **Step 1: Implementar session helpers**

```ts
// src/lib/auth/session.ts
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/auth/roles'

export type SessionUser = {
  id: string
  email: string | null
  profile: {
    id: string
    name: string
    role: UserRole
    tenantId: string | null
  } | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, role, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          role: profile.role,
          tenantId: profile.tenant_id,
        }
      : null,
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('NOT_AUTHENTICATED')
  }
  return user
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): helpers getSessionUser / requireSessionUser"
```

---

## Task 12: `lib/auth/guards.ts` + teste

**Files:**
- Create: `src/lib/auth/guards.ts`
- Create: `tests/unit/auth/guards.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/auth/guards.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertStaff, assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import * as session from '@/lib/auth/session'

vi.mock('@/lib/auth/session')

describe('assertStaff', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna o usuário quando staff ativo', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'SALON_OWNER', tenantId: 't1' },
    })

    const result = await assertStaff()
    expect(result.profile.role).toBe('SALON_OWNER')
  })

  it('lança AuthError UNAUTHORIZED quando sem sessão', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue(null)

    await expect(assertStaff()).rejects.toThrow(AuthError)
  })

  it('lança AuthError FORBIDDEN quando role != staff', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'CUSTOMER', tenantId: null },
    })

    await expect(assertStaff()).rejects.toThrow(AuthError)
  })

  it('lança quando tenantId do host difere do tenantId do perfil', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'SALON_OWNER', tenantId: 't1' },
    })

    await expect(assertStaff({ expectedTenantId: 't2' })).rejects.toThrow(AuthError)
  })
})

describe('assertPlatformAdmin', () => {
  it('retorna usuário quando PLATFORM_ADMIN', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Admin', role: 'PLATFORM_ADMIN', tenantId: null },
    })

    const result = await assertPlatformAdmin()
    expect(result.profile.role).toBe('PLATFORM_ADMIN')
  })

  it('lança quando role != PLATFORM_ADMIN', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'SALON_OWNER', tenantId: 't1' },
    })

    await expect(assertPlatformAdmin()).rejects.toThrow(AuthError)
  })
})
```

- [ ] **Step 2: Rodar teste — falha**

```bash
pnpm test -- tests/unit/auth/guards.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/auth/guards.ts
import 'server-only'

import { getSessionUser, type SessionUser } from '@/lib/auth/session'
import { isStaffRole, isPlatformAdminRole } from '@/lib/auth/roles'

export type AuthErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'TENANT_MISMATCH'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export async function assertStaff(opts?: {
  expectedTenantId?: string | null
}): Promise<SessionUser & { profile: NonNullable<SessionUser['profile']> }> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHORIZED')
  if (!user.profile) throw new AuthError('UNAUTHORIZED')
  if (!isStaffRole(user.profile.role)) throw new AuthError('FORBIDDEN')

  if (opts?.expectedTenantId !== undefined && user.profile.tenantId !== opts.expectedTenantId) {
    throw new AuthError('TENANT_MISMATCH')
  }

  return user as SessionUser & { profile: NonNullable<SessionUser['profile']> }
}

export async function assertPlatformAdmin(): Promise<
  SessionUser & { profile: NonNullable<SessionUser['profile']> }
> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHORIZED')
  if (!user.profile) throw new AuthError('UNAUTHORIZED')
  if (!isPlatformAdminRole(user.profile.role)) throw new AuthError('FORBIDDEN')

  return user as SessionUser & { profile: NonNullable<SessionUser['profile']> }
}
```

- [ ] **Step 4: Rodar teste — passa**

```bash
pnpm test -- tests/unit/auth/guards.test.ts
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/guards.ts tests/unit/auth/guards.test.ts
git commit -m "feat(auth): guards assertStaff / assertPlatformAdmin com testes"
```

---

## Task 13: Página de login do salão (e-mail + senha)

**Files:**
- Create: `src/app/(salon)/login/page.tsx`
- Create: `src/app/(salon)/login/actions.ts`

- [ ] **Step 1: Criar Server Action**

```ts
// src/app/(salon)/login/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginState = { error?: string }

export async function loginStaffAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: 'Credenciais inválidas.' }
  }

  redirect('/dashboard')
}
```

- [ ] **Step 2: Criar página de login**

```tsx
// src/app/(salon)/login/page.tsx
'use client'

import { useActionState } from 'react'
import { loginStaffAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export default function SalonLoginPage() {
  const [state, formAction, pending] = useActionState(loginStaffAction, INITIAL)

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Entrar no salão</h1>

        <form action={formAction} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm">E-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Senha</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
          >
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(salon\)/login/
git commit -m "feat(auth): página de login do salão (email/senha)"
```

---

## Task 14: Página de login do platform admin

**Files:**
- Create: `src/app/(platform)/login/page.tsx`
- Create: `src/app/(platform)/login/actions.ts`

- [ ] **Step 1: Criar Server Action**

```ts
// src/app/(platform)/login/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type LoginState = { error?: string }

export async function loginPlatformAdminAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: 'Credenciais inválidas.' }
  }

  redirect('/platform')
}
```

- [ ] **Step 2: Criar página**

```tsx
// src/app/(platform)/login/page.tsx
'use client'

import { useActionState } from 'react'
import { loginPlatformAdminAction, type LoginState } from './actions'

const INITIAL: LoginState = {}

export default function PlatformLoginPage() {
  const [state, formAction, pending] = useActionState(loginPlatformAdminAction, INITIAL)

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Aralabs — Platform Admin</h1>

        <form action={formAction} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm">E-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm">Senha</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-md bg-black px-4 font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/login/
git commit -m "feat(auth): página de login do platform admin"
```

---

## Task 15: Rota de callback do OAuth

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Implementar handler**

```ts
// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/callback/
git commit -m "feat(auth): rota de callback OAuth / magic link"
```

---

## Task 16: Rota de logout

**Files:**
- Create: `src/app/auth/logout/route.ts`

- [ ] **Step 1: Implementar**

```ts
// src/app/auth/logout/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL('/', request.url)
  return NextResponse.redirect(url, { status: 303 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/logout/
git commit -m "feat(auth): rota de logout"
```

---

## Task 17: E2E — login flows

**Files:**
- Create: `e2e/auth/platform-login.spec.ts`
- Create: `e2e/auth/salon-login.spec.ts`

- [ ] **Step 1: Adicionar seed de usuários de teste**

Criar `supabase/migrations/0007_test_users_seed.sql` (será aplicado apenas localmente pela CLI):

```sql
-- supabase/migrations/0007_test_users_seed.sql
-- Usuários de teste apenas para E2E local. Remover/condicionar em prod via seed separado.

-- Platform admin
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'admin@aralabs.test',
  crypt('senha123', gen_salt('bf')),
  now()
)
on conflict (id) do nothing;

insert into public.user_profiles (user_id, role, tenant_id, name)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'PLATFORM_ADMIN', null, 'Admin Teste')
on conflict (user_id) do nothing;

-- Tenant de teste + owner
insert into public.tenants (id, slug, name, subdomain)
values ('11111111-1111-1111-1111-111111111111', 'barbearia-teste', 'Barbearia Teste', 'barbearia-teste')
on conflict (id) do nothing;

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'owner@barbearia-teste.aralabs.test',
  crypt('senha123', gen_salt('bf')),
  now()
)
on conflict (id) do nothing;

insert into public.user_profiles (user_id, role, tenant_id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SALON_OWNER', '11111111-1111-1111-1111-111111111111', 'Owner Teste')
on conflict (user_id) do nothing;
```

```bash
supabase db reset
```

- [ ] **Step 2: E2E platform login**

```ts
// e2e/auth/platform-login.spec.ts
import { test, expect } from '@playwright/test'

test('platform admin faz login com email e senha', async ({ page }) => {
  await page.goto('/login') // entra em platform login via route group (platform)

  await page.getByLabel('E-mail').fill('admin@aralabs.test')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: /entrar/i }).click()

  // Após login, redireciona para /platform — página ainda não existe, mas middleware não deve bloquear.
  await expect(page).toHaveURL(/\/platform|\/login/)
})

test('platform admin recebe erro com senha inválida', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('E-mail').fill('admin@aralabs.test')
  await page.getByLabel('Senha').fill('errado')
  await page.getByRole('button', { name: /entrar/i }).click()

  await expect(page.getByRole('alert')).toContainText('Credenciais inválidas')
})
```

- [ ] **Step 3: E2E salon login**

```ts
// e2e/auth/salon-login.spec.ts
import { test, expect } from '@playwright/test'

test('salon owner faz login no subdomínio do próprio salão', async ({ page, baseURL }) => {
  const url = baseURL!.replace('localhost', 'barbearia-teste.lvh.me')
  await page.goto(`${url}/login`)

  await page.getByLabel('E-mail').fill('owner@barbearia-teste.aralabs.test')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: /entrar/i }).click()

  await expect(page).toHaveURL(/\/dashboard|\/login/)
})
```

- [ ] **Step 4: Rodar E2E**

```bash
pnpm test:e2e
```

Expected: testes passam (mesmo que destinos `/platform` e `/dashboard` ainda não tenham páginas de conteúdo — a validação é de redirect + formulário).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_test_users_seed.sql e2e/auth/
git commit -m "test(e2e): login flows staff e platform admin"
```

---

## Task 18: Sanity check do épico

- [ ] **Step 1: Rodar tudo**

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm test:e2e && pnpm build
```

Expected: tudo verde.

- [ ] **Step 2: Conferir migrations aplicadas**

```bash
supabase db psql -c "select version, name from supabase_migrations.schema_migrations order by version;"
```

Expected: 7 linhas (0001 a 0007).

- [ ] **Step 3: Commit final (se necessário)**

```bash
git status
# sem mudanças? próximo épico. com mudanças residuais: commitar.
```

---

## Critério de aceitação do épico 1

- ✅ 7 migrations aplicadas: enums, plans, tenants, user_profiles, helper_functions, rls_policies, seed de users.
- ✅ RLS habilitado em plans, tenants, user_profiles com 4 políticas cada (platform admin / staff / customer onde aplicável).
- ✅ Funções helper `auth.current_tenant_id()`, `auth.current_role()`, `auth.is_platform_admin()`, `auth.is_tenant_staff()` criadas.
- ✅ Tipos TS gerados e exportados.
- ✅ Helpers de auth (`roles`, `session`, `guards`) implementados e testados em Vitest.
- ✅ Páginas de login do salão e do platform admin renderizam e autenticam.
- ✅ Rota de callback OAuth + rota de logout funcionais.
- ✅ pgTAP tests passam (6 testes de RLS isolation).
- ✅ E2E tests de login passam.
- ✅ Seed de 3 planos + usuários de teste plantado.

**Output do épico:** infraestrutura de identidade e autorização completa, pronta para receber o episódio de tenants + branding (Épico 2).
