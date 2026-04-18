# Épico 3 — Cadastros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todos os cadastros do salão — `professionals`, `customers`, `services`, `professional_services`, `business_hours`, `professional_availability`, `availability_blocks` — com migrations, RLS, UIs mobile-first no dashboard e testes unitários + pgTAP + E2E.

**Architecture:** Uma migration por entidade, seguindo o mesmo padrão: DDL com `tenant_id`, índices por tenant, trigger `touch_updated_at`, RLS habilitado + 2 policies mínimas (platform admin / tenant staff). CRUD no dashboard via Server Actions + Zod + revalidatePath. UIs mobile-first — listas em cards, formulários em sheet/drawer, confirmações com dialog.

**Tech Stack:** Postgres RLS, Next.js 16 Server Actions, Zod, Supabase JS client server-side.

**Referência:** Spec — Seções 5.2–5.5 (módulos de serviço/profissional/cliente), 6 (modelo), 7 (RLS pattern), 10.1 (onboarding), 13 (estrutura).

**Dependências:** Épicos 0, 1, 2 concluídos.

---

## File Structure

```
ara-barber/
├── supabase/
│   └── migrations/
│       ├── 0009_professionals.sql
│       ├── 0010_customers.sql
│       ├── 0011_services.sql
│       ├── 0012_professional_services.sql
│       ├── 0013_business_hours.sql
│       ├── 0014_professional_availability.sql
│       └── 0015_availability_blocks.sql
├── src/
│   ├── lib/
│   │   └── validation/
│   │       └── schemas.ts                    # Zod schemas de todas entidades
│   └── app/
│       └── (salon)/
│           └── dashboard/
│               ├── profissionais/
│               │   ├── page.tsx
│               │   ├── actions.ts
│               │   └── [id]/page.tsx
│               ├── clientes/
│               │   ├── page.tsx
│               │   └── actions.ts
│               ├── servicos/
│               │   ├── page.tsx
│               │   └── actions.ts
│               └── configuracoes/
│                   ├── horarios/
│                   │   ├── page.tsx
│                   │   └── actions.ts
│                   └── equipe/
│                       ├── page.tsx
│                       └── actions.ts
└── supabase/tests/
    └── rls_cadastros.test.sql
```

---

## Task 1: Migration — `professionals`

**Files:**
- Create: `supabase/migrations/0009_professionals.sql`

- [ ] **Step 1: Criar migration**

```bash
supabase migration new professionals
```

- [ ] **Step 2: Preencher**

```sql
-- supabase/migrations/0009_professionals.sql

create type public.commission_type as enum ('PERCENTAGE', 'FIXED');

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  display_name text,
  photo_url text,
  phone text,
  email text,
  commission_type public.commission_type not null default 'PERCENTAGE',
  commission_value integer not null default 0 check (commission_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index professionals_tenant_idx on public.professionals (tenant_id);
create index professionals_tenant_active_idx on public.professionals (tenant_id, is_active);

create trigger professionals_touch_updated_at
  before update on public.professionals
  for each row execute function public.touch_updated_at();

alter table public.professionals enable row level security;

create policy "professionals_platform_admin_all" on public.professionals
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

create policy "professionals_tenant_staff_all" on public.professionals
  for all
  using (tenant_id = auth.current_tenant_id())
  with check (tenant_id = auth.current_tenant_id());
```

- [ ] **Step 3: Aplicar**

```bash
supabase db reset
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_professionals.sql
git commit -m "feat(db): migration 0009 — professionals com RLS"
```

---

## Task 2: Migration — `customers`

**Files:**
- Create: `supabase/migrations/0010_customers.sql`

- [ ] **Step 1: Criar e preencher**

```bash
supabase migration new customers
```

