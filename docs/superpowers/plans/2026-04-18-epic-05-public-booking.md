> **Nota histórica (2026-04-26):** este doc foi escrito quando o produto se chamava `ara-barber` e a área autenticada era `/salon/*`. Nomes mudaram: `ara-agenda`, `/admin/*`, role `BUSINESS_OWNER`. Conteúdo técnico permanece válido.

# Épico 5 — Booking Público Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o wizard público de agendamento — `serviço → profissional → data → horário → login (Google/Apple/Magic) → confirmar` — acessado pelo cliente final em `{slug}.aralabs.com.br/book/*`, e a área `/my-bookings` com os agendamentos do usuário logado.

**Architecture:** Múltiplas páginas server-rendered em `(public)/book/*` formando wizard. Estado de progresso do wizard persistido em `searchParams` (URL), não em server session — permite compartilhar/recuperar fluxo. Login inline no passo 5 via Supabase Auth (Google, Apple, magic link). Callback pós-login cria/atualiza `customers` row (linkando `user_id` ↔ `tenantId`) e retorna ao passo de confirmação. Confirmação usa `createAppointmentForTenant` (do Épico 4) com `bookedBySource = 'PUBLIC_WEB'`.

**Tech Stack:** Next.js 16 server components, Supabase Auth OAuth + Magic Link, Server Actions, Zod, `date-fns`.

**Referência:** Spec — Seções 9 (auth customer), 10.3 (fluxo de agendamento público).

**Dependências:** Épicos 0–4.

---

## Atualizações de decisão — 2026-04-19

Decisões tomadas durante o Épico 3 que **reescrevem** parte deste plano:

1. **App 100% autenticado.** Nada é visível sem login — nem serviços, nem horários, nem disponibilidade. As policies `business_hours_public_read` e `professional_availability_public_read` foram removidas (migration 0016). O arquivo `0017_public_read_helpers.sql` originalmente planejado aqui **não deve ser criado**.

2. **Métodos de login do customer (Fase 1):** OTP por e-mail (Supabase `signInWithOtp`) + Google OAuth. **Sem magic link separado**, **sem Apple** (adiado), **sem senha**. WhatsApp OTP vira Fase 2.

3. **Fluxo revisto:**
   1. Cliente acessa `<slug>.aralabs.com.br/` → home marketing com CTA "Agendar"
   2. Clica CTA → `/book` → **login primeiro** (e-mail → OTP, ou botão Google)
   3. Pós-login: **auto-insert** em `customers(tenant_id, user_id)` se ainda não existir (fields `name`/`phone` ficam NULL). Isso alimenta `/salon/dashboard/clientes` imediatamente.
   4. Wizard: serviço → profissional → data → horário
   5. **Confirmação**: popup coleta `name` + `phone` se ainda nulos; ao confirmar, atualiza `customers` e cria `appointment`.

4. **Modelagem já ajustada em Épico 3:**
   - `customers.user_id NOT NULL` (todo cliente tem `auth.users`)
   - `customers.name` e `customers.phone` nullable (preenchidos no popup de confirm)
   - Unique `(tenant_id, user_id)` impede duplicata

5. **Google OAuth precisa de setup manual** (Google Cloud Console + Supabase Dashboard) — ver Épico 10 Task 16.

6. **OTP email** funciona nativo no Supabase free tier (4/hora) pra dev; prod precisa SMTP dedicado (Resend free até 3k/mês). Registrar isso como débito quando ativar prod.

---

## File Structure

```
ara-barber/
├── supabase/migrations/
│   └── 0017_public_read_helpers.sql
├── src/
│   ├── lib/
│   │   ├── booking/
│   │   │   ├── public-data.ts            # Task 2 (server-only helpers)
│   │   │   └── wizard-state.ts           # Task 3 (parse/validate searchParams)
│   │   └── auth/
│   │       └── customer.ts               # Task 8 (upsert customer após login)
│   └── app/
│       ├── (public)/
│       │   ├── book/
│       │   │   ├── page.tsx              # Task 4 — passo 1 (serviço)
│       │   │   ├── professional/page.tsx # Task 5
│       │   │   ├── date/page.tsx         # Task 6
│       │   │   ├── time/page.tsx         # Task 7
│       │   │   ├── login/page.tsx        # Task 9
│       │   │   ├── confirm/
│       │   │   │   ├── page.tsx          # Task 10
│       │   │   │   └── actions.ts        # Task 10
│       │   │   └── success/
│       │   │       └── page.tsx          # Task 10
│       │   ├── my-bookings/
│       │   │   └── page.tsx              # Task 11
│       │   └── login/page.tsx            # Task 9 (public customer login)
│       └── auth/callback/route.ts        # Task 8 (modificado)
└── tests/
    └── unit/
        └── booking/
            ├── public-data.test.ts
            └── wizard-state.test.ts
```

