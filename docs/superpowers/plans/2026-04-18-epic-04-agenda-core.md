# Épico 4 — Agenda Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar a entidade `appointments`, o cálculo de slots livres (`availability.ts`), a criação manual de agendamento pelo salão e as duas views de agenda (lista mobile + colunas tablet landscape).

**Architecture:** Migration de `appointments` com enums `appointment_status` e `payment_status` + `booking_source`. Função pura `availableSlots()` em TS que intersecta business hours × professional availability × appointments existentes × availability blocks, retornando slots de 15 em 15 minutos. Server actions `createAppointmentManual()` com validação de conflito. Views de agenda (server components) consumindo com filtros por data e profissional.

**Tech Stack:** Postgres (appointments + enum types), `date-fns` + `date-fns-tz` para timezone, Next.js server components, Server Actions, Zod.

**Referência:** Spec — Seções 6.2 (entidade appointments), 10.4 (agendamento manual), 10.5 (operação), 12.2 (breakpoints).

**Dependências:** Épicos 0–3.

---

## File Structure

```
ara-barber/
├── supabase/
│   └── migrations/
│       └── 0016_appointments.sql
├── src/
│   ├── lib/
│   │   └── booking/
│   │       ├── availability.ts
│   │       ├── status-machine.ts
│   │       ├── create-appointment.ts
│   │       └── time.ts
│   └── app/
│       └── (salon)/
│           └── dashboard/
│               ├── agenda/
│               │   ├── page.tsx
│               │   ├── actions.ts
│               │   ├── _day-list.tsx          # mobile layout
│               │   ├── _columns-board.tsx     # tablet landscape
│               │   └── _new-appointment.tsx
│               └── page.tsx                    # home: agenda do dia (reusa agenda/)
└── tests/
    └── unit/
        └── booking/
            ├── availability.test.ts
            ├── status-machine.test.ts
            └── time.test.ts
```

---

## Task 1: Migration — `appointments`

**Files:**
- Create: `supabase/migrations/0016_appointments.sql`

- [ ] **Step 1: Criar e preencher**

```bash
supabase migration new appointments
```

```sql
-- supabase/migrations/0016_appointments.sql

create type public.appointment_status as enum (
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_SERVICE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'EXPIRED'
);

create type public.payment_status as enum (
  'UNPAID',
  'PENDING',
  'PAID_PARTIAL',
  'PAID_FULL',
  'REFUNDED',
  'CHARGEBACK',
  'FAILED',
  'EXPIRED'
);

create type public.booking_source as enum (
  'PUBLIC_WEB',
  'SALON_MANUAL',
  'IMPORT'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,

  appointment_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,

  status public.appointment_status not null default 'CONFIRMED',
  payment_status public.payment_status not null default 'UNPAID',

  deposit_required boolean not null default false,
  deposit_amount_cents integer,
  total_amount_cents integer not null check (total_amount_cents >= 0),

  notes text,
  booked_by_source public.booking_source not null,
  created_by_user_id uuid references auth.users(id) on delete set null,

  checked_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointments_time_order check (start_at < end_at)
);

create index appointments_tenant_date_idx on public.appointments (tenant_id, appointment_date);
create index appointments_professional_date_idx on public.appointments (professional_id, appointment_date);
create index appointments_customer_idx on public.appointments (customer_id);
create index appointments_tenant_status_idx on public.appointments (tenant_id, status);

-- Impede sobreposição de horário para o mesmo profissional em estados ativos
create extension if not exists btree_gist;

alter table public.appointments add column timerange tstzrange
  generated always as (tstzrange(start_at, end_at, '[)')) stored;

create index appointments_timerange_idx on public.appointments using gist (professional_id, timerange);

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    timerange with &&
  )
  where (status in ('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'));

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();

alter table public.appointments enable row level security;

-- Platform admin
create policy "appointments_platform_admin_all" on public.appointments
  for all using (auth.is_platform_admin()) with check (auth.is_platform_admin());

-- Staff do tenant (any)
create policy "appointments_tenant_staff_all" on public.appointments
  for all using (tenant_id = auth.current_tenant_id()) with check (tenant_id = auth.current_tenant_id());

-- Customer vê próprios appointments
create policy "appointments_customer_own_read" on public.appointments
  for select using (
    customer_id in (select id from public.customers where user_id = auth.uid())
  );

-- Customer cria próprio appointment (booking público)
create policy "appointments_customer_own_insert" on public.appointments
  for insert with check (
    customer_id in (select id from public.customers where user_id = auth.uid())
    and booked_by_source = 'PUBLIC_WEB'
  );
```