```sql
-- supabase/migrations/0010_customers.sql

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  whatsapp text,
  email text,
  birth_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_user_tenant_unique unique (tenant_id, user_id)
);

create index customers_tenant_idx on public.customers (tenant_id);
create index customers_tenant_phone_idx on public.customers (tenant_id, phone);
create index customers_user_idx on public.customers (user_id) where user_id is not null;

create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

alter table public.customers enable row level security;

create policy "customers_platform_admin_all" on public.customers
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

create policy "customers_tenant_staff_all" on public.customers
  for all
  using (tenant_id = auth.current_tenant_id())
  with check (tenant_id = auth.current_tenant_id());

-- Customer vê o próprio registro (em qualquer tenant)
create policy "customers_self_read" on public.customers
  for select
  using (user_id = auth.uid());

-- Customer pode atualizar próprio registro (nome, telefone, etc)
create policy "customers_self_update" on public.customers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 2: Aplicar + commit**

```bash
supabase db reset
git add supabase/migrations/0010_customers.sql
git commit -m "feat(db): migration 0010 — customers com RLS"
```

---

## Task 3: Migration — `services`

**Files:**
- Create: `supabase/migrations/0011_services.sql`

- [ ] **Step 1: Criar e preencher**

```bash
supabase migration new services
```

```sql
-- supabase/migrations/0011_services.sql

create type public.deposit_type as enum ('FIXED', 'PERCENTAGE');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 480),
  price_cents integer not null check (price_cents >= 0),
  deposit_required boolean not null default false,
  deposit_type public.deposit_type,
  deposit_value_cents integer check (deposit_value_cents is null or deposit_value_cents >= 0),
  deposit_percentage integer check (
    deposit_percentage is null
    or (deposit_percentage >= 0 and deposit_percentage <= 10000)
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_tenant_idx on public.services (tenant_id);
create index services_tenant_active_idx on public.services (tenant_id, is_active);

create trigger services_touch_updated_at
  before update on public.services
  for each row execute function public.touch_updated_at();

alter table public.services enable row level security;

create policy "services_platform_admin_all" on public.services
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

create policy "services_tenant_staff_all" on public.services
  for all
  using (tenant_id = auth.current_tenant_id())
  with check (tenant_id = auth.current_tenant_id());
```

- [ ] **Step 2: Aplicar + commit**

```bash
supabase db reset
git add supabase/migrations/0011_services.sql
git commit -m "feat(db): migration 0011 — services com RLS"
```

---

## Task 4: Migration — `professional_services`

**Files:**
- Create: `supabase/migrations/0012_professional_services.sql`

- [ ] **Step 1: Criar e preencher**

```bash
supabase migration new professional_services
```

```sql
-- supabase/migrations/0012_professional_services.sql

create table public.professional_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint professional_services_unique unique (tenant_id, professional_id, service_id)
);

create index professional_services_tenant_idx on public.professional_services (tenant_id);
create index professional_services_professional_idx on public.professional_services (professional_id);
create index professional_services_service_idx on public.professional_services (service_id);

alter table public.professional_services enable row level security;

create policy "professional_services_platform_admin_all" on public.professional_services
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

create policy "professional_services_tenant_staff_all" on public.professional_services
  for all
  using (tenant_id = auth.current_tenant_id())
  with check (tenant_id = auth.current_tenant_id());
```

- [ ] **Step 2: Aplicar + commit**

```bash
supabase db reset
git add supabase/migrations/0012_professional_services.sql
git commit -m "feat(db): migration 0012 — professional_services join"
```

---

## Task 5: Migration — `business_hours`

**Files:**
- Create: `supabase/migrations/0013_business_hours.sql`

- [ ] **Step 1: Criar e preencher**

```bash
supabase migration new business_hours
```

```sql
-- supabase/migrations/0013_business_hours.sql

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_hours_unique unique (tenant_id, weekday),
  constraint business_hours_time_order check (start_time < end_time)
);

create index business_hours_tenant_idx on public.business_hours (tenant_id);

create trigger business_hours_touch_updated_at
  before update on public.business_hours
  for each row execute function public.touch_updated_at();

alter table public.business_hours enable row level security;

create policy "business_hours_platform_admin_all" on public.business_hours
  for all
  using (auth.is_platform_admin())
  with check (auth.is_platform_admin());

create policy "business_hours_tenant_staff_all" on public.business_hours
  for all
  using (tenant_id = auth.current_tenant_id())
  with check (tenant_id = auth.current_tenant_id());

