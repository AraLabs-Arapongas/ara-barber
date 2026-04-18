# Épico 7 — Platform Admin + Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o painel administrativo da Aralabs em `admin.aralabs.com.br/platform/*` — CRUD de tenants (com convite de owner), CRUD de plans, ações de billing (estender trial, customizar trial, ativar assinatura, suspender, reativar, cancelar), tabela `billing_events` com trigger automático e jobs `pg_cron` de transição automática de estados.

**Architecture:** `billing_events` criada via migration + trigger que captura mudanças nos campos de billing de `tenants` (JSONB before/after). Jobs `pg_cron` diários às 03:00 UTC fazem transições TRIALING→PAST_DUE e PAST_DUE→SUSPENDED. Server actions no `(platform)/platform/*` para todas as ações administrativas, protegidas por `assertPlatformAdmin()`. UIs com listas filtradas por `billingStatus` e página de billing detalhado por tenant.

**Tech Stack:** pg_cron, Postgres triggers, Next.js 16 Server Actions, Zod.

**Referência:** Spec — Seções 8 (Billing/Trials/Planos), 10.1 (onboarding), 10.11–10.13 (fluxos billing), 16.3 (relatórios).

**Dependências:** Épicos 0–6.

---

## File Structure

```
ara-barber/
├── supabase/
│   └── migrations/
│       ├── 0018_billing_events.sql             # Task 1
│       ├── 0019_billing_triggers.sql           # Task 2
│       └── 0020_pg_cron_billing.sql            # Task 3
├── src/
│   ├── lib/
│   │   └── billing/
│   │       ├── trial.ts                        # Task 4
│   │       └── status.ts                       # Task 4
│   └── app/
│       └── (platform)/
│           └── platform/
│               ├── page.tsx                    # Task 5 — dashboard
│               ├── tenants/
│               │   ├── page.tsx                # Task 6 — lista
│               │   ├── new/
│               │   │   ├── page.tsx            # Task 7 — criar tenant
│               │   │   └── actions.ts
│               │   └── [id]/
│               │       ├── page.tsx            # Task 8 — detalhe
│               │       └── billing/
│               │           ├── page.tsx        # Task 9
│               │           └── actions.ts      # Task 9 — ações billing
│               └── plans/
│                   ├── page.tsx                # Task 10
│                   └── actions.ts
└── tests/
    └── unit/
        └── billing/
            ├── trial.test.ts
            └── status.test.ts
```

---

## Task 1: Migration — `billing_events`

**Files:**
- Create: `supabase/migrations/0018_billing_events.sql`

- [ ] **Step 1: Criar**

```bash
supabase migration new billing_events
```

```sql
-- supabase/migrations/0018_billing_events.sql

create type public.billing_event_type as enum (
  'TRIAL_STARTED',
  'TRIAL_EXTENDED',
  'TRIAL_CUSTOMIZED',
  'TRIAL_EXPIRED',
  'PLAN_CHANGED',
  'PRICING_OVERRIDDEN',
  'BILLING_ACTIVATED',
  'GRACE_PERIOD_ENDED',
  'SUSPENDED',
  'REACTIVATED',
  'CANCELED'
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  event_type public.billing_event_type not null,
  from_state_json jsonb,
  to_state_json jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index billing_events_tenant_idx on public.billing_events (tenant_id, created_at desc);
create index billing_events_type_idx on public.billing_events (event_type);

alter table public.billing_events enable row level security;

create policy "billing_events_platform_admin_read" on public.billing_events
  for select using (auth.is_platform_admin());

create policy "billing_events_platform_admin_write" on public.billing_events
  for all using (auth.is_platform_admin()) with check (auth.is_platform_admin());
```

- [ ] **Step 2: Aplicar e regen types**

```bash
supabase db reset
pnpm db:types
git add supabase/migrations/0018_billing_events.sql src/lib/supabase/types.ts
git commit -m "feat(db): billing_events + enum"
```

---

## Task 2: Migration — triggers que preenchem `billing_events` automaticamente

**Files:**
- Create: `supabase/migrations/0019_billing_triggers.sql`

- [ ] **Step 1: Criar**

```bash
supabase migration new billing_triggers
```