- [ ] **Step 2: Aplicar e regenerar tipos**

```bash
supabase db reset
pnpm db:types
```

Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0016_appointments.sql src/lib/supabase/types.ts
git commit -m "feat(db): migration 0016 — appointments com exclusion constraint"
```

---

## Task 2: `lib/booking/time.ts` + testes

**Files:**
- Create: `src/lib/booking/time.ts`
- Create: `tests/unit/booking/time.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/booking/time.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseHHMM,
  minutesBetween,
  combineDateAndTime,
  weekdayOf,
  isoDateStr,
} from '@/lib/booking/time'

describe('parseHHMM', () => {
  it('converte HH:MM em minutos desde meia-noite', () => {
    expect(parseHHMM('00:00')).toBe(0)
    expect(parseHHMM('09:30')).toBe(9 * 60 + 30)
    expect(parseHHMM('23:59')).toBe(23 * 60 + 59)
  })
})

describe('minutesBetween', () => {
  it('retorna diferença em minutos entre duas strings HH:MM', () => {
    expect(minutesBetween('09:00', '10:00')).toBe(60)
    expect(minutesBetween('09:00', '09:30')).toBe(30)
  })
})

describe('weekdayOf', () => {
  it('retorna 0 para domingo', () => {
    // 2026-04-19 é domingo
    expect(weekdayOf('2026-04-19', 'America/Sao_Paulo')).toBe(0)
  })

  it('retorna 6 para sábado', () => {
    // 2026-04-18 é sábado
    expect(weekdayOf('2026-04-18', 'America/Sao_Paulo')).toBe(6)
  })
})

describe('isoDateStr', () => {
  it('formata data no timezone do tenant', () => {
    const d = new Date('2026-04-18T23:00:00-03:00')
    expect(isoDateStr(d, 'America/Sao_Paulo')).toBe('2026-04-18')
  })
})

describe('combineDateAndTime', () => {
  it('combina YYYY-MM-DD + HH:MM no timezone dado', () => {
    const d = combineDateAndTime('2026-04-18', '14:30', 'America/Sao_Paulo')
    expect(d.toISOString()).toBe('2026-04-18T17:30:00.000Z')
  })
})
```

- [ ] **Step 2: Rodar — falha**

```bash
pnpm test -- tests/unit/booking/time.test.ts
```

- [ ] **Step 3: Implementar**

```ts
// src/lib/booking/time.ts
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function minutesBetween(start: string, end: string): number {
  return parseHHMM(end) - parseHHMM(start)
}

export function weekdayOf(isoDate: string, tz: string): number {
  // Força interpretação do ISO date no timezone do tenant
  const local = fromZonedTime(`${isoDate}T12:00:00`, tz)
  return Number(formatInTimeZone(local, tz, 'i')) % 7
  // ISO 'i' retorna 1 (seg) a 7 (dom); mapeamos para 0..6 onde 0 = domingo
}

export function isoDateStr(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd')
}