-- Leitura pública (qualquer anônimo pode ver horário do salão para agendar)
create policy "business_hours_public_read" on public.business_hours
  for select
  using (is_open = true);
```

- [ ] **Step 2: Aplicar + commit**

```bash
supabase db reset
git add supabase/migrations/0013_business_hours.sql
git commit -m "feat(db): migration 0013 — business_hours com RLS + leitura pública"
```

---

## Task 6: Migration — `professional_availability`

**Files:**
- Create: `supabase/migrations/0014_professional_availability.sql`

```bash
supabase migration new professional_availability
```

```sql
-- supabase/migrations/0014_professional_availability.sql

create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint professional_availability_unique unique (tenant_id, professional_id, weekday, start_time),
  constraint professional_availability_time_order check (start_time < end_time)
);

create index professional_availability_prof_idx
  on public.professional_availability (professional_id, weekday);

create trigger professional_availability_touch_updated_at
  before update on public.professional_availability
  for each row execute function public.touch_updated_at();

alter table public.professional_availability enable row level security;

create policy "professional_availability_platform_admin_all" on public.professional_availability
  for all using (auth.is_platform_admin()) with check (auth.is_platform_admin());

create policy "professional_availability_tenant_staff_all" on public.professional_availability
  for all using (tenant_id = auth.current_tenant_id()) with check (tenant_id = auth.current_tenant_id());

create policy "professional_availability_public_read" on public.professional_availability
  for select using (is_available = true);
```

```bash
supabase db reset
git add supabase/migrations/0014_professional_availability.sql
git commit -m "feat(db): migration 0014 — professional_availability"
```

---

## Task 7: Migration — `availability_blocks`

**Files:**
- Create: `supabase/migrations/0015_availability_blocks.sql`

```bash
supabase migration new availability_blocks
```

```sql
-- supabase/migrations/0015_availability_blocks.sql

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
  for all using (auth.is_platform_admin()) with check (auth.is_platform_admin());

create policy "availability_blocks_tenant_staff_all" on public.availability_blocks
  for all using (tenant_id = auth.current_tenant_id()) with check (tenant_id = auth.current_tenant_id());
```

```bash
supabase db reset
pnpm db:types    # regenera tipos TS
git add supabase/migrations/0015_availability_blocks.sql src/lib/supabase/types.ts
git commit -m "feat(db): migration 0015 — availability_blocks + regenera tipos"
```

---

## Task 8: Zod schemas em `lib/validation/schemas.ts`

**Files:**
- Create: `src/lib/validation/schemas.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/validation/schemas.ts
import { z } from 'zod'

const uuid = z.string().uuid()
const nonEmptyString = z.string().trim().min(1).max(200)

export const professionalSchema = z.object({
  name: nonEmptyString,
  displayName: z.string().trim().max(100).nullish(),
  photoUrl: z.string().url().nullish(),
  phone: z.string().trim().max(30).nullish(),
  email: z.string().email().nullish(),
  commissionType: z.enum(['PERCENTAGE', 'FIXED']),
  commissionValue: z.number().int().min(0).max(100000),
  isActive: z.boolean().default(true),
})