---

## Task 1: Migration — policies de leitura pública

**Files:**
- Create: `supabase/migrations/0017_public_read_helpers.sql`

A leitura anônima de `services` e `professionals` é feita via **server actions com service role** (decisão do spec §7.4), então **não** precisamos habilitar RLS pública para eles. Esta migration adiciona uma view/função auxiliar que a server action usa para agregar dados do wizard de forma eficiente.

- [ ] **Step 1: Criar migration**

```bash
supabase migration new public_read_helpers
```

- [ ] **Step 2: Preencher**

```sql
-- supabase/migrations/0017_public_read_helpers.sql

-- Função helper que retorna serviços ativos do tenant (usada via service role).
create or replace function public.list_tenant_public_services(p_tenant uuid)
returns table (
  id uuid,
  name text,
  description text,
  duration_minutes integer,
  price_cents integer
)
language sql stable
security definer
set search_path = public
as $$
  select id, name, description, duration_minutes, price_cents
  from public.services
  where tenant_id = p_tenant and is_active = true
  order by name
$$;

revoke all on function public.list_tenant_public_services(uuid) from public;
grant execute on function public.list_tenant_public_services(uuid) to service_role;

-- Retorna profissionais ativos do tenant que executam um determinado serviço.
create or replace function public.list_tenant_public_professionals(p_tenant uuid, p_service uuid)
returns table (
  id uuid,
  name text,
  display_name text,
  photo_url text
)
language sql stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.display_name, p.photo_url
  from public.professionals p
  join public.professional_services ps on ps.professional_id = p.id
  where p.tenant_id = p_tenant
    and ps.service_id = p_service
    and p.is_active = true
  order by coalesce(p.display_name, p.name)
$$;

revoke all on function public.list_tenant_public_professionals(uuid, uuid) from public;
grant execute on function public.list_tenant_public_professionals(uuid, uuid) to service_role;
```

- [ ] **Step 3: Aplicar**

```bash
supabase db reset
pnpm db:types
git add supabase/migrations/0017_public_read_helpers.sql src/lib/supabase/types.ts
git commit -m "feat(db): funções helper para leitura pública via service role"
```

---

## Task 2: `lib/booking/public-data.ts`