export function combineDateAndTime(
  isoDate: string,
  hhmm: string,
  tz: string,
): Date {
  return fromZonedTime(`${isoDate}T${hhmm}:00`, tz)
}
```

**Nota:** `weekdayOf` precisa retornar 0 pra domingo. `formatInTimeZone(d, tz, 'i')` retorna 1 (seg) a 7 (dom) — o código acima faz `% 7` para mapear 7→0. Ajustar via testes se retornar valor inesperado.

- [ ] **Step 4: Rodar — passa**

```bash
pnpm test -- tests/unit/booking/time.test.ts
```

Expected: PASS. Se um teste falhar por timezone, ajustar a conversão `weekdayOf`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking/time.ts tests/unit/booking/time.test.ts
git commit -m "feat(booking): helpers de time com timezone-aware"
```

---

## Task 3: `lib/booking/availability.ts` + teste

**Files:**
- Create: `src/lib/booking/availability.ts`
- Create: `tests/unit/booking/availability.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/booking/availability.test.ts
import { describe, it, expect } from 'vitest'
import { computeAvailableSlots } from '@/lib/booking/availability'

describe('computeAvailableSlots', () => {
  it('gera slots de 15 em 15 minutos dentro de business hours', () => {
    const slots = computeAvailableSlots({
      date: '2026-04-20', // segunda-feira
      serviceDurationMinutes: 30,
      businessHours: { weekday: 1, startTime: '09:00', endTime: '11:00', isOpen: true },
      professionalAvailability: [
        { weekday: 1, startTime: '09:00', endTime: '11:00', isAvailable: true },
      ],
      existingAppointments: [],
      blocks: [],
      slotStepMinutes: 15,
      tz: 'America/Sao_Paulo',
    })
    // De 09:00 até 10:30 (últimos slots cabem 30min antes de 11:00)
    // 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30 = 7 slots
    expect(slots).toHaveLength(7)
    expect(slots[0].startTime).toBe('09:00')
    expect(slots[slots.length - 1].startTime).toBe('10:30')
  })

  it('não gera slots fora de professional availability', () => {
    const slots = computeAvailableSlots({
      date: '2026-04-20',
      serviceDurationMinutes: 30,
      businessHours: { weekday: 1, startTime: '09:00', endTime: '18:00', isOpen: true },
      professionalAvailability: [
        { weekday: 1, startTime: '14:00', endTime: '16:00', isAvailable: true },
      ],
      existingAppointments: [],
      blocks: [],
      slotStepMinutes: 15,
      tz: 'America/Sao_Paulo',
    })
    expect(slots.every((s) => s.startTime >= '14:00' && s.startTime <= '15:30')).toBe(true)
  })

  it('exclui slots que colidem com appointment existente', () => {
    const slots = computeAvailableSlots({
      date: '2026-04-20',
      serviceDurationMinutes: 30,
      businessHours: { weekday: 1, startTime: '09:00', endTime: '11:00', isOpen: true },
      professionalAvailability: [
        { weekday: 1, startTime: '09:00', endTime: '11:00', isAvailable: true },
      ],
      existingAppointments: [
        { startTime: '09:30', endTime: '10:00' },
      ],
      blocks: [],
      slotStepMinutes: 15,
      tz: 'America/Sao_Paulo',
    })
    // 09:00 e 09:15 colidem com 09:30-10:00? 09:00-09:30 não colide (< 09:30)
    // 09:15-09:45 colide.
    expect(slots.find((s) => s.startTime === '09:00')).toBeTruthy()
    expect(slots.find((s) => s.startTime === '09:15')).toBeFalsy()
    expect(slots.find((s) => s.startTime === '09:30')).toBeFalsy()
    expect(slots.find((s) => s.startTime === '10:00')).toBeTruthy()
  })

  it('retorna [] quando salão está fechado nesse dia', () => {
    const slots = computeAvailableSlots({
      date: '2026-04-20',
      serviceDurationMinutes: 30,
      businessHours: { weekday: 1, startTime: '09:00', endTime: '18:00', isOpen: false },
      professionalAvailability: [
        { weekday: 1, startTime: '09:00', endTime: '18:00', isAvailable: true },
      ],
      existingAppointments: [],
      blocks: [],
      slotStepMinutes: 15,
      tz: 'America/Sao_Paulo',
    })
    expect(slots).toEqual([])
  })

  it('exclui slots que colidem com availability blocks', () => {
    const slots = computeAvailableSlots({
      date: '2026-04-20',
      serviceDurationMinutes: 30,
      businessHours: { weekday: 1, startTime: '09:00', endTime: '11:00', isOpen: true },
      professionalAvailability: [
        { weekday: 1, startTime: '09:00', endTime: '11:00', isAvailable: true },
      ],
      existingAppointments: [],
      blocks: [{ startTime: '10:00', endTime: '10:30' }],
      slotStepMinutes: 15,
      tz: 'America/Sao_Paulo',
    })
    expect(slots.find((s) => s.startTime === '09:30')).toBeTruthy()
    expect(slots.find((s) => s.startTime === '10:00')).toBeFalsy()
    expect(slots.find((s) => s.startTime === '10:30')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar — falha**

```bash
pnpm test -- tests/unit/booking/availability.test.ts
```

- [ ] **Step 3: Implementar**

```ts
// src/lib/booking/availability.ts
import { parseHHMM } from './time'