```sql
-- supabase/migrations/0019_billing_triggers.sql

-- Função que detecta mudanças nos campos de billing e registra billing_events.
create or replace function public.log_billing_changes()
returns trigger
language plpgsql
as $$
declare
  v_event_type public.billing_event_type;
  v_from jsonb;
  v_to jsonb;
begin
  v_from := jsonb_build_object(
    'billing_status', old.billing_status,
    'billing_model', old.billing_model,
    'current_plan_id', old.current_plan_id,
    'trial_ends_at', old.trial_ends_at,
    'monthly_price_cents', old.monthly_price_cents,
    'transaction_fee_type', old.transaction_fee_type,
    'transaction_fee_value', old.transaction_fee_value,
    'is_custom_trial', old.is_custom_trial
  );
  v_to := jsonb_build_object(
    'billing_status', new.billing_status,
    'billing_model', new.billing_model,
    'current_plan_id', new.current_plan_id,
    'trial_ends_at', new.trial_ends_at,
    'monthly_price_cents', new.monthly_price_cents,
    'transaction_fee_type', new.transaction_fee_type,
    'transaction_fee_value', new.transaction_fee_value,
    'is_custom_trial', new.is_custom_trial
  );

  -- Transições de status têm prioridade em mapear eventos específicos
  if old.billing_status is distinct from new.billing_status then
    v_event_type := case new.billing_status
      when 'PAST_DUE' then
        case when old.billing_status = 'TRIALING' then 'TRIAL_EXPIRED'::public.billing_event_type
             else 'SUSPENDED'::public.billing_event_type end
      when 'SUSPENDED' then 'GRACE_PERIOD_ENDED'
      when 'ACTIVE' then 'BILLING_ACTIVATED'
      when 'CANCELED' then 'CANCELED'
      when 'TRIALING' then 'REACTIVATED'
      else null
    end;
  elsif old.trial_ends_at is distinct from new.trial_ends_at then
    v_event_type := case when new.is_custom_trial then 'TRIAL_CUSTOMIZED' else 'TRIAL_EXTENDED' end;
  elsif old.current_plan_id is distinct from new.current_plan_id then
    v_event_type := 'PLAN_CHANGED';
  elsif
    old.monthly_price_cents is distinct from new.monthly_price_cents
    or old.transaction_fee_type is distinct from new.transaction_fee_type
    or old.transaction_fee_value is distinct from new.transaction_fee_value
  then
    v_event_type := 'PRICING_OVERRIDDEN';
  else
    return new;
  end if;

  if v_event_type is null then
    return new;
  end if;

  insert into public.billing_events (tenant_id, event_type, from_state_json, to_state_json, actor_user_id, reason)
  values (
    new.id,
    v_event_type,
    v_from,
    v_to,
    auth.uid(),
    null
  );

  return new;
end $$;

create trigger tenants_log_billing_changes
  after update on public.tenants
  for each row execute function public.log_billing_changes();

-- Evento TRIAL_STARTED na criação do tenant
create or replace function public.log_trial_started()
returns trigger
language plpgsql
as $$
begin
  insert into public.billing_events (tenant_id, event_type, from_state_json, to_state_json, actor_user_id, reason)
  values (
    new.id,
    'TRIAL_STARTED',
    null,
    jsonb_build_object('trial_ends_at', new.trial_ends_at, 'billing_status', new.billing_status),
    auth.uid(),
    null
  );
  return new;
end $$;

create trigger tenants_log_trial_started
  after insert on public.tenants
  for each row execute function public.log_trial_started();
```

- [ ] **Step 2: Aplicar e commitar**

```bash
supabase db reset
git add supabase/migrations/0019_billing_triggers.sql
git commit -m "feat(db): triggers automáticos para billing_events"
```

---

## Task 3: Migration — jobs `pg_cron`

**Files:**
- Create: `supabase/migrations/0020_pg_cron_billing.sql`

- [ ] **Step 1: Criar**

```bash
supabase migration new pg_cron_billing
```

```sql
-- supabase/migrations/0020_pg_cron_billing.sql

create extension if not exists pg_cron with schema extensions;

-- Função que transiciona trials expirados
create or replace function public.expire_trials()
returns void
language sql
as $$
  update public.tenants
  set billing_status = 'PAST_DUE',
      grace_period_ends_at = trial_ends_at + interval '7 days'
  where billing_status = 'TRIALING'
    and trial_ends_at < now();
$$;

-- Função que suspende tenants após grace period
create or replace function public.suspend_past_due_tenants()
returns void
language sql
as $$
  update public.tenants
  set billing_status = 'SUSPENDED'
  where billing_status = 'PAST_DUE'
    and grace_period_ends_at is not null
    and grace_period_ends_at < now();
$$;

-- Agenda os jobs (às 03:00 UTC todo dia)
select cron.schedule(
  'expire_trials_daily',
  '0 3 * * *',
  $$ select public.expire_trials(); $$
);

select cron.schedule(
  'suspend_past_due_daily',
  '5 3 * * *',
  $$ select public.suspend_past_due_tenants(); $$
);
```

- [ ] **Step 2: Aplicar**

```bash
supabase db reset
```

**Nota:** `pg_cron` requer que a extensão esteja habilitada no projeto. No Supabase Cloud (produção), ativar em Dashboard → Database → Extensions.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0020_pg_cron_billing.sql
git commit -m "feat(db): pg_cron jobs para expirar trials e suspender past_due"
```

---

## Task 4: `lib/billing/trial.ts` e `lib/billing/status.ts` + testes

**Files:**
- Create: `src/lib/billing/trial.ts`
- Create: `src/lib/billing/status.ts`
- Create: `tests/unit/billing/trial.test.ts`
- Create: `tests/unit/billing/status.test.ts`

- [ ] **Step 1: Teste de `trial.ts`**

```ts
// tests/unit/billing/trial.test.ts
import { describe, it, expect } from 'vitest'
import { computeTrialEnd, computeGracePeriodEnd, isTrialExpired } from '@/lib/billing/trial'

describe('computeTrialEnd', () => {
  it('soma os dias ao startsAt', () => {
    const end = computeTrialEnd(new Date('2026-04-18T00:00:00Z'), 30)
    expect(end.toISOString()).toBe('2026-05-18T00:00:00.000Z')
  })
})

describe('computeGracePeriodEnd', () => {
  it('soma 7 dias ao trialEndsAt', () => {
    const end = computeGracePeriodEnd(new Date('2026-04-18T00:00:00Z'))
    expect(end.toISOString()).toBe('2026-04-25T00:00:00.000Z')
  })
})