**Files:**
- Create: `src/lib/booking/public-data.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/booking/public-data.ts
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service-role'
import { computeAvailableSlots, type Slot } from './availability'
import { weekdayOf } from './time'

export type PublicService = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceCents: number
}

export type PublicProfessional = {
  id: string
  name: string
  displayName: string | null
  photoUrl: string | null
}

export async function listServices(tenantId: string): Promise<PublicService[]> {
  const supabase = createServiceClient()
  const { data } = await supabase.rpc('list_tenant_public_services', { p_tenant: tenantId })
  if (!data) return []
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
  }))
}

export async function listProfessionals(
  tenantId: string,
  serviceId: string,
): Promise<PublicProfessional[]> {
  const supabase = createServiceClient()
  const { data } = await supabase.rpc('list_tenant_public_professionals', {
    p_tenant: tenantId,
    p_service: serviceId,
  })
  if (!data) return []
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.display_name,
    photoUrl: p.photo_url,
  }))
}

export async function listSlotsForDay(input: {
  tenantId: string
  professionalId: string
  serviceId: string
  date: string // YYYY-MM-DD
  tz: string
}): Promise<Slot[]> {
  const supabase = createServiceClient()
  const weekday = weekdayOf(input.date, input.tz)

  const [svc, bh, pa, apts, blocks] = await Promise.all([
    supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', input.serviceId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle(),
    supabase
      .from('business_hours')
      .select('weekday, start_time, end_time, is_open')
      .eq('tenant_id', input.tenantId)
      .eq('weekday', weekday)
      .maybeSingle(),
    supabase
      .from('professional_availability')
      .select('weekday, start_time, end_time, is_available')
      .eq('professional_id', input.professionalId)
      .eq('weekday', weekday),
    supabase
      .from('appointments')
      .select('start_at, end_at')
      .eq('professional_id', input.professionalId)
      .eq('appointment_date', input.date)
      .in('status', ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE']),
    supabase
      .from('availability_blocks')
      .select('start_at, end_at')
      .eq('professional_id', input.professionalId)
      .gte('start_at', `${input.date}T00:00:00`)
      .lt('start_at', `${input.date}T23:59:59`),
  ])

  if (!svc.data || !bh.data) return []

  const existingRanges = (apts.data ?? []).map((a) => ({
    startTime: new Date(a.start_at).toISOString().slice(11, 16),
    endTime: new Date(a.end_at).toISOString().slice(11, 16),
  }))

  const blockRanges = (blocks.data ?? []).map((b) => ({
    startTime: new Date(b.start_at).toISOString().slice(11, 16),
    endTime: new Date(b.end_at).toISOString().slice(11, 16),
  }))

  return computeAvailableSlots({
    date: input.date,
    serviceDurationMinutes: svc.data.duration_minutes,
    businessHours: {
      weekday,
      startTime: bh.data.start_time.slice(0, 5),
      endTime: bh.data.end_time.slice(0, 5),
      isOpen: bh.data.is_open,
    },
    professionalAvailability: (pa.data ?? []).map((p) => ({
      weekday,
      startTime: p.start_time.slice(0, 5),
      endTime: p.end_time.slice(0, 5),
      isAvailable: p.is_available,
    })),
    existingAppointments: existingRanges,
    blocks: blockRanges,
    slotStepMinutes: 15,
    tz: input.tz,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/booking/public-data.ts
git commit -m "feat(booking): helpers server-side com service role para leitura pública"
```

---

## Task 3: `lib/booking/wizard-state.ts` + testes

**Files:**
- Create: `src/lib/booking/wizard-state.ts`
- Create: `tests/unit/booking/wizard-state.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/booking/wizard-state.test.ts
import { describe, it, expect } from 'vitest'
import { parseWizardState, buildWizardHref } from '@/lib/booking/wizard-state'

describe('parseWizardState', () => {
  it('parseia searchParams completos', () => {
    const state = parseWizardState({
      service: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      professional: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      date: '2026-04-20',
      time: '14:00',
    })
    expect(state.serviceId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(state.professionalId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
    expect(state.date).toBe('2026-04-20')
    expect(state.startTime).toBe('14:00')
  })

  it('retorna nulls quando searchParam ausente', () => {
    const state = parseWizardState({})
    expect(state.serviceId).toBe(null)
    expect(state.professionalId).toBe(null)
    expect(state.date).toBe(null)
    expect(state.startTime).toBe(null)
  })

  it('rejeita uuid inválido', () => {
    const state = parseWizardState({ service: 'not-a-uuid' })
    expect(state.serviceId).toBe(null)
  })

  it('rejeita date inválida', () => {
    const state = parseWizardState({ date: '2026/04/20' })
    expect(state.date).toBe(null)
  })
})

describe('buildWizardHref', () => {
  it('adiciona campos não nulos ao query string', () => {
    const href = buildWizardHref('/book/time', {
      serviceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      professionalId: null,
      date: '2026-04-20',
      startTime: null,
    })
    expect(href).toContain('service=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(href).toContain('date=2026-04-20')
    expect(href).not.toContain('professional=')
    expect(href).not.toContain('time=')
  })
})
```

- [ ] **Step 2: Implementar**

```ts
// src/lib/booking/wizard-state.ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const HHMM_RE = /^\d{2}:\d{2}$/

export type WizardState = {
  serviceId: string | null
  professionalId: string | null
  date: string | null
  startTime: string | null
}

type SearchInput = Record<string, string | string[] | undefined>

function str(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

export function parseWizardState(sp: SearchInput): WizardState {
  const service = str(sp.service)
  const professional = str(sp.professional)
  const date = str(sp.date)
  const time = str(sp.time)

  return {
    serviceId: service && UUID_RE.test(service) ? service : null,
    professionalId: professional && UUID_RE.test(professional) ? professional : null,
    date: date && DATE_RE.test(date) ? date : null,
    startTime: time && HHMM_RE.test(time) ? time : null,
  }
}

export function buildWizardHref(path: string, state: WizardState): string {
  const params = new URLSearchParams()
  if (state.serviceId) params.set('service', state.serviceId)
  if (state.professionalId) params.set('professional', state.professionalId)
  if (state.date) params.set('date', state.date)
  if (state.startTime) params.set('time', state.startTime)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}
```