export const customerSchema = z.object({
  name: nonEmptyString,
  phone: z.string().trim().min(8).max(30),
  whatsapp: z.string().trim().max(30).nullish(),
  email: z.string().email().nullish(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(1000).nullish(),
  isActive: z.boolean().default(true),
})

export const serviceSchema = z
  .object({
    name: nonEmptyString,
    description: z.string().max(1000).nullish(),
    durationMinutes: z.number().int().min(5).max(480),
    priceCents: z.number().int().min(0),
    depositRequired: z.boolean().default(false),
    depositType: z.enum(['FIXED', 'PERCENTAGE']).nullish(),
    depositValueCents: z.number().int().min(0).nullish(),
    depositPercentage: z.number().int().min(0).max(10000).nullish(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (v) => !v.depositRequired || (v.depositType !== null && v.depositType !== undefined),
    { message: 'Depósito exigido sem tipo definido' },
  )

export const professionalServiceLinkSchema = z.object({
  professionalId: uuid,
  serviceId: uuid,
})

export const businessHoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isOpen: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, { message: 'startTime deve ser menor que endTime' })

export const professionalAvailabilitySchema = z
  .object({
    professionalId: uuid,
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, { message: 'startTime deve ser menor que endTime' })

export const availabilityBlockSchema = z
  .object({
    professionalId: uuid,
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().max(200).nullish(),
  })
  .refine((v) => v.startAt < v.endAt, { message: 'startAt deve ser menor que endAt' })

export type ProfessionalInput = z.infer<typeof professionalSchema>
export type CustomerInput = z.infer<typeof customerSchema>
export type ServiceInput = z.infer<typeof serviceSchema>
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>
export type ProfessionalAvailabilityInput = z.infer<typeof professionalAvailabilitySchema>
export type AvailabilityBlockInput = z.infer<typeof availabilityBlockSchema>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validation/schemas.ts
git commit -m "feat(validation): zod schemas para cadastros"
```

---

## Task 9: CRUD de profissionais (actions + UI)

**Files:**
- Create: `src/app/(salon)/dashboard/profissionais/actions.ts`
- Create: `src/app/(salon)/dashboard/profissionais/page.tsx`

- [ ] **Step 1: Server actions**

```ts
// src/app/(salon)/dashboard/profissionais/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { professionalSchema } from '@/lib/validation/schemas'

export type ActionState = { error?: string; success?: boolean }

export async function createProfessionalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertStaff()
  const parsed = professionalSchema.safeParse({
    name: formData.get('name'),
    displayName: formData.get('displayName') || null,
    photoUrl: formData.get('photoUrl') || null,
    phone: formData.get('phone') || null,
    email: formData.get('email') || null,
    commissionType: formData.get('commissionType') ?? 'PERCENTAGE',
    commissionValue: Number(formData.get('commissionValue') ?? 0),
    isActive: formData.get('isActive') === 'true',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('professionals').insert({
    tenant_id: user.profile.tenantId,
    name: parsed.data.name,
    display_name: parsed.data.displayName ?? null,
    photo_url: parsed.data.photoUrl ?? null,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    commission_type: parsed.data.commissionType,
    commission_value: parsed.data.commissionValue,
    is_active: parsed.data.isActive,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/profissionais')
  return { success: true }
}

export async function toggleProfessionalActiveAction(id: string, isActive: boolean) {
  const user = await assertStaff()
  const supabase = await createClient()
  await supabase
    .from('professionals')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tenant_id', user.profile.tenantId)
  revalidatePath('/dashboard/profissionais')
}

export async function deleteProfessionalAction(id: string) {
  const user = await assertStaff()
  const supabase = await createClient()
  // soft-delete: marca inativo (já existe toggleActive). Aqui deleta físico caso admin precise.
  await supabase
    .from('professionals')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.profile.tenantId)
  revalidatePath('/dashboard/profissionais')
}
```

- [ ] **Step 2: Página + lista mobile-first**

```tsx
// src/app/(salon)/dashboard/profissionais/page.tsx
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { NewProfessionalForm } from './_new-professional-form'

export default async function ProfessionalsPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, name, display_name, phone, is_active, commission_type, commission_value')
    .order('name')

  return (
    <main className="p-4 pb-20">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Profissionais</h1>
        <p className="text-sm opacity-70">Gerencie a equipe do salão.</p>
      </header>

      <ul className="space-y-2">
        {(professionals ?? []).map((p) => (
          <li key={p.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{p.display_name || p.name}</p>
                {p.phone ? <p className="text-xs opacity-70">{p.phone}</p> : null}
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

      {(professionals ?? []).length === 0 ? (
        <p className="mt-6 text-center text-sm opacity-70">
          Nenhum profissional ainda. Adicione o primeiro abaixo.
        </p>
      ) : null}

      <NewProfessionalForm />
    </main>
  )
}
```

- [ ] **Step 3: Form component**

```tsx
// src/app/(salon)/dashboard/profissionais/_new-professional-form.tsx
'use client'

import { useActionState } from 'react'
import { createProfessionalAction, type ActionState } from './actions'

const INITIAL: ActionState = {}

export function NewProfessionalForm() {
  const [state, action, pending] = useActionState(createProfessionalAction, INITIAL)

  return (
    <form action={action} className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Novo profissional</h2>

      <label className="block">
        <span className="mb-1 block text-sm">Nome</span>
        <input
          name="name"
          required
          className="h-11 w-full rounded-md border px-3"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">Nome curto (opcional)</span>
        <input name="displayName" className="h-11 w-full rounded-md border px-3" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">Telefone</span>
        <input name="phone" type="tel" className="h-11 w-full rounded-md border px-3" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm">Tipo de comissão</span>
          <select name="commissionType" className="h-11 w-full rounded-md border px-3">
            <option value="PERCENTAGE">%</option>
            <option value="FIXED">R$ fixo</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Valor</span>
          <input
            name="commissionValue"
            type="number"
            min="0"
            defaultValue={0}
            className="h-11 w-full rounded-md border px-3"
          />
        </label>
      </div>

      <input type="hidden" name="isActive" value="true" />

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Adicionado!</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Adicionar profissional'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(salon\)/dashboard/profissionais/
git commit -m "feat(salon): CRUD básico de profissionais"
```

---

## Task 10: CRUD de serviços

**Files:**
- Create: `src/app/(salon)/dashboard/servicos/actions.ts`
- Create: `src/app/(salon)/dashboard/servicos/page.tsx`
- Create: `src/app/(salon)/dashboard/servicos/_new-service-form.tsx`

- [ ] **Step 1: Server action**

```ts
// src/app/(salon)/dashboard/servicos/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { serviceSchema } from '@/lib/validation/schemas'

export type ActionState = { error?: string; success?: boolean }

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertStaff()
  const parsed = serviceSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || null,
    durationMinutes: Number(formData.get('durationMinutes') ?? 30),
    priceCents: Number(formData.get('priceCents') ?? 0),
    depositRequired: formData.get('depositRequired') === 'true',
    depositType: formData.get('depositType') || null,
    depositValueCents: formData.get('depositValueCents') ? Number(formData.get('depositValueCents')) : null,
    depositPercentage: formData.get('depositPercentage') ? Number(formData.get('depositPercentage')) : null,
    isActive: true,
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.from('services').insert({
    tenant_id: user.profile.tenantId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    duration_minutes: parsed.data.durationMinutes,
    price_cents: parsed.data.priceCents,
    deposit_required: parsed.data.depositRequired,
    deposit_type: parsed.data.depositType ?? null,
    deposit_value_cents: parsed.data.depositValueCents ?? null,
    deposit_percentage: parsed.data.depositPercentage ?? null,
    is_active: true,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/servicos')
  return { success: true }
}
```

- [ ] **Step 2: Página**

```tsx
// src/app/(salon)/dashboard/servicos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { NewServiceForm } from './_new-service-form'

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function ServicesPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_cents, is_active')
    .order('name')

  return (
    <main className="p-4 pb-20">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Serviços</h1>
      </header>

      <ul className="space-y-2">
        {(services ?? []).map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-xs opacity-70">
                {s.duration_minutes} min · {brl(s.price_cents)}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {s.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </li>
        ))}
      </ul>

      <NewServiceForm />
    </main>
  )
}
```

- [ ] **Step 3: Form component**

```tsx
// src/app/(salon)/dashboard/servicos/_new-service-form.tsx
'use client'

import { useActionState } from 'react'
import { createServiceAction, type ActionState } from './actions'

const INITIAL: ActionState = {}

export function NewServiceForm() {
  const [state, action, pending] = useActionState(createServiceAction, INITIAL)

  return (
    <form action={action} className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Novo serviço</h2>

      <label className="block">
        <span className="mb-1 block text-sm">Nome</span>
        <input name="name" required className="h-11 w-full rounded-md border px-3" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm">Duração (min)</span>
          <input
            name="durationMinutes"
            type="number"
            min="5"
            max="480"
            defaultValue={30}
            required
            className="h-11 w-full rounded-md border px-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Preço (centavos)</span>
          <input
            name="priceCents"
            type="number"
            min="0"
            defaultValue={0}
            required
            className="h-11 w-full rounded-md border px-3"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm">Descrição (opcional)</span>
        <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2" />
      </label>

      <input type="hidden" name="depositRequired" value="false" />

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Adicionado!</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Adicionar serviço'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(salon\)/dashboard/servicos/
git commit -m "feat(salon): CRUD básico de serviços"
```

---

## Task 11: CRUD de clientes (apenas listagem + criação manual)

**Files:**
- Create: `src/app/(salon)/dashboard/clientes/actions.ts`
- Create: `src/app/(salon)/dashboard/clientes/page.tsx`
- Create: `src/app/(salon)/dashboard/clientes/_new-customer-form.tsx`

Seguir o mesmo padrão dos épicos anteriores: validar com `customerSchema`, inserir com `tenant_id` do `assertStaff()`, revalidar path.

- [ ] **Step 1: Server actions**

```ts
// src/app/(salon)/dashboard/clientes/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { customerSchema } from '@/lib/validation/schemas'

export type ActionState = { error?: string; success?: boolean }

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertStaff()
  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    whatsapp: formData.get('whatsapp') || null,
    email: formData.get('email') || null,
    notes: formData.get('notes') || null,
    isActive: true,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.from('customers').insert({
    tenant_id: user.profile.tenantId,
    user_id: null,
    name: parsed.data.name,
    phone: parsed.data.phone,
    whatsapp: parsed.data.whatsapp ?? null,
    email: parsed.data.email ?? null,
    notes: parsed.data.notes ?? null,
    is_active: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/clientes')
  return { success: true }
}
```

- [ ] **Step 2: Página e form** — mesmo padrão dos anteriores (input de `name`, `phone`, `whatsapp`, `email`, `notes`). Render lista por ordem alfabética com phone abaixo do nome.

```tsx
// src/app/(salon)/dashboard/clientes/page.tsx
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { NewCustomerForm } from './_new-customer-form'

export default async function CustomersPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, is_active')
    .order('name')

  return (
    <main className="p-4 pb-20">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Clientes</h1>
      </header>

      <ul className="space-y-2">
        {(customers ?? []).map((c) => (
          <li key={c.id} className="rounded-lg border p-3">
            <p className="font-medium">{c.name}</p>
            <p className="text-xs opacity-70">{c.phone}</p>
          </li>
        ))}
      </ul>

      <NewCustomerForm />
    </main>
  )
}
```

```tsx
// src/app/(salon)/dashboard/clientes/_new-customer-form.tsx
'use client'

import { useActionState } from 'react'
import { createCustomerAction, type ActionState } from './actions'

const INITIAL: ActionState = {}

export function NewCustomerForm() {
  const [state, action, pending] = useActionState(createCustomerAction, INITIAL)

  return (
    <form action={action} className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Novo cliente</h2>

      <label className="block">
        <span className="mb-1 block text-sm">Nome</span>
        <input name="name" required className="h-11 w-full rounded-md border px-3" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">Telefone</span>
        <input name="phone" type="tel" required className="h-11 w-full rounded-md border px-3" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">WhatsApp (opcional)</span>
        <input name="whatsapp" type="tel" className="h-11 w-full rounded-md border px-3" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">E-mail (opcional)</span>
        <input name="email" type="email" className="h-11 w-full rounded-md border px-3" />
      </label>

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Cliente adicionado!</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Adicionar cliente'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(salon\)/dashboard/clientes/
git commit -m "feat(salon): CRUD básico de clientes"
```

---

## Task 12: Horários do salão (configurações)

**Files:**
- Create: `src/app/(salon)/dashboard/configuracoes/horarios/actions.ts`
- Create: `src/app/(salon)/dashboard/configuracoes/horarios/page.tsx`

A tela tem 7 linhas (domingo a sábado) com toggle "aberto" + horários `start`/`end`. Submit salva todos de uma vez.

- [ ] **Step 1: Server action — upsert em lote**

```ts
// src/app/(salon)/dashboard/configuracoes/horarios/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'

const schema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        isOpen: z.boolean(),
      }),
    )
    .length(7),
})

export type SaveHoursState = { error?: string; success?: boolean }

export async function saveBusinessHoursAction(
  _prev: SaveHoursState,
  formData: FormData,
): Promise<SaveHoursState> {
  const user = await assertStaff()
  const raw = formData.get('payload')
  if (typeof raw !== 'string') return { error: 'payload ausente' }

  const parsed = schema.safeParse(JSON.parse(raw))
  if (!parsed.success) return { error: 'dados inválidos' }

  const supabase = await createClient()
  const rows = parsed.data.hours.map((h) => ({
    tenant_id: user.profile.tenantId!,
    weekday: h.weekday,
    start_time: h.startTime,
    end_time: h.endTime,
    is_open: h.isOpen,
  }))

  const { error } = await supabase
    .from('business_hours')
    .upsert(rows, { onConflict: 'tenant_id,weekday' })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/configuracoes/horarios')
  return { success: true }
}
```

- [ ] **Step 2: Page + client form**

```tsx
// src/app/(salon)/dashboard/configuracoes/horarios/page.tsx
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { HoursEditor } from './_hours-editor'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default async function HoursPage() {
  await assertStaff()
  const supabase = await createClient()
  const { data } = await supabase.from('business_hours').select('*').order('weekday')

  const byWeekday = new Map((data ?? []).map((h) => [h.weekday, h]))
  const initial = DAYS.map((_, i) => ({
    weekday: i,
    startTime: byWeekday.get(i)?.start_time?.slice(0, 5) ?? '09:00',
    endTime: byWeekday.get(i)?.end_time?.slice(0, 5) ?? '18:00',
    isOpen: byWeekday.get(i)?.is_open ?? false,
  }))

  return (
    <main className="p-4 pb-20">
      <h1 className="text-xl font-bold">Horários de funcionamento</h1>
      <HoursEditor initial={initial} days={DAYS} />
    </main>
  )
}
```

```tsx
// src/app/(salon)/dashboard/configuracoes/horarios/_hours-editor.tsx
'use client'

import { useActionState, useState } from 'react'
import { saveBusinessHoursAction, type SaveHoursState } from './actions'

type Row = { weekday: number; startTime: string; endTime: string; isOpen: boolean }

const INITIAL: SaveHoursState = {}

export function HoursEditor({ initial, days }: { initial: Row[]; days: string[] }) {
  const [hours, setHours] = useState<Row[]>(initial)
  const [state, action, pending] = useActionState(saveBusinessHoursAction, INITIAL)

  function update(i: number, patch: Partial<Row>) {
    setHours((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="payload" value={JSON.stringify({ hours })} />

      {hours.map((h, i) => (
        <div key={h.weekday} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{days[h.weekday]}</span>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={h.isOpen}
                onChange={(e) => update(i, { isOpen: e.target.checked })}
              />
              Aberto
            </label>
          </div>

          {h.isOpen ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="time"
                value={h.startTime}
                onChange={(e) => update(i, { startTime: e.target.value })}
                className="h-11 w-full rounded-md border px-3"
              />
              <input
                type="time"
                value={h.endTime}
                onChange={(e) => update(i, { endTime: e.target.value })}
                className="h-11 w-full rounded-md border px-3"
              />
            </div>
          ) : null}
        </div>
      ))}

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Salvo!</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Salvar horários'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(salon\)/dashboard/configuracoes/horarios/
git commit -m "feat(salon): editor de horários de funcionamento"
```

---

## Task 13: Teste pgTAP de RLS de cadastros

**Files:**
- Create: `supabase/tests/rls_cadastros.test.sql`

- [ ] **Step 1: Escrever testes cross-tenant**

```sql
-- supabase/tests/rls_cadastros.test.sql
begin;
select plan(8);

-- Setup: 2 tenants + owners + 1 professional e 1 service em cada
insert into public.tenants (id, slug, name, subdomain) values
  ('11111111-1111-1111-1111-111111111111', 'tenant-a', 'Tenant A', 'tenant-a'),
  ('22222222-2222-2222-2222-222222222222', 'tenant-b', 'Tenant B', 'tenant-b')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@a.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@b.com')
on conflict (id) do nothing;

insert into public.user_profiles (user_id, role, tenant_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SALON_OWNER', '11111111-1111-1111-1111-111111111111', 'Owner A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SALON_OWNER', '22222222-2222-2222-2222-222222222222', 'Owner B')
on conflict (user_id) do nothing;

insert into public.professionals (tenant_id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Prof A'),
  ('22222222-2222-2222-2222-222222222222', 'Prof B');

insert into public.services (tenant_id, name, duration_minutes, price_cents) values
  ('11111111-1111-1111-1111-111111111111', 'Corte A', 30, 4500),
  ('22222222-2222-2222-2222-222222222222', 'Corte B', 30, 4500);

set local role authenticated;

-- Owner A vê só professional do tenant A
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select results_eq(
  'select name from public.professionals order by name',
  array['Prof A'],
  'Owner A vê apenas Prof A'
);

select results_eq(
  'select name from public.services order by name',
  array['Corte A'],
  'Owner A vê apenas Corte A'
);

-- Owner A NÃO consegue inserir professional em tenant B
select throws_ok(
  $$insert into public.professionals (tenant_id, name) values ('22222222-2222-2222-2222-222222222222', 'Hack')$$,
  'new row violates row-level security policy',
  'Owner A não consegue inserir em tenant B'
);

-- Owner B vê apenas Prof B
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

select results_eq(
  'select name from public.professionals order by name',
  array['Prof B'],
  'Owner B vê apenas Prof B'
);

-- Owner B não consegue atualizar service de tenant A
select results_eq(
  $$update public.services set name = 'Hack' where tenant_id = '11111111-1111-1111-1111-111111111111' returning name$$,
  array[]::text[],
  'Owner B não consegue atualizar service de tenant A'
);

-- Anônimo vê business_hours públicos, não vê professionals
reset role;
set local role anon;

insert into public.business_hours (tenant_id, weekday, start_time, end_time, is_open) values
  ('11111111-1111-1111-1111-111111111111', 1, '09:00', '18:00', true);

select results_eq(
  'select count(*)::int from public.business_hours',
  array[1],
  'Anônimo vê business_hours abertos (policy pública)'
);

select results_eq(
  'select count(*)::int from public.professionals',
  array[0],
  'Anônimo não vê professionals (sem policy pública)'
);

select results_eq(
  'select count(*)::int from public.services',
  array[0],
  'Anônimo não vê services (sem policy pública)'
);

select finish();
rollback;
```

- [ ] **Step 2: Rodar**

```bash
supabase db test
```

Expected: 8 PASS.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_cadastros.test.sql
git commit -m "test(db): pgTAP RLS de cadastros (cross-tenant + anônimo)"
```

---

## Task 14: Regenerar tipos + sanity check

- [ ] **Step 1: Tipos atualizados**

```bash
pnpm db:types
```

- [ ] **Step 2: Rodar tudo**

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm build
```

- [ ] **Step 3: Commit (se houver)**

```bash
git add -A
git commit -m "chore: regenera tipos + sanity check do épico 3"
```

---

## Critério de aceitação do épico 3

- ✅ 7 migrations (0009–0015) com enums de suporte, RLS e índices.
- ✅ `services.deposit_required`, `deposit_type`, `deposit_value_cents`, `deposit_percentage` existem mas sem enforcement (é Fase 2).
- ✅ Policies cross-tenant garantem isolamento (pgTAP verifica 8 casos).
- ✅ Leitura pública habilitada em `business_hours` (dias abertos) e `professional_availability` (entradas disponíveis). Professionals e services não têm leitura pública — essas vêm via server action dedicada no Épico 5.
- ✅ Zod schemas para cada entidade em `src/lib/validation/schemas.ts`.
- ✅ UIs mobile-first no dashboard para profissionais, clientes, serviços e horários (adicionar + listar).
- ✅ Tipos TS regenerados a cada migration.

**Output:** dashboard do salão passa a ter conteúdo real — é possível cadastrar equipe, serviços, clientes e horários. Próximo épico monta a agenda em cima disso.