type TimeRange = { startTime: string; endTime: string }

export type ComputeSlotsInput = {
  date: string // YYYY-MM-DD
  serviceDurationMinutes: number
  businessHours: { weekday: number; startTime: string; endTime: string; isOpen: boolean }
  professionalAvailability: Array<{ weekday: number; startTime: string; endTime: string; isAvailable: boolean }>
  existingAppointments: TimeRange[]
  blocks: TimeRange[]
  slotStepMinutes: number
  tz: string
}

export type Slot = { startTime: string; endTime: string }

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60).toString().padStart(2, '0')
  const m = (total % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function collides(a: TimeRange, b: TimeRange): boolean {
  const as = parseHHMM(a.startTime), ae = parseHHMM(a.endTime)
  const bs = parseHHMM(b.startTime), be = parseHHMM(b.endTime)
  return as < be && bs < ae
}

export function computeAvailableSlots(input: ComputeSlotsInput): Slot[] {
  if (!input.businessHours.isOpen) return []

  const bhStart = parseHHMM(input.businessHours.startTime)
  const bhEnd = parseHHMM(input.businessHours.endTime)

  const profRanges = input.professionalAvailability
    .filter((pa) => pa.isAvailable)
    .map((pa) => ({ start: parseHHMM(pa.startTime), end: parseHHMM(pa.endTime) }))

  if (profRanges.length === 0) return []

  const duration = input.serviceDurationMinutes
  const step = input.slotStepMinutes
  const slots: Slot[] = []

  for (let minute = bhStart; minute + duration <= bhEnd; minute += step) {
    const slotEnd = minute + duration

    // Deve estar contido em alguma prof range
    const inProf = profRanges.some((r) => r.start <= minute && slotEnd <= r.end)
    if (!inProf) continue

    const slot: Slot = {
      startTime: formatMinutes(minute),
      endTime: formatMinutes(slotEnd),
    }

    const conflictsAppt = input.existingAppointments.some((a) => collides(slot, a))
    if (conflictsAppt) continue

    const conflictsBlock = input.blocks.some((b) => collides(slot, b))
    if (conflictsBlock) continue

    slots.push(slot)
  }

  return slots
}
```

- [ ] **Step 4: Rodar — passa**

```bash
pnpm test -- tests/unit/booking/availability.test.ts
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking/availability.ts tests/unit/booking/availability.test.ts
git commit -m "feat(booking): computeAvailableSlots com colisão de appts e blocks"
```

---

## Task 4: `lib/booking/status-machine.ts` + teste

**Files:**
- Create: `src/lib/booking/status-machine.ts`
- Create: `tests/unit/booking/status-machine.test.ts`

- [ ] **Step 1: Escrever teste**

```ts
// tests/unit/booking/status-machine.test.ts
import { describe, it, expect } from 'vitest'
import { canTransitionTo, nextStatuses, type AppointmentStatus } from '@/lib/booking/status-machine'

describe('status-machine', () => {
  it('CONFIRMED permite CHECKED_IN, CANCELLED', () => {
    expect(canTransitionTo('CONFIRMED', 'CHECKED_IN')).toBe(true)
    expect(canTransitionTo('CONFIRMED', 'CANCELLED')).toBe(true)
    expect(canTransitionTo('CONFIRMED', 'COMPLETED')).toBe(false)
  })

  it('CHECKED_IN permite IN_SERVICE, NO_SHOW, CANCELLED', () => {
    expect(canTransitionTo('CHECKED_IN', 'IN_SERVICE')).toBe(true)
    expect(canTransitionTo('CHECKED_IN', 'NO_SHOW')).toBe(true)
    expect(canTransitionTo('CHECKED_IN', 'CANCELLED')).toBe(true)
    expect(canTransitionTo('CHECKED_IN', 'CONFIRMED')).toBe(false)
  })

  it('IN_SERVICE permite COMPLETED', () => {
    expect(canTransitionTo('IN_SERVICE', 'COMPLETED')).toBe(true)
    expect(canTransitionTo('IN_SERVICE', 'CANCELLED')).toBe(false)
  })

  it('COMPLETED, CANCELLED, NO_SHOW, EXPIRED são terminais', () => {
    const terminal: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED']
    for (const t of terminal) {
      expect(nextStatuses(t)).toEqual([])
    }
  })

  it('nextStatuses lista transições válidas', () => {
    expect(nextStatuses('CONFIRMED')).toContain('CHECKED_IN')
    expect(nextStatuses('CONFIRMED')).toContain('CANCELLED')
  })
})
```

- [ ] **Step 2: Implementar**

```ts
// src/lib/booking/status-machine.ts
export type AppointmentStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'EXPIRED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['IN_SERVICE', 'NO_SHOW', 'CANCELLED'],
  IN_SERVICE: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
}