- [ ] **Step 3: Rodar — passa**

```bash
pnpm test -- tests/unit/booking/wizard-state.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/booking/wizard-state.ts tests/unit/booking/wizard-state.test.ts
git commit -m "feat(booking): wizard state parsing via searchParams"
```

---

## Task 4: Passo 1 — escolha do serviço

**Files:**
- Create: `src/app/(public)/book/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(public)/book/page.tsx
import Link from 'next/link'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { listServices } from '@/lib/booking/public-data'
import { buildWizardHref } from '@/lib/booking/wizard-state'

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function BookServicePage() {
  const tenant = await getCurrentTenantOrNotFound()
  const services = await listServices(tenant.id)

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Escolha o serviço</h1>
        <p className="text-sm opacity-70">Passo 1 de 5</p>
      </header>

      <ul className="space-y-2">
        {services.map((s) => (
          <li key={s.id}>
            <Link
              href={buildWizardHref('/book/professional', {
                serviceId: s.id,
                professionalId: null,
                date: null,
                startTime: null,
              })}
              className="block rounded-lg border p-4 active:opacity-70"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  {s.description ? (
                    <p className="mt-1 text-sm opacity-70">{s.description}</p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-sm font-medium">
                  {brl(s.priceCents)}
                </span>
              </div>
              <p className="mt-2 text-xs opacity-60">{s.durationMinutes} min</p>
            </Link>
          </li>
        ))}
      </ul>

      {services.length === 0 ? (
        <p className="mt-6 text-center text-sm opacity-70">
          Este salão ainda não cadastrou serviços.
        </p>
      ) : null}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/book/page.tsx
git commit -m "feat(public): wizard passo 1 — escolha de serviço"
```

---

## Task 5: Passo 2 — escolha do profissional

**Files:**
- Create: `src/app/(public)/book/professional/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(public)/book/professional/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { listProfessionals } from '@/lib/booking/public-data'
import { parseWizardState, buildWizardHref } from '@/lib/booking/wizard-state'

export default async function BookProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const tenant = await getCurrentTenantOrNotFound()
  const state = parseWizardState(await searchParams)
  if (!state.serviceId) redirect('/book')

  const professionals = await listProfessionals(tenant.id, state.serviceId)

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Escolha o profissional</h1>
        <p className="text-sm opacity-70">Passo 2 de 5</p>
      </header>

      {professionals.length === 0 ? (
        <p className="text-center text-sm opacity-70">
          Nenhum profissional disponível para esse serviço.
        </p>
      ) : (
        <ul className="space-y-2">
          {professionals.map((p) => (
            <li key={p.id}>
              <Link
                href={buildWizardHref('/book/date', {
                  serviceId: state.serviceId,
                  professionalId: p.id,
                  date: null,
                  startTime: null,
                })}
                className="flex items-center gap-3 rounded-lg border p-4 active:opacity-70"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL assinado Supabase; next/image requer remotePatterns configurados
                  <img src={p.photoUrl} alt={p.name} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-muted)] font-bold">
                    {(p.displayName || p.name).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="font-medium">{p.displayName || p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/book/professional/
git commit -m "feat(public): wizard passo 2 — escolha de profissional"
```

---

## Task 6: Passo 3 — escolha de data

**Files:**
- Create: `src/app/(public)/book/date/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(public)/book/date/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { parseWizardState, buildWizardHref } from '@/lib/booking/wizard-state'

function next30Days(): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export default async function BookDatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const state = parseWizardState(await searchParams)
  if (!state.serviceId || !state.professionalId) redirect('/book')

  const days = next30Days()

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Escolha a data</h1>
        <p className="text-sm opacity-70">Passo 3 de 5</p>
      </header>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {days.map((d) => {
          const date = new Date(d + 'T12:00:00')
          const label = date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            weekday: 'short',
          })
          return (
            <li key={d}>
              <Link
                href={buildWizardHref('/book/time', {
                  serviceId: state.serviceId,
                  professionalId: state.professionalId,
                  date: d,
                  startTime: null,
                })}
                className="block rounded-lg border p-3 text-center text-sm active:bg-[var(--color-muted)]"
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/book/date/
git commit -m "feat(public): wizard passo 3 — escolha de data (30 dias)"
```