describe('isTrialExpired', () => {
  it('true quando trialEndsAt < now', () => {
    expect(isTrialExpired(new Date('2020-01-01'), new Date('2026-04-18'))).toBe(true)
  })
  it('false quando trialEndsAt > now', () => {
    expect(isTrialExpired(new Date('2030-01-01'), new Date('2026-04-18'))).toBe(false)
  })
})
```

- [ ] **Step 2: Implementar `trial.ts`**

```ts
// src/lib/billing/trial.ts
export function computeTrialEnd(startsAt: Date, days: number): Date {
  const out = new Date(startsAt)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

export function computeGracePeriodEnd(trialEndsAt: Date): Date {
  const out = new Date(trialEndsAt)
  out.setUTCDate(out.getUTCDate() + 7)
  return out
}

export function isTrialExpired(trialEndsAt: Date, now: Date = new Date()): boolean {
  return trialEndsAt.getTime() < now.getTime()
}
```

- [ ] **Step 3: Teste e implementação de `status.ts`**

```ts
// tests/unit/billing/status.test.ts
import { describe, it, expect } from 'vitest'
import { canReactivateFrom, canCancelFrom } from '@/lib/billing/status'

describe('canReactivateFrom', () => {
  it('aceita SUSPENDED e PAST_DUE', () => {
    expect(canReactivateFrom('SUSPENDED')).toBe(true)
    expect(canReactivateFrom('PAST_DUE')).toBe(true)
  })
  it('rejeita TRIALING, ACTIVE, CANCELED', () => {
    expect(canReactivateFrom('TRIALING')).toBe(false)
    expect(canReactivateFrom('ACTIVE')).toBe(false)
    expect(canReactivateFrom('CANCELED')).toBe(false)
  })
})

describe('canCancelFrom', () => {
  it('aceita qualquer estado != CANCELED', () => {
    expect(canCancelFrom('TRIALING')).toBe(true)
    expect(canCancelFrom('ACTIVE')).toBe(true)
    expect(canCancelFrom('PAST_DUE')).toBe(true)
    expect(canCancelFrom('SUSPENDED')).toBe(true)
    expect(canCancelFrom('CANCELED')).toBe(false)
  })
})
```

```ts
// src/lib/billing/status.ts
import type { Database } from '@/lib/supabase/types'

export type BillingStatus = Database['public']['Enums']['billing_status']

export function canReactivateFrom(status: BillingStatus): boolean {
  return status === 'SUSPENDED' || status === 'PAST_DUE'
}

export function canCancelFrom(status: BillingStatus): boolean {
  return status !== 'CANCELED'
}
```

- [ ] **Step 4: Rodar testes**

```bash
pnpm test -- tests/unit/billing/
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/ tests/unit/billing/
git commit -m "feat(billing): helpers trial + status com testes"
```

---

## Task 5: Dashboard da plataforma (`/platform`)

**Files:**
- Modify: `src/app/(platform)/platform/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(platform)/platform/page.tsx
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service-role'
import { assertPlatformAdmin } from '@/lib/auth/guards'

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function PlatformDashboard() {
  await assertPlatformAdmin()
  const supabase = createServiceClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug, billing_status, monthly_price_cents, trial_ends_at')

  const counts = { TRIALING: 0, ACTIVE: 0, PAST_DUE: 0, SUSPENDED: 0, CANCELED: 0 }
  let mrr = 0
  const expiringSoon: Array<{ id: string; name: string; trial_ends_at: string | null }> = []
  const now = new Date()
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  for (const t of tenants ?? []) {
    counts[t.billing_status] = (counts[t.billing_status] ?? 0) + 1
    if (t.billing_status === 'ACTIVE') mrr += t.monthly_price_cents ?? 0
    if (
      t.billing_status === 'TRIALING' &&
      t.trial_ends_at &&
      new Date(t.trial_ends_at) < in7d
    ) {
      expiringSoon.push({ id: t.id, name: t.name, trial_ends_at: t.trial_ends_at })
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Aralabs Platform</h1>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(counts).map(([status, n]) => (
          <div key={status} className="rounded-lg border p-4">
            <p className="text-xs uppercase opacity-60">{status}</p>
            <p className="text-2xl font-bold">{n}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-sm font-medium opacity-70">MRR projetado (ACTIVE)</h2>
        <p className="text-3xl font-bold">{brl(mrr)}</p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">Trials expirando (próximos 7 dias)</h2>
        {expiringSoon.length === 0 ? (
          <p className="text-sm opacity-70">Nenhum.</p>
        ) : (
          <ul className="space-y-2">
            {expiringSoon.map((t) => (
              <li key={t.id} className="rounded-md border p-3 text-sm">
                <Link href={`/platform/tenants/${t.id}/billing`} className="font-medium underline">
                  {t.name}
                </Link>{' '}
                — expira em{' '}
                {new Date(t.trial_ends_at!).toLocaleDateString('pt-BR')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 flex gap-3">
        <Link href="/platform/tenants" className="rounded-md border px-4 py-2 text-sm">
          Ver todos os tenants
        </Link>
        <Link href="/platform/plans" className="rounded-md border px-4 py-2 text-sm">
          Gerenciar planos
        </Link>
        <Link
          href="/platform/tenants/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          + Novo tenant
        </Link>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(platform\)/platform/page.tsx
git commit -m "feat(platform): dashboard com contagens, MRR projetado e trials expirando"
```

---

## Task 6: Lista de tenants

**Files:**
- Create: `src/app/(platform)/platform/tenants/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(platform)/platform/tenants/page.tsx
import Link from 'next/link'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'

const STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'] as const

export default async function PlatformTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await assertPlatformAdmin()
  const { status } = await searchParams
  const supabase = createServiceClient()

  let q = supabase
    .from('tenants')
    .select('id, name, slug, billing_status, trial_ends_at, current_plan_id')
    .order('name')
  if (status && (STATUSES as readonly string[]).includes(status)) {
    q = q.eq('billing_status', status)
  }
  const { data: tenants } = await q

  return (
    <main className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Tenants</h1>
        <Link
          href="/platform/tenants/new"
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          + Novo
        </Link>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href="/platform/tenants"
          className={`rounded-full border px-3 py-1 ${!status ? 'bg-black text-white' : ''}`}
        >
          Todos
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/platform/tenants?status=${s}`}
            className={`rounded-full border px-3 py-1 ${status === s ? 'bg-black text-white' : ''}`}
          >
            {s}
          </Link>
        ))}
      </nav>

      <ul className="space-y-2">
        {(tenants ?? []).map((t) => (
          <li key={t.id}>
            <Link
              href={`/platform/tenants/${t.id}`}
              className="block rounded-lg border p-3 active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs opacity-70">
                    {t.slug} · {t.billing_status}
                  </p>
                </div>
                {t.billing_status === 'TRIALING' && t.trial_ends_at ? (
                  <span className="text-xs opacity-60">
                    até {new Date(t.trial_ends_at).toLocaleDateString('pt-BR')}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/page.tsx
git commit -m "feat(platform): lista de tenants com filtro por status"
```

---

## Task 7: Criar novo tenant (convite de owner)

**Files:**
- Create: `src/app/(platform)/platform/tenants/new/page.tsx`
- Create: `src/app/(platform)/platform/tenants/new/actions.ts`

- [ ] **Step 1: Server action**

```ts
// src/app/(platform)/platform/tenants/new/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'
import { computeTrialEnd } from '@/lib/billing/trial'

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/, 'Slug inválido (letras minúsculas, números e hífen)'),
  ownerEmail: z.string().email(),
  ownerName: z.string().trim().min(2).max(100),
  planId: z.string().uuid(),
  trialDays: z.number().int().min(0).max(365),
})

export type NewTenantState = { error?: string; tenantId?: string }

export async function createTenantAction(
  _prev: NewTenantState,
  formData: FormData,
): Promise<NewTenantState> {
  await assertPlatformAdmin()

  const parsed = schema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    ownerEmail: formData.get('ownerEmail'),
    ownerName: formData.get('ownerName'),
    planId: formData.get('planId'),
    trialDays: Number(formData.get('trialDays') ?? 30),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = createServiceClient()

  // Busca plano
  const { data: plan } = await supabase
    .from('plans')
    .select('id, monthly_price_cents, transaction_fee_type, transaction_fee_value, transaction_fee_fixed_cents, trial_days_default')
    .eq('id', parsed.data.planId)
    .maybeSingle()
  if (!plan) return { error: 'Plano não encontrado' }

  const now = new Date()
  const trialEnds = computeTrialEnd(now, parsed.data.trialDays)
  const isCustom = parsed.data.trialDays !== plan.trial_days_default

  const { data: tenant, error: insertErr } = await supabase
    .from('tenants')
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      subdomain: parsed.data.slug,
      status: 'ACTIVE',
      timezone: 'America/Sao_Paulo',
      current_plan_id: plan.id,
      billing_status: 'TRIALING',
      billing_model: 'TRIAL',
      monthly_price_cents: plan.monthly_price_cents,
      transaction_fee_type: plan.transaction_fee_type,
      transaction_fee_value: plan.transaction_fee_value,
      transaction_fee_fixed_cents: plan.transaction_fee_fixed_cents,
      trial_starts_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      trial_days_granted: parsed.data.trialDays,
      is_custom_trial: isCustom,
    })
    .select('id')
    .single()

  if (insertErr) return { error: insertErr.message }

  // Convida owner via Admin API
  const { data: invited, error: inviteErr } =
    await supabase.auth.admin.inviteUserByEmail(parsed.data.ownerEmail, {
      data: { intended_role: 'SALON_OWNER', tenant_id: tenant.id },
    })
  if (inviteErr) return { error: `Tenant criado, mas falha no convite: ${inviteErr.message}` }

  await supabase.from('user_profiles').insert({
    user_id: invited.user.id,
    role: 'SALON_OWNER',
    tenant_id: tenant.id,
    name: parsed.data.ownerName,
  })

  redirect(`/platform/tenants/${tenant.id}`)
}
```

- [ ] **Step 2: Page + form**

```tsx
// src/app/(platform)/platform/tenants/new/page.tsx
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'
import { NewTenantForm } from './_form'

export default async function NewTenantPage() {
  await assertPlatformAdmin()
  const supabase = createServiceClient()
  const { data: plans } = await supabase.from('plans').select('id, code, name, trial_days_default, monthly_price_cents').eq('is_active', true)

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-bold">Novo tenant</h1>
      <NewTenantForm plans={plans ?? []} />
    </main>
  )
}
```

```tsx
// src/app/(platform)/platform/tenants/new/_form.tsx
'use client'

import { useActionState } from 'react'
import { createTenantAction, type NewTenantState } from './actions'

const INITIAL: NewTenantState = {}

type Plan = { id: string; code: string; name: string; trial_days_default: number; monthly_price_cents: number }

export function NewTenantForm({ plans }: { plans: Plan[] }) {
  const [state, action, pending] = useActionState(createTenantAction, INITIAL)
  const defaultPlan = plans[0]

  return (
    <form action={action} className="max-w-md space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm">Nome do salão</span>
        <input name="name" required className="h-11 w-full rounded-md border px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Slug (subdomínio)</span>
        <input
          name="slug"
          required
          pattern="^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$"
          className="h-11 w-full rounded-md border px-3"
        />
        <span className="mt-1 block text-xs opacity-60">
          Vai ser: <code>{'{slug}'}.aralabs.com.br</code>
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">E-mail do owner</span>
        <input name="ownerEmail" type="email" required className="h-11 w-full rounded-md border px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Nome do owner</span>
        <input name="ownerName" required className="h-11 w-full rounded-md border px-3" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Plano</span>
        <select name="planId" defaultValue={defaultPlan?.id} className="h-11 w-full rounded-md border px-3">
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code}) — {(p.monthly_price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Dias de trial</span>
        <input
          name="trialDays"
          type="number"
          min={0}
          max={365}
          defaultValue={defaultPlan?.trial_days_default ?? 30}
          className="h-11 w-full rounded-md border px-3"
        />
      </label>

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-black px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Criando...' : 'Criar tenant + convidar owner'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/new/
git commit -m "feat(platform): criação de tenant com convite de owner"
```

---

## Task 8: Detalhe de tenant

**Files:**
- Create: `src/app/(platform)/platform/tenants/[id]/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(platform)/platform/tenants/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await assertPlatformAdmin()
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: t }, { data: userProfiles }] = await Promise.all([
    supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('user_profiles')
      .select('id, role, name, is_active')
      .eq('tenant_id', id),
  ])

  if (!t) notFound()

  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">{t.name}</h1>
        <p className="text-sm opacity-70">
          {t.slug}.aralabs.com.br · {t.billing_status}
        </p>
      </header>

      <div className="flex gap-2">
        <Link
          href={`/platform/tenants/${t.id}/billing`}
          className="rounded-md border px-3 py-2 text-sm"
        >
          Billing
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">Equipe</h2>
        <ul className="space-y-1 text-sm">
          {(userProfiles ?? []).map((p) => (
            <li key={p.id}>
              {p.name} <span className="opacity-60">({p.role})</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/\[id\]/page.tsx
git commit -m "feat(platform): página de detalhe do tenant"
```

---

## Task 9: Billing detalhado + ações

**Files:**
- Create: `src/app/(platform)/platform/tenants/[id]/billing/page.tsx`
- Create: `src/app/(platform)/platform/tenants/[id]/billing/actions.ts`
- Create: `src/app/(platform)/platform/tenants/[id]/billing/_actions-panel.tsx`

- [ ] **Step 1: Server actions (5 ações)**

```ts
// src/app/(platform)/platform/tenants/[id]/billing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'
import { canReactivateFrom, canCancelFrom } from '@/lib/billing/status'

export type BillingActionState = { error?: string; success?: boolean }

const extendSchema = z.object({
  id: z.string().uuid(),
  days: z.number().int().min(1).max(365),
  reason: z.string().trim().max(500).nullish(),
})

export async function extendTrialAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await assertPlatformAdmin()
  const parsed = extendSchema.safeParse({
    id: formData.get('id'),
    days: Number(formData.get('days') ?? 0),
    reason: formData.get('reason') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('trial_ends_at, billing_status')
    .eq('id', parsed.data.id)
    .maybeSingle()
  if (!tenant) return { error: 'Tenant não encontrado' }

  const baseDate = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : new Date()
  const newEnd = new Date(baseDate.getTime() + parsed.data.days * 24 * 60 * 60 * 1000)

  const patch: Record<string, unknown> = {
    trial_ends_at: newEnd.toISOString(),
    is_custom_trial: true,
  }
  // Se estava PAST_DUE, volta para TRIALING
  if (tenant.billing_status === 'PAST_DUE') {
    patch.billing_status = 'TRIALING'
    patch.grace_period_ends_at = null
  }

  const { error } = await supabase.from('tenants').update(patch).eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidatePath(`/platform/tenants/${parsed.data.id}/billing`)
  return { success: true }
}

const activateSchema = z.object({ id: z.string().uuid() })

export async function activateSubscriptionAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await assertPlatformAdmin()
  const parsed = activateSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: 'ID inválido' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tenants')
    .update({
      billing_status: 'ACTIVE',
      billing_model: 'SUBSCRIPTION_WITH_TRANSACTION_FEE',
      subscription_starts_at: new Date().toISOString(),
      grace_period_ends_at: null,
    })
    .eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidatePath(`/platform/tenants/${parsed.data.id}/billing`)
  return { success: true }
}

const suspendSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(2).max(500),
})

export async function suspendTenantAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await assertPlatformAdmin()
  const parsed = suspendSchema.safeParse({
    id: formData.get('id'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { error: 'Motivo obrigatório' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tenants')
    .update({ billing_status: 'SUSPENDED', notes_internal: parsed.data.reason })
    .eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidatePath(`/platform/tenants/${parsed.data.id}/billing`)
  return { success: true }
}

const reactivateSchema = z.object({
  id: z.string().uuid(),
  targetStatus: z.enum(['TRIALING', 'ACTIVE']),
  trialDays: z.number().int().min(1).max(365).nullish(),
})

export async function reactivateTenantAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await assertPlatformAdmin()
  const parsed = reactivateSchema.safeParse({
    id: formData.get('id'),
    targetStatus: formData.get('targetStatus'),
    trialDays: formData.get('trialDays') ? Number(formData.get('trialDays')) : null,
  })
  if (!parsed.success) return { error: 'Dados inválidos' }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('billing_status')
    .eq('id', parsed.data.id)
    .maybeSingle()
  if (!tenant) return { error: 'Tenant não encontrado' }
  if (!canReactivateFrom(tenant.billing_status)) return { error: 'Status atual não permite reativação' }

  const now = new Date()
  const patch: Record<string, unknown> = {
    billing_status: parsed.data.targetStatus,
    grace_period_ends_at: null,
  }
  if (parsed.data.targetStatus === 'TRIALING') {
    const days = parsed.data.trialDays ?? 30
    const newEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    patch.trial_starts_at = now.toISOString()
    patch.trial_ends_at = newEnd.toISOString()
    patch.trial_days_granted = days
    patch.is_custom_trial = true
  } else {
    patch.subscription_starts_at = now.toISOString()
  }

  const { error } = await supabase.from('tenants').update(patch).eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidatePath(`/platform/tenants/${parsed.data.id}/billing`)
  return { success: true }
}

const cancelSchema = z.object({
  id: z.string().uuid(),
  confirmSlug: z.string(),
})

export async function cancelTenantAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await assertPlatformAdmin()
  const parsed = cancelSchema.safeParse({
    id: formData.get('id'),
    confirmSlug: formData.get('confirmSlug'),
  })
  if (!parsed.success) return { error: 'Dados inválidos' }

  const supabase = createServiceClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug, billing_status')
    .eq('id', parsed.data.id)
    .maybeSingle()
  if (!tenant) return { error: 'Tenant não encontrado' }
  if (tenant.slug !== parsed.data.confirmSlug) return { error: 'Slug de confirmação não confere' }
  if (!canCancelFrom(tenant.billing_status)) return { error: 'Tenant já está cancelado' }

  const { error } = await supabase
    .from('tenants')
    .update({ billing_status: 'CANCELED', status: 'ARCHIVED' })
    .eq('id', parsed.data.id)
  if (error) return { error: error.message }

  revalidatePath(`/platform/tenants/${parsed.data.id}/billing`)
  return { success: true }
}
```

- [ ] **Step 2: Page com histórico + ações**

```tsx
// src/app/(platform)/platform/tenants/[id]/billing/page.tsx
import { notFound } from 'next/navigation'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'
import { ActionsPanel } from './_actions-panel'

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function TenantBillingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await assertPlatformAdmin()
  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: t }, { data: events }] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('billing_events')
      .select('*')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!t) notFound()

  return (
    <main className="p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Billing — {t.name}</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs opacity-60">Status</p>
          <p className="text-lg font-medium">{t.billing_status}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs opacity-60">Mensalidade</p>
          <p className="text-lg font-medium">{brl(t.monthly_price_cents ?? 0)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs opacity-60">Taxa transacional</p>
          <p className="text-lg font-medium">
            {t.transaction_fee_type === 'PERCENTAGE'
              ? `${(t.transaction_fee_value / 100).toFixed(2)}%`
              : t.transaction_fee_type === 'FIXED'
                ? brl(t.transaction_fee_value)
                : 'Nenhuma'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs opacity-60">Trial</p>
          <p className="text-lg font-medium">
            {t.trial_ends_at
              ? `até ${new Date(t.trial_ends_at).toLocaleDateString('pt-BR')}`
              : '—'}
          </p>
        </div>
      </section>

      <ActionsPanel tenantId={t.id} tenantSlug={t.slug} status={t.billing_status} />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">Histórico</h2>
        <ul className="space-y-1 text-xs">
          {(events ?? []).map((e) => (
            <li key={e.id} className="rounded-md border p-2">
              <span className="font-medium">{e.event_type}</span>
              {' · '}
              <span className="opacity-70">
                {new Date(e.created_at).toLocaleString('pt-BR')}
              </span>
              {e.reason ? <p className="opacity-60">{e.reason}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Actions panel (client)**

```tsx
// src/app/(platform)/platform/tenants/[id]/billing/_actions-panel.tsx
'use client'

import { useActionState, useState } from 'react'
import {
  extendTrialAction,
  activateSubscriptionAction,
  suspendTenantAction,
  reactivateTenantAction,
  cancelTenantAction,
  type BillingActionState,
} from './actions'

const INITIAL: BillingActionState = {}

type Props = { tenantId: string; tenantSlug: string; status: string }

export function ActionsPanel({ tenantId, tenantSlug, status }: Props) {
  const [extState, extForm, extPending] = useActionState(extendTrialAction, INITIAL)
  const [actState, actForm, actPending] = useActionState(activateSubscriptionAction, INITIAL)
  const [susState, susForm, susPending] = useActionState(suspendTenantAction, INITIAL)
  const [reaState, reaForm, reaPending] = useActionState(reactivateTenantAction, INITIAL)
  const [canState, canForm, canPending] = useActionState(cancelTenantAction, INITIAL)
  const [showCancel, setShowCancel] = useState(false)

  return (
    <section className="mt-6 space-y-4 rounded-lg border p-4">
      <h2 className="font-medium">Ações</h2>

      <form action={extForm} className="grid grid-cols-[1fr_auto] gap-2 border-b pb-4">
        <input type="hidden" name="id" value={tenantId} />
        <input
          name="days"
          type="number"
          min={1}
          max={365}
          defaultValue={30}
          className="h-10 rounded-md border px-3 text-sm"
        />
        <button
          type="submit"
          disabled={extPending}
          className="h-10 rounded-md border px-3 text-sm font-medium"
        >
          Estender trial (dias)
        </button>
        {extState.error ? <p className="col-span-2 text-xs text-red-600">{extState.error}</p> : null}
      </form>

      {status === 'TRIALING' || status === 'PAST_DUE' ? (
        <form action={actForm}>
          <input type="hidden" name="id" value={tenantId} />
          <button
            type="submit"
            disabled={actPending}
            className="h-10 w-full rounded-md bg-green-600 px-3 text-sm font-medium text-white"
          >
            Ativar assinatura
          </button>
          {actState.error ? <p className="mt-1 text-xs text-red-600">{actState.error}</p> : null}
        </form>
      ) : null}

      {status !== 'SUSPENDED' && status !== 'CANCELED' ? (
        <form action={susForm} className="space-y-2 border-t pt-4">
          <input type="hidden" name="id" value={tenantId} />
          <label className="block">
            <span className="mb-1 block text-xs opacity-70">Motivo (obrigatório)</span>
            <input name="reason" required minLength={2} className="h-10 w-full rounded-md border px-3 text-sm" />
          </label>
          <button
            type="submit"
            disabled={susPending}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            Suspender
          </button>
          {susState.error ? <p className="text-xs text-red-600">{susState.error}</p> : null}
        </form>
      ) : null}

      {status === 'SUSPENDED' || status === 'PAST_DUE' ? (
        <form action={reaForm} className="space-y-2 border-t pt-4">
          <input type="hidden" name="id" value={tenantId} />
          <label className="block">
            <span className="mb-1 block text-xs opacity-70">Reativar como</span>
            <select name="targetStatus" className="h-10 w-full rounded-md border px-3 text-sm">
              <option value="TRIALING">Trial</option>
              <option value="ACTIVE">Ativo</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs opacity-70">Se trial, dias:</span>
            <input
              name="trialDays"
              type="number"
              min={1}
              max={365}
              defaultValue={30}
              className="h-10 w-full rounded-md border px-3 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={reaPending}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            Reativar
          </button>
          {reaState.error ? <p className="text-xs text-red-600">{reaState.error}</p> : null}
        </form>
      ) : null}

      {status !== 'CANCELED' ? (
        <div className="border-t pt-4">
          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="h-10 w-full rounded-md border border-red-300 px-3 text-sm text-red-700"
            >
              Cancelar tenant
            </button>
          ) : (
            <form action={canForm} className="space-y-2">
              <input type="hidden" name="id" value={tenantId} />
              <p className="text-xs">
                Digite o slug <code>{tenantSlug}</code> para confirmar:
              </p>
              <input name="confirmSlug" required className="h-10 w-full rounded-md border px-3 text-sm" />
              <button
                type="submit"
                disabled={canPending}
                className="h-10 w-full rounded-md bg-red-600 px-3 text-sm font-medium text-white"
              >
                Confirmar cancelamento
              </button>
              {canState.error ? <p className="text-xs text-red-600">{canState.error}</p> : null}
            </form>
          )}
        </div>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(platform\)/platform/tenants/\[id\]/billing/
git commit -m "feat(platform): billing detalhado com 5 ações e timeline de eventos"
```

---

## Task 10: CRUD de plans

**Files:**
- Create: `src/app/(platform)/platform/plans/page.tsx`
- Create: `src/app/(platform)/platform/plans/actions.ts`
- Create: `src/app/(platform)/platform/plans/_form.tsx`

- [ ] **Step 1: Actions**

```ts
// src/app/(platform)/platform/plans/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'

const schema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).nullish(),
  monthlyPriceCents: z.number().int().min(0),
  transactionFeeType: z.enum(['PERCENTAGE', 'FIXED', 'NONE']),
  transactionFeeValue: z.number().int().min(0),
  trialDaysDefault: z.number().int().min(0).max(365),
  isActive: z.boolean(),
  isDefault: z.boolean(),
})

export type PlanState = { error?: string; success?: boolean }

export async function createPlanAction(
  _prev: PlanState,
  formData: FormData,
): Promise<PlanState> {
  await assertPlatformAdmin()
  const parsed = schema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description') || null,
    monthlyPriceCents: Number(formData.get('monthlyPriceCents') ?? 0),
    transactionFeeType: formData.get('transactionFeeType') ?? 'NONE',
    transactionFeeValue: Number(formData.get('transactionFeeValue') ?? 0),
    trialDaysDefault: Number(formData.get('trialDaysDefault') ?? 30),
    isActive: formData.get('isActive') === 'true',
    isDefault: formData.get('isDefault') === 'true',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = createServiceClient()

  // Se marcou isDefault, desmarca qualquer outro que fosse default
  if (parsed.data.isDefault) {
    await supabase.from('plans').update({ is_default: false }).eq('is_default', true)
  }

  const { error } = await supabase.from('plans').insert({
    code: parsed.data.code,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    monthly_price_cents: parsed.data.monthlyPriceCents,
    transaction_fee_type: parsed.data.transactionFeeType,
    transaction_fee_value: parsed.data.transactionFeeValue,
    trial_days_default: parsed.data.trialDaysDefault,
    is_active: parsed.data.isActive,
    is_default: parsed.data.isDefault,
  })
  if (error) return { error: error.message }

  revalidatePath('/platform/plans')
  return { success: true }
}
```

- [ ] **Step 2: Page + form (padrão já visto)**

```tsx
// src/app/(platform)/platform/plans/page.tsx
import { assertPlatformAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/service-role'
import { NewPlanForm } from './_form'

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function PlansPage() {
  await assertPlatformAdmin()
  const supabase = createServiceClient()
  const { data: plans } = await supabase.from('plans').select('*').order('monthly_price_cents')

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-bold">Planos</h1>

      <ul className="space-y-2">
        {(plans ?? []).map((p) => (
          <li key={p.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {p.name} <span className="text-xs opacity-60">({p.code})</span>
                  {p.is_default ? (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      default
                    </span>
                  ) : null}
                </p>
                <p className="text-xs opacity-70">
                  {brl(p.monthly_price_cents)} ·{' '}
                  {p.transaction_fee_type === 'PERCENTAGE'
                    ? `${(p.transaction_fee_value / 100).toFixed(2)}%`
                    : p.transaction_fee_type === 'FIXED'
                      ? `${brl(p.transaction_fee_value)} fixo`
                      : 'sem taxa'}{' '}
                  · trial {p.trial_days_default}d
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {p.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <NewPlanForm />
    </main>
  )
}
```

```tsx
// src/app/(platform)/platform/plans/_form.tsx
'use client'

import { useActionState } from 'react'
import { createPlanAction, type PlanState } from './actions'

const INITIAL: PlanState = {}

export function NewPlanForm() {
  const [state, action, pending] = useActionState(createPlanAction, INITIAL)

  return (
    <form action={action} className="mt-6 max-w-md space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Novo plano</h2>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm">Código</span>
          <input name="code" required className="h-11 w-full rounded-md border px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Nome</span>
          <input name="name" required className="h-11 w-full rounded-md border px-3" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm">Descrição</span>
        <input name="description" className="h-11 w-full rounded-md border px-3" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">Mensalidade (centavos)</span>
        <input name="monthlyPriceCents" type="number" min={0} defaultValue={4900} required className="h-11 w-full rounded-md border px-3" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm">Tipo de taxa</span>
          <select name="transactionFeeType" className="h-11 w-full rounded-md border px-3">
            <option value="NONE">Nenhuma</option>
            <option value="PERCENTAGE">Percentual (basis points)</option>
            <option value="FIXED">Fixo (centavos)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Valor da taxa</span>
          <input name="transactionFeeValue" type="number" min={0} defaultValue={0} className="h-11 w-full rounded-md border px-3" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm">Trial default (dias)</span>
        <input name="trialDaysDefault" type="number" min={0} max={365} defaultValue={30} className="h-11 w-full rounded-md border px-3" />
      </label>

      <label className="inline-flex items-center gap-2">
        <input type="checkbox" name="isActive" value="true" defaultChecked />
        <span className="text-sm">Ativo</span>
      </label>
      <label className="inline-flex items-center gap-2 ml-3">
        <input type="checkbox" name="isDefault" value="true" />
        <span className="text-sm">Default</span>
      </label>

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Plano criado!</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-black px-4 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Criar plano'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(platform\)/platform/plans/
git commit -m "feat(platform): CRUD de planos"
```

---

## Task 11: Sanity check

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm build
```

---

## Critério de aceitação do épico 7

- ✅ `billing_events` criada com enum `BillingEventType`.
- ✅ Triggers automáticos que preenchem `billing_events` em updates relevantes e em inserts (TRIAL_STARTED).
- ✅ `pg_cron` agenda `expire_trials` e `suspend_past_due_tenants` diariamente.
- ✅ Helpers `trial.ts` e `status.ts` testados.
- ✅ Dashboard `/platform` mostra contagens por status, MRR projetado, trials expirando em 7 dias.
- ✅ Lista de tenants com filtro por status.
- ✅ Criação de tenant completa (insert + convite OAuth + user_profiles).
- ✅ Detalhe de tenant com equipe.
- ✅ Billing detalhado com 5 ações (estender trial, ativar, suspender, reativar, cancelar) e timeline de eventos.
- ✅ CRUD de planos com regra de `is_default` único.

**Output:** Aralabs tem controle administrativo total sobre tenants e billing. Próximo épico entrega real-time agenda + Modo Operação + PWA polish.