export function nextStatuses(current: AppointmentStatus): AppointmentStatus[] {
  return TRANSITIONS[current]
}

export function canTransitionTo(
  current: AppointmentStatus,
  target: AppointmentStatus,
): boolean {
  return TRANSITIONS[current].includes(target)
}
```

- [ ] **Step 3: Rodar — passa**

```bash
pnpm test -- tests/unit/booking/status-machine.test.ts
```

Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/booking/status-machine.ts tests/unit/booking/status-machine.test.ts
git commit -m "feat(booking): status machine de appointment"
```

---

## Task 5: `lib/booking/create-appointment.ts`

**Files:**
- Create: `src/lib/booking/create-appointment.ts`

- [ ] **Step 1: Implementar**

```ts
// src/lib/booking/create-appointment.ts
import 'server-only'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { combineDateAndTime } from './time'

export const createAppointmentSchema = z.object({
  customerId: z.string().uuid(),
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(1000).nullish(),
  bookedBySource: z.enum(['PUBLIC_WEB', 'SALON_MANUAL']),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: 'SERVICE_NOT_FOUND' | 'SLOT_CONFLICT' | 'DB_ERROR'; message: string }

export async function createAppointmentForTenant(
  tenantId: string,
  tz: string,
  input: CreateAppointmentInput,
  createdByUserId: string | null,
): Promise<CreateAppointmentResult> {
  const supabase = await createClient()

  const { data: service } = await supabase
    .from('services')
    .select('id, duration_minutes, price_cents, deposit_required')
    .eq('id', input.serviceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!service) return { ok: false, error: 'SERVICE_NOT_FOUND', message: 'Serviço não encontrado' }

  const startAt = combineDateAndTime(input.date, input.startTime, tz)
  const endAt = new Date(startAt.getTime() + service.duration_minutes * 60_000)

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      customer_id: input.customerId,
      professional_id: input.professionalId,
      service_id: input.serviceId,
      appointment_date: input.date,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'CONFIRMED',
      payment_status: 'UNPAID',
      deposit_required: service.deposit_required,
      deposit_amount_cents: null,
      total_amount_cents: service.price_cents,
      notes: input.notes ?? null,
      booked_by_source: input.bookedBySource,
      created_by_user_id: createdByUserId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23P01') {
      // exclusion constraint violation — slot conflitou
      return { ok: false, error: 'SLOT_CONFLICT', message: 'Horário não está mais disponível' }
    }
    return { ok: false, error: 'DB_ERROR', message: error.message }
  }

  return { ok: true, appointmentId: data.id }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add src/lib/booking/create-appointment.ts
git commit -m "feat(booking): createAppointmentForTenant com detecção de conflito"
```