---

## Task 7: Passo 4 — escolha de horário

**Files:**
- Create: `src/app/(public)/book/time/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(public)/book/time/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { listSlotsForDay } from '@/lib/booking/public-data'
import { parseWizardState, buildWizardHref } from '@/lib/booking/wizard-state'

export default async function BookTimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const tenant = await getCurrentTenantOrNotFound()
  const state = parseWizardState(await searchParams)
  if (!state.serviceId || !state.professionalId || !state.date) redirect('/book')

  const slots = await listSlotsForDay({
    tenantId: tenant.id,
    professionalId: state.professionalId,
    serviceId: state.serviceId,
    date: state.date,
    tz: tenant.timezone,
  })

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Escolha o horário</h1>
        <p className="text-sm opacity-70">Passo 4 de 5</p>
      </header>

      {slots.length === 0 ? (
        <p className="text-center text-sm opacity-70">
          Nenhum horário disponível nesta data. Tente outra.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => (
            <li key={s.startTime}>
              <Link
                href={buildWizardHref('/book/login', {
                  ...state,
                  startTime: s.startTime,
                })}
                className="block rounded-lg border p-3 text-center text-sm active:bg-[var(--color-muted)]"
              >
                {s.startTime}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/book/time/
git commit -m "feat(public): wizard passo 4 — escolha de horário com slots reais"
```

---

## Task 8: Callback de auth + upsert de customer

**Files:**
- Modify: `src/app/auth/callback/route.ts`
- Create: `src/lib/auth/customer.ts`

- [ ] **Step 1: Implementar `customer.ts`**

```ts
// src/lib/auth/customer.ts
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service-role'

/**
 * Garante que existe um customers row para (user_id, tenant_id).
 * Retorna o customer_id.
 */
export async function ensureCustomer(params: {
  userId: string
  tenantId: string
  name: string
  phone: string | null
  email: string | null
}): Promise<string> {
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .maybeSingle()

  if (existing) return existing.id

  const { data: inserted, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      name: params.name,
      phone: params.phone ?? 'Não informado',
      email: params.email ?? null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) throw error
  return inserted.id
}
```

- [ ] **Step 2: Atualizar callback**

```ts
// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureCustomer } from '@/lib/auth/customer'
import { resolveTenantIdBySlug, parseHostToSlug } from '@/lib/tenant/resolve'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  const supabase = await createClient()
  const { data: exchange, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !exchange?.user) {
    return NextResponse.redirect(`${origin}/auth/error`)
  }

  // Se callback veio de subdomínio de tenant, cria customer row.
  const host = request.headers.get('host') ?? ''
  const parsed = parseHostToSlug(host)
  if (parsed.area === 'tenant' && parsed.slug) {
    const tenantId = await resolveTenantIdBySlug(parsed.slug)
    if (tenantId) {
      const user = exchange.user
      const name =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        user.email ??
        'Cliente'
      const phone = (user.user_metadata?.phone as string | undefined) ?? null
      const email = user.email ?? null
      try {
        await ensureCustomer({ userId: user.id, tenantId, name, phone, email })
      } catch (err) {
        console.error('ensureCustomer failed', err)
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/customer.ts src/app/auth/callback/
git commit -m "feat(auth): callback OAuth faz upsert de customer no tenant"
```

---

## Task 9: Passo 5 — login inline

**Files:**
- Create: `src/app/(public)/book/login/page.tsx`
- Create: `src/app/(public)/login/page.tsx`
- Create: `src/app/(public)/book/login/actions.ts`

- [ ] **Step 1: Magic link action**

```ts
// src/app/(public)/book/login/actions.ts
'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email(),
  next: z.string().startsWith('/'),
})

export type MagicLinkState = { error?: string; sent?: boolean }

export async function sendMagicLinkAction(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    next: formData.get('next') ?? '/',
  })
  if (!parsed.success) return { error: 'E-mail inválido' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_ENV === 'development' ? 'http' : 'https'}://__HOST__/auth/callback?next=${encodeURIComponent(parsed.data.next)}`,
    },
  })

  if (error) return { error: error.message }
  return { sent: true }
}
```

**Nota:** `__HOST__` precisa ser substituído pelo host real em runtime. Como server actions rodam no server, use `headers().get('host')` dentro da action para construir a URL:

Refatorar:

```ts
// src/app/(public)/book/login/actions.ts
'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email(),
  next: z.string().startsWith('/'),
})

export type MagicLinkState = { error?: string; sent?: boolean }

export async function sendMagicLinkAction(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    next: formData.get('next') ?? '/',
  })
  if (!parsed.success) return { error: 'E-mail inválido' }

  const h = await headers()
  const host = h.get('host')!
  const proto = process.env.NEXT_PUBLIC_ENV === 'development' ? 'http' : 'https'
  const redirectTo = `${proto}://${host}/auth/callback?next=${encodeURIComponent(parsed.data.next)}`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo },
  })

  if (error) return { error: error.message }
  return { sent: true }
}
```

- [ ] **Step 2: Página de login inline do wizard**

```tsx
// src/app/(public)/book/login/page.tsx
'use client'