---

## Task 6: Server action de criação manual

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/actions.ts`

- [ ] **Step 1: Implementar**

```ts
// src/app/(salon)/dashboard/agenda/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { assertStaff } from '@/lib/auth/guards'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import {
  createAppointmentForTenant,
  createAppointmentSchema,
} from '@/lib/booking/create-appointment'

export type CreateApptState = { error?: string; appointmentId?: string }

export async function createManualAppointmentAction(
  _prev: CreateApptState,
  formData: FormData,
): Promise<CreateApptState> {
  const user = await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()

  const parsed = createAppointmentSchema.safeParse({
    customerId: formData.get('customerId'),
    professionalId: formData.get('professionalId'),
    serviceId: formData.get('serviceId'),
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    notes: formData.get('notes') || null,
    bookedBySource: 'SALON_MANUAL',
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const result = await createAppointmentForTenant(
    tenant.id,
    tenant.timezone,
    parsed.data,
    user.id,
  )

  if (!result.ok) return { error: result.message }

  revalidatePath('/dashboard/agenda')
  return { appointmentId: result.appointmentId }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/actions.ts
git commit -m "feat(agenda): server action createManualAppointment"
```

---

## Task 7: Tela de agenda — view lista (mobile)

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/page.tsx`
- Create: `src/app/(salon)/dashboard/agenda/_day-list.tsx`
- Create: `src/app/(salon)/dashboard/agenda/_columns-board.tsx`

- [ ] **Step 1: Page — carrega dados e passa para duas views responsivas**

```tsx
// src/app/(salon)/dashboard/agenda/page.tsx
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { DayList } from './_day-list'
import { ColumnsBoard } from './_columns-board'

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await assertStaff()
  const tenant = await getCurrentTenantOrNotFound()
  const params = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const date = params.date ?? today

  const supabase = await createClient()
  const [{ data: appointments }, { data: professionals }] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, start_at, end_at, status, professional_id, customer_id, service_id, notes, ' +
          'customers(name, phone), professionals(name, display_name), services(name, duration_minutes, price_cents)',
      )
      .eq('tenant_id', tenant.id)
      .eq('appointment_date', date)
      .order('start_at'),
    supabase.from('professionals').select('id, name, display_name').eq('is_active', true),
  ])

  return (
    <main className="p-4 pb-20">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agenda</h1>
          <p className="text-sm opacity-70">
            {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' })}
          </p>
        </div>
      </header>

      <form className="mb-4">
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="h-11 w-full rounded-md border px-3 lg:w-auto"
        />
      </form>

      {/* Mobile: lista vertical */}
      <div className="lg:hidden">
        <DayList appointments={appointments ?? []} />
      </div>

      {/* Tablet landscape + desktop: colunas por profissional */}
      <div className="hidden lg:block">
        <ColumnsBoard
          appointments={appointments ?? []}
          professionals={professionals ?? []}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: `_day-list.tsx` (mobile)**

```tsx
// src/app/(salon)/dashboard/agenda/_day-list.tsx
type Appointment = {
  id: string
  start_at: string
  end_at: string
  status: string
  customers: { name: string; phone: string } | null
  professionals: { name: string; display_name: string | null } | null
  services: { name: string } | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  CHECKED_IN: 'Chegou',
  IN_SERVICE: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

export function DayList({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return (
      <p className="mt-6 text-center text-sm opacity-70">Nenhum agendamento hoje.</p>
    )
  }

  return (
    <ul className="space-y-2">
      {appointments.map((a) => (
        <li key={a.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {formatTime(a.start_at)}–{formatTime(a.end_at)}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
              {STATUS_LABEL[a.status] ?? a.status}
            </span>
          </div>
          <p className="mt-1 font-medium">{a.customers?.name ?? '—'}</p>
          <p className="text-xs opacity-70">
            {a.services?.name ?? '—'} · {a.professionals?.display_name || a.professionals?.name}
          </p>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: `_columns-board.tsx` (tablet landscape)**

```tsx
// src/app/(salon)/dashboard/agenda/_columns-board.tsx
type Appointment = {
  id: string
  start_at: string
  end_at: string
  status: string
  professional_id: string
  customers: { name: string } | null
  services: { name: string } | null
}

type Professional = { id: string; name: string; display_name: string | null }

const HOUR_START = 8 // 08:00
const HOUR_END = 21 // 21:00
const PIXELS_PER_MINUTE = 1

function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

export function ColumnsBoard({
  appointments,
  professionals,
}: {
  appointments: Appointment[]
  professionals: Professional[]
}) {
  if (professionals.length === 0) {
    return <p className="text-sm opacity-70">Nenhum profissional cadastrado.</p>
  }

  const heightPx = (HOUR_END - HOUR_START) * 60 * PIXELS_PER_MINUTE

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2" style={{ minHeight: heightPx + 40 }}>
        {/* Coluna de horas */}
        <div className="flex-shrink-0 w-12 text-xs">
          <div className="h-10" />
          {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
            <div
              key={i}
              className="border-t pt-1 text-right pr-1 opacity-60"
              style={{ height: 60 * PIXELS_PER_MINUTE }}
            >
              {(HOUR_START + i).toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {professionals.map((p) => (
          <div key={p.id} className="relative flex-1 min-w-[180px] rounded-lg border">
            <header className="sticky top-0 h-10 border-b bg-[var(--color-muted)] px-3 py-2 text-sm font-medium">
              {p.display_name || p.name}
            </header>
            <div className="relative" style={{ height: heightPx }}>
              {appointments
                .filter((a) => a.professional_id === p.id)
                .map((a) => {
                  const top = (minutesSinceMidnight(a.start_at) - HOUR_START * 60) * PIXELS_PER_MINUTE
                  const height = ((minutesSinceMidnight(a.end_at) - minutesSinceMidnight(a.start_at))) * PIXELS_PER_MINUTE
                  return (
                    <div
                      key={a.id}
                      className="absolute left-1 right-1 overflow-hidden rounded-md bg-[var(--color-primary)] px-2 py-1 text-xs text-[var(--color-primary-fg)]"
                      style={{ top, height }}
                    >
                      <p className="truncate font-medium">{a.customers?.name ?? '—'}</p>
                      <p className="truncate opacity-90">{a.services?.name ?? '—'}</p>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/
git commit -m "feat(agenda): page + views mobile (lista) e tablet (colunas)"
```

---

## Task 8: Dashboard home = agenda do dia

**Files:**
- Modify: `src/app/(salon)/dashboard/page.tsx`

- [ ] **Step 1: Redirecionar/renderizar agenda do dia como home**

```tsx
// src/app/(salon)/dashboard/page.tsx
import { redirect } from 'next/navigation'

export default function DashboardHomePage() {
  redirect('/dashboard/agenda')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(salon\)/dashboard/page.tsx
git commit -m "feat(salon): dashboard home redireciona para /agenda"
```

---

## Task 9: Teste pgTAP — overlap constraint

**Files:**
- Modify: `supabase/tests/rls_cadastros.test.sql` (ou novo `rls_appointments.test.sql`)

- [ ] **Step 1: Adicionar teste**

```sql
-- supabase/tests/rls_appointments.test.sql
begin;
select plan(3);

insert into public.tenants (id, slug, name, subdomain) values
  ('11111111-1111-1111-1111-111111111111', 'tenant-a', 'Tenant A', 'tenant-a')
on conflict (id) do nothing;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@a.com')
on conflict (id) do nothing;

insert into public.user_profiles (user_id, role, tenant_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SALON_OWNER', '11111111-1111-1111-1111-111111111111', 'Owner A')
on conflict (user_id) do nothing;

insert into public.professionals (id, tenant_id, name) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Prof A')
on conflict (id) do nothing;

insert into public.services (id, tenant_id, name, duration_minutes, price_cents) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Corte', 30, 4500)
on conflict (id) do nothing;

insert into public.customers (id, tenant_id, name, phone) values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Cliente X', '11999999999')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Insert válido
insert into public.appointments (
  tenant_id, customer_id, professional_id, service_id,
  appointment_date, start_at, end_at, total_amount_cents, booked_by_source
) values (
  '11111111-1111-1111-1111-111111111111',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '2026-04-20', '2026-04-20 14:00-03', '2026-04-20 14:30-03', 4500, 'SALON_MANUAL'
);

select results_eq(
  'select count(*)::int from public.appointments',
  array[1],
  'Primeiro appointment criado'
);

-- Tentativa de overlap — deve falhar
select throws_ok(
  $$insert into public.appointments (
    tenant_id, customer_id, professional_id, service_id,
    appointment_date, start_at, end_at, total_amount_cents, booked_by_source
  ) values (
    '11111111-1111-1111-1111-111111111111',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '2026-04-20', '2026-04-20 14:15-03', '2026-04-20 14:45-03', 4500, 'SALON_MANUAL'
  )$$,
  'conflicting key value violates exclusion constraint',
  'Overlap em CONFIRMED é bloqueado'
);

-- Overlap com appointment CANCELLED deve permitir
update public.appointments set status = 'CANCELLED', cancelled_at = now();

insert into public.appointments (
  tenant_id, customer_id, professional_id, service_id,
  appointment_date, start_at, end_at, total_amount_cents, booked_by_source
) values (
  '11111111-1111-1111-1111-111111111111',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '2026-04-20', '2026-04-20 14:15-03', '2026-04-20 14:45-03', 4500, 'SALON_MANUAL'
);

select results_eq(
  $$select count(*)::int from public.appointments where status != 'CANCELLED'$$,
  array[1],
  'Overlap permitido quando original está CANCELLED'
);

select finish();
rollback;
```

- [ ] **Step 2: Rodar**

```bash
supabase db test
```

Expected: todos os pgTAP passam (cadastros + appointments).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_appointments.test.sql
git commit -m "test(db): pgTAP exclusion constraint de appointments"
```

---

## Task 10: Sanity check final

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm build
```

---

## Critério de aceitação do épico 4

- ✅ Migration 0016 com `appointments`, enum de status, exclusion constraint anti-overlap via `btree_gist`, 4 policies RLS.
- ✅ `time.ts` (parseHHMM, weekdayOf, combineDateAndTime) testado.
- ✅ `availability.ts` (computeAvailableSlots) testado com 5 cenários (básico, prof availability, overlap appt, fechado, blocks).
- ✅ `status-machine.ts` testado com 5 cenários de transição.
- ✅ `create-appointment.ts` com detecção de conflito via código 23P01.
- ✅ Server action `createManualAppointment` no dashboard.
- ✅ Page `/dashboard/agenda` com `<DayList>` (mobile) e `<ColumnsBoard>` (tablet landscape) baseado em breakpoint `lg:`.
- ✅ Dashboard home redireciona para `/agenda`.
- ✅ pgTAP testa overlap constraint (insert overlap bloqueado em CONFIRMED, permitido com CANCELLED).

**Output:** salão pode visualizar e criar agendamentos manualmente. Status transitions, booking público e UI do wizard vêm nos próximos épicos.