import { useActionState } from 'react'
import { redirect, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { sendMagicLinkAction, type MagicLinkState } from './actions'

const INITIAL: MagicLinkState = {}

export default function BookLoginPage() {
  const sp = useSearchParams()
  const nextUrl = `/book/confirm?${sp.toString()}`
  const [state, action, pending] = useActionState(sendMagicLinkAction, INITIAL)

  async function loginWith(provider: 'google' | 'apple') {
    const supabase = createClient()
    const proto = process.env.NEXT_PUBLIC_ENV === 'development' ? 'http' : 'https'
    const host = typeof window !== 'undefined' ? window.location.host : ''
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${proto}://${host}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    })
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Entre para confirmar</h1>
        <p className="text-sm opacity-70">Passo 5 de 5</p>
      </header>

      <div className="space-y-3">
        <button
          onClick={() => loginWith('google')}
          className="h-12 w-full rounded-md border font-medium active:opacity-70"
        >
          Continuar com Google
        </button>
        <button
          onClick={() => loginWith('apple')}
          className="h-12 w-full rounded-md border font-medium active:opacity-70"
        >
          Continuar com Apple
        </button>

        <div className="flex items-center gap-3 py-4">
          <span className="h-px flex-1 bg-[var(--color-border)]" />
          <span className="text-xs opacity-60">ou</span>
          <span className="h-px flex-1 bg-[var(--color-border)]" />
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="next" value={nextUrl} />
          <label className="block">
            <span className="mb-1 block text-sm">Seu e-mail</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full rounded-md border px-3"
            />
          </label>
          {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
          {state.sent ? <p className="text-sm text-green-700">Link enviado! Confira seu e-mail.</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
          >
            {pending ? 'Enviando...' : 'Receber link por e-mail'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Página de login customer standalone (fora do wizard)**

```tsx
// src/app/(public)/login/page.tsx
// Redireciona para o wizard-login se alguém acessar /login no subdomínio público sem contexto
import { redirect } from 'next/navigation'

export default function PublicLoginRoot() {
  redirect('/book/login')
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/book/login/ src/app/\(public\)/login/
git commit -m "feat(public): wizard passo 5 — login inline (Google/Apple/Magic)"
```

---

## Task 10: Passo 6 — confirmação + sucesso

**Files:**
- Create: `src/app/(public)/book/confirm/page.tsx`
- Create: `src/app/(public)/book/confirm/actions.ts`
- Create: `src/app/(public)/book/success/page.tsx`

- [ ] **Step 1: Action de confirmação**

```ts
// src/app/(public)/book/confirm/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { ensureCustomer } from '@/lib/auth/customer'
import {
  createAppointmentForTenant,
  createAppointmentSchema,
} from '@/lib/booking/create-appointment'

const inputSchema = z.object({
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(30),
})

export type ConfirmState = { error?: string }

export async function confirmBookingAction(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const parsed = inputSchema.safeParse({
    serviceId: formData.get('serviceId'),
    professionalId: formData.get('professionalId'),
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    name: formData.get('name'),
    phone: formData.get('phone'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const customerId = await ensureCustomer({
    userId: user.id,
    tenantId: tenant.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    email: user.email ?? null,
  })

  // Atualiza nome/telefone caso o usuário tenha ajustado na tela
  await supabase
    .from('customers')
    .update({ name: parsed.data.name, phone: parsed.data.phone })
    .eq('id', customerId)

  const res = await createAppointmentForTenant(
    tenant.id,
    tenant.timezone,
    createAppointmentSchema.parse({
      customerId,
      professionalId: parsed.data.professionalId,
      serviceId: parsed.data.serviceId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      notes: null,
      bookedBySource: 'PUBLIC_WEB',
    }),
    user.id,
  )

  if (!res.ok) {
    if (res.error === 'SLOT_CONFLICT') {
      return { error: 'Esse horário acabou de ser ocupado. Escolha outro.' }
    }
    return { error: res.message }
  }

  redirect(`/book/success?id=${res.appointmentId}`)
}
```

- [ ] **Step 2: Página de confirmação**

```tsx
// src/app/(public)/book/confirm/page.tsx
import { redirect } from 'next/navigation'
import { parseWizardState } from '@/lib/booking/wizard-state'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { createClient } from '@/lib/supabase/server'
import { ConfirmForm } from './_form'

export default async function BookConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const state = parseWizardState(await searchParams)
  if (!state.serviceId || !state.professionalId || !state.date || !state.startTime) {
    redirect('/book')
  }

  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/book/login?' + new URLSearchParams(await searchParams as never).toString())

  const prefillName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    ''
  const prefillPhone = (user.user_metadata?.phone as string | undefined) ?? ''

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Confirmar agendamento</h1>
      </header>

      <div className="mb-6 rounded-lg border p-4 text-sm">
        <p className="font-medium">{tenant.name}</p>
        <p className="opacity-70">Data: {state.date}</p>
        <p className="opacity-70">Horário: {state.startTime}</p>
      </div>

      <ConfirmForm
        prefillName={prefillName}
        prefillPhone={prefillPhone}
        hidden={{
          serviceId: state.serviceId!,
          professionalId: state.professionalId!,
          date: state.date!,
          startTime: state.startTime!,
        }}
      />
    </main>
  )
}
```

```tsx
// src/app/(public)/book/confirm/_form.tsx
'use client'

import { useActionState } from 'react'
import { confirmBookingAction, type ConfirmState } from './actions'

const INITIAL: ConfirmState = {}

export function ConfirmForm({
  prefillName,
  prefillPhone,
  hidden,
}: {
  prefillName: string
  prefillPhone: string
  hidden: { serviceId: string; professionalId: string; date: string; startTime: string }
}) {
  const [state, action, pending] = useActionState(confirmBookingAction, INITIAL)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="serviceId" value={hidden.serviceId} />
      <input type="hidden" name="professionalId" value={hidden.professionalId} />
      <input type="hidden" name="date" value={hidden.date} />
      <input type="hidden" name="startTime" value={hidden.startTime} />

      <label className="block">
        <span className="mb-1 block text-sm">Seu nome</span>
        <input
          name="name"
          defaultValue={prefillName}
          required
          className="h-11 w-full rounded-md border px-3"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm">Seu telefone</span>
        <input
          name="phone"
          type="tel"
          defaultValue={prefillPhone}
          required
          className="h-11 w-full rounded-md border px-3"
        />
      </label>

      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Confirmando...' : 'Confirmar agendamento'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Página de sucesso**

```tsx
// src/app/(public)/book/success/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function BookSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  let when = ''
  if (id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('appointments')
      .select('start_at')
      .eq('id', id)
      .maybeSingle()
    if (data) {
      const d = new Date(data.start_at)
      when = d.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
          ✓
        </div>
        <h1 className="text-2xl font-bold">Agendamento confirmado</h1>
        {when ? <p className="opacity-70">{when}</p> : null}
        <p className="text-sm opacity-70">
          Você pode ver e gerenciar seus agendamentos em “Meus agendamentos”.
        </p>
        <Link
          href="/my-bookings"
          className="inline-block h-11 rounded-md border px-6 leading-[2.75rem]"
        >
          Ver meus agendamentos
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/book/confirm/ src/app/\(public\)/book/success/
git commit -m "feat(public): confirmação do agendamento + tela de sucesso"
```

---

## Task 11: `/my-bookings`

**Files:**
- Create: `src/app/(public)/my-bookings/page.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/app/(public)/my-bookings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'

export default async function MyBookingsPage() {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/book/login')

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!customer) {
    return (
      <main className="p-6 text-center">
        <p className="opacity-70">Você ainda não agendou neste salão.</p>
      </main>
    )
  }

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, start_at, status, services(name), professionals(name, display_name)')
    .eq('customer_id', customer.id)
    .order('start_at', { ascending: false })

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Meus agendamentos</h1>
      </header>

      <ul className="space-y-2">
        {(appointments ?? []).map((a) => (
          <li key={a.id} className="rounded-lg border p-4">
            <p className="text-sm font-semibold">
              {new Date(a.start_at).toLocaleString('pt-BR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            <p className="text-sm opacity-70">
              {a.services?.name} com {a.professionals?.display_name || a.professionals?.name}
            </p>
            <p className="mt-1 text-xs opacity-60">Status: {a.status}</p>
          </li>
        ))}
      </ul>

      {(appointments ?? []).length === 0 ? (
        <p className="mt-8 text-center text-sm opacity-70">Nenhum agendamento ainda.</p>
      ) : null}
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/my-bookings/
git commit -m "feat(public): tela meus agendamentos por tenant"
```

---

## Task 12: E2E — wizard completo (simulando login)

**Files:**
- Create: `e2e/public-booking.spec.ts`

- [ ] **Step 1: E2E básico**

```ts
// e2e/public-booking.spec.ts
import { test, expect } from '@playwright/test'

test('wizard flui até passo de login', async ({ page, baseURL }) => {
  const url = baseURL!.replace('localhost', 'barbearia-teste.lvh.me')

  // Pré-requisito: seed do Épico 3 precisa incluir pelo menos 1 serviço, 1 professional e 1 link professional_services.
  // Caso ainda não esteja seed, ajustar seed.sql ou skip este teste.
  test.skip(!process.env.SEED_PUBLIC_TENANT, 'requer seed de tenant público')

  await page.goto(`${url}/book`)
  await expect(page.getByRole('heading', { name: /escolha o serviço/i })).toBeVisible()

  await page.locator('a').first().click()
  await expect(page.getByRole('heading', { name: /escolha o profissional/i })).toBeVisible()

  await page.locator('a').first().click()
  await expect(page.getByRole('heading', { name: /escolha a data/i })).toBeVisible()

  await page.locator('a').first().click()
  await expect(page.getByRole('heading', { name: /escolha o horário/i })).toBeVisible()
})
```

- [ ] **Step 2: Commit**

```bash
git add e2e/public-booking.spec.ts
git commit -m "test(e2e): wizard público até passo de horário"
```

---

## Task 13: Sanity check

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm build
```

---

## Critério de aceitação do épico 5

- ✅ Funções SQL helper `list_tenant_public_services` e `list_tenant_public_professionals` com `security definer` + grant só para `service_role`.
- ✅ `public-data.ts` agrega dados de `business_hours`, `professional_availability`, `appointments` e `blocks` para calcular slots em runtime.
- ✅ `wizard-state.ts` valida searchParams (UUIDs, date, time) e gera hrefs corretos.
- ✅ 6 páginas do wizard (book → professional → date → time → login → confirm → success) todas renderizam.
- ✅ Login inline com Google, Apple, Magic Link funcional.
- ✅ Callback cria `customers` row para `(user_id, tenantId)` automaticamente.
- ✅ Confirmação cria `appointment` com `booked_by_source = PUBLIC_WEB` e detecta conflito de slot (mensagem amigável).
- ✅ `/my-bookings` lista appointments do customer logado.
- ✅ Slots consumidos ao criar — próxima tentativa no mesmo horário bloqueia via exclusion constraint.
- ✅ E2E pela rota do wizard funciona com seed.

**Output:** fluxo completo de auto-agendamento pelo cliente final via PWA mobile. Próximo épico cobre transições de status operacional do salão (check-in, start, complete, cancel, no-show).
