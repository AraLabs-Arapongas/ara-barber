# Épico 6 — Status Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar as transições de status de agendamento (check-in, iniciar, finalizar, cancelar pelo salão, no-show, cancelar pelo customer), bloqueio de horário por profissional/owner, e reagendamento (cancel + criar novo).

**Architecture:** Server actions em `app/(salon)/dashboard/agenda/*` consomem `canTransitionTo()` do `status-machine.ts` e gravam timestamps (`checked_in_at`, `started_at`, etc). Cada ação valida role do usuário (`SALON_OWNER`/`RECEPTIONIST` livres; `PROFESSIONAL` só os próprios). Cancelamento pelo customer fica em `app/(public)/my-bookings/`. Tabela `availability_blocks` ganha UI no dashboard.

**Tech Stack:** Next.js 16 Server Actions, Zod, Postgres triggers opcionais.

**Referência:** Spec — Seções 10.5 (operação do dia), 10.6 (cancelamento), 10.8 (bloqueio).

**Dependências:** Épicos 0–5.

---

## File Structure

```
ara-barber/
├── src/
│   └── app/
│       ├── (salon)/dashboard/agenda/
│       │   ├── _appointment-card.tsx              # Task 2 — card com botões
│       │   ├── [id]/
│       │   │   ├── page.tsx                      # Task 3 — detalhe
│       │   │   ├── actions.ts                    # Task 1 — todas transitions
│       │   │   └── _cancel-dialog.tsx
│       │   └── bloqueios/
│       │       ├── page.tsx                      # Task 5
│       │       └── actions.ts                    # Task 5
│       └── (public)/my-bookings/
│           ├── _cancel-button.tsx                # Task 4
│           └── actions.ts                        # Task 4
└── supabase/tests/
    └── rls_appointments_transitions.test.sql   # Task 6
```

---

## Task 1: Server actions — todas transitions

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/[id]/actions.ts`

- [ ] **Step 1: Implementar**

```ts
// src/app/(salon)/dashboard/agenda/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { canTransitionTo, type AppointmentStatus } from '@/lib/booking/status-machine'
import { isStaffRole } from '@/lib/auth/roles'

export type TransitionState = { error?: string; success?: boolean }

async function fetchAppointmentOrFail(id: string, tenantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status, professional_id, customer_id, tenant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

function canActOn(
  userRole: ReturnType<typeof String> | 'SALON_OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL',
  appointmentProfessionalId: string,
  userId: string | null,
): boolean {
  // OWNER e RECEPTIONIST atuam em qualquer appointment do tenant.
  if (userRole === 'SALON_OWNER' || userRole === 'RECEPTIONIST') return true
  // PROFESSIONAL apenas nos appointments em que é o profissional responsável.
  // Convenção: professionals.user_id == auth.uid() → professional_id pode ser resolvido via lookup.
  // Para simplicidade, o caller já verificou; aceitar aqui como true para PROFESSIONAL.
  // Validação estrita deve ser feita antes via query.
  return userRole === 'PROFESSIONAL'
}

async function transitionTo(
  appointmentId: string,
  target: AppointmentStatus,
  patch: Record<string, unknown>,
): Promise<TransitionState> {
  const user = await assertStaff()
  const tenantId = user.profile.tenantId!

  const appt = await fetchAppointmentOrFail(appointmentId, tenantId)
  if (!appt) return { error: 'Agendamento não encontrado' }

  if (!canTransitionTo(appt.status as AppointmentStatus, target)) {
    return { error: `Transição ${appt.status} → ${target} não permitida` }
  }

  if (!isStaffRole(user.profile.role)) return { error: 'Permissão negada' }

  if (user.profile.role === 'PROFESSIONAL') {
    const supabase = await createClient()
    const { data: prof } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!prof || prof.id !== appt.professional_id) {
      return { error: 'Profissional só pode agir nos próprios atendimentos' }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ status: target, ...patch })
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/agenda')
  revalidatePath(`/dashboard/agenda/${appointmentId}`)
  return { success: true }
}

export async function checkInAction(
  _prev: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const id = String(formData.get('id'))
  return transitionTo(id, 'CHECKED_IN', { checked_in_at: new Date().toISOString() })
}

export async function startServiceAction(
  _prev: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const id = String(formData.get('id'))
  return transitionTo(id, 'IN_SERVICE', { started_at: new Date().toISOString() })
}

export async function completeServiceAction(
  _prev: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const id = String(formData.get('id'))
  return transitionTo(id, 'COMPLETED', { completed_at: new Date().toISOString() })
}

export async function noShowAction(
  _prev: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const id = String(formData.get('id'))
  return transitionTo(id, 'NO_SHOW', { cancelled_at: new Date().toISOString() })
}

const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(2).max(500),
})

export async function cancelBySalonAction(
  _prev: TransitionState,
  formData: FormData,
): Promise<TransitionState> {
  const parsed = cancelSchema.safeParse({
    id: formData.get('id'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { error: 'Motivo obrigatório' }

  return transitionTo(parsed.data.id, 'CANCELLED', {
    cancelled_at: new Date().toISOString(),
    cancellation_reason: `[salão] ${parsed.data.reason}`,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/\[id\]/actions.ts
git commit -m "feat(agenda): server actions de transições (check-in, iniciar, finalizar, no-show, cancelar)"
```

---

## Task 2: Card de appointment com botões contextuais

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/_appointment-card.tsx`
- Modify: `src/app/(salon)/dashboard/agenda/_day-list.tsx` (usar card)
- Modify: `src/app/(salon)/dashboard/agenda/_columns-board.tsx` (usar card)

- [ ] **Step 1: Card component**

```tsx
// src/app/(salon)/dashboard/agenda/_appointment-card.tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import {
  checkInAction,
  startServiceAction,
  completeServiceAction,
  noShowAction,
  type TransitionState,
} from './[id]/actions'

type Appointment = {
  id: string
  status: string
  start_at: string
  end_at: string
  customers: { name: string; phone: string } | null
  services: { name: string } | null
  professionals: { name: string; display_name: string | null } | null
}

const INITIAL: TransitionState = {}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function AppointmentCard({ appointment: a }: { appointment: Appointment }) {
  const [checkInState, checkInForm, checkInPending] = useActionState(checkInAction, INITIAL)
  const [startState, startForm, startPending] = useActionState(startServiceAction, INITIAL)
  const [completeState, completeForm, completePending] = useActionState(completeServiceAction, INITIAL)
  const [noShowState, noShowForm, noShowPending] = useActionState(noShowAction, INITIAL)

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {formatTime(a.start_at)}–{formatTime(a.end_at)}
        </span>
        <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs">
          {a.status}
        </span>
      </div>
      <p className="mt-1 font-medium">{a.customers?.name ?? '—'}</p>
      <p className="text-xs opacity-70">
        {a.services?.name ?? '—'} · {a.professionals?.display_name || a.professionals?.name}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {a.status === 'CONFIRMED' ? (
          <>
            <form action={checkInForm}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                disabled={checkInPending}
                className="h-9 rounded-md bg-[var(--color-accent)] px-3 text-xs font-medium text-[var(--color-accent-fg)]"
              >
                Check-in
              </button>
            </form>
            <Link
              href={`/dashboard/agenda/${a.id}`}
              className="h-9 rounded-md border px-3 text-xs leading-9"
            >
              Cancelar…
            </Link>
          </>
        ) : null}

        {a.status === 'CHECKED_IN' ? (
          <>
            <form action={startForm}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                disabled={startPending}
                className="h-9 rounded-md bg-[var(--color-primary)] px-3 text-xs font-medium text-[var(--color-primary-fg)]"
              >
                Iniciar atendimento
              </button>
            </form>
            <form action={noShowForm}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                disabled={noShowPending}
                className="h-9 rounded-md border px-3 text-xs"
              >
                Não compareceu
              </button>
            </form>
          </>
        ) : null}

        {a.status === 'IN_SERVICE' ? (
          <form action={completeForm}>
            <input type="hidden" name="id" value={a.id} />
            <button
              type="submit"
              disabled={completePending}
              className="h-9 rounded-md bg-green-600 px-3 text-xs font-medium text-white"
            >
              Finalizar
            </button>
          </form>
        ) : null}

        <Link
          href={`/dashboard/agenda/${a.id}`}
          className="h-9 rounded-md border px-3 text-xs leading-9"
        >
          Detalhes
        </Link>
      </div>

      {checkInState.error ? <p className="mt-2 text-xs text-red-600">{checkInState.error}</p> : null}
      {startState.error ? <p className="mt-2 text-xs text-red-600">{startState.error}</p> : null}
      {completeState.error ? <p className="mt-2 text-xs text-red-600">{completeState.error}</p> : null}
      {noShowState.error ? <p className="mt-2 text-xs text-red-600">{noShowState.error}</p> : null}
    </div>
  )
}
```

- [ ] **Step 2: Usar no `_day-list.tsx`**

Substituir o conteúdo da `<li>` no `_day-list.tsx` por `<AppointmentCard>`:

```tsx
// src/app/(salon)/dashboard/agenda/_day-list.tsx
import { AppointmentCard } from './_appointment-card'

type Appointment = Parameters<typeof AppointmentCard>[0]['appointment']

export function DayList({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return <p className="mt-6 text-center text-sm opacity-70">Nenhum agendamento hoje.</p>
  }
  return (
    <ul className="space-y-2">
      {appointments.map((a) => (
        <li key={a.id}>
          <AppointmentCard appointment={a} />
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/_appointment-card.tsx src/app/\(salon\)/dashboard/agenda/_day-list.tsx
git commit -m "feat(agenda): card de appointment com botões contextuais"
```

---

## Task 3: Página de detalhe + cancelamento

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/[id]/page.tsx`
- Create: `src/app/(salon)/dashboard/agenda/[id]/_cancel-dialog.tsx`

- [ ] **Step 1: Page de detalhe**

```tsx
// src/app/(salon)/dashboard/agenda/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { CancelDialog } from './_cancel-dialog'

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await assertStaff()
  const supabase = await createClient()
  const { data: a } = await supabase
    .from('appointments')
    .select(
      'id, start_at, end_at, status, notes, cancellation_reason, ' +
        'customers(name, phone), services(name, duration_minutes, price_cents), professionals(name, display_name)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!a) notFound()

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">Agendamento</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="opacity-60">Cliente</dt>
          <dd className="font-medium">
            {a.customers?.name} ({a.customers?.phone})
          </dd>
        </div>
        <div>
          <dt className="opacity-60">Serviço</dt>
          <dd>{a.services?.name}</dd>
        </div>
        <div>
          <dt className="opacity-60">Profissional</dt>
          <dd>{a.professionals?.display_name || a.professionals?.name}</dd>
        </div>
        <div>
          <dt className="opacity-60">Quando</dt>
          <dd>
            {new Date(a.start_at).toLocaleString('pt-BR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">Status</dt>
          <dd>{a.status}</dd>
        </div>
        {a.cancellation_reason ? (
          <div>
            <dt className="opacity-60">Motivo do cancelamento</dt>
            <dd>{a.cancellation_reason}</dd>
          </div>
        ) : null}
      </dl>

      {['CONFIRMED', 'CHECKED_IN'].includes(a.status) ? (
        <div className="mt-6">
          <CancelDialog appointmentId={a.id} />
        </div>
      ) : null}
    </main>
  )
}
```

- [ ] **Step 2: Dialog client**

```tsx
// src/app/(salon)/dashboard/agenda/[id]/_cancel-dialog.tsx
'use client'

import { useActionState, useState } from 'react'
import { cancelBySalonAction, type TransitionState } from './actions'

const INITIAL: TransitionState = {}

export function CancelDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(cancelBySalonAction, INITIAL)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-11 rounded-md border px-4 text-sm font-medium"
      >
        Cancelar agendamento
      </button>
    )
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      <input type="hidden" name="id" value={appointmentId} />
      <label className="block">
        <span className="mb-1 block text-sm">Motivo do cancelamento</span>
        <textarea
          name="reason"
          required
          minLength={2}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </label>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white"
        >
          Confirmar cancelamento
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 rounded-md border px-4 text-sm"
        >
          Voltar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/\[id\]/
git commit -m "feat(agenda): página de detalhe + diálogo de cancelamento"
```

---

## Task 4: Cancelamento pelo customer em `/my-bookings`

**Files:**
- Create: `src/app/(public)/my-bookings/actions.ts`
- Create: `src/app/(public)/my-bookings/_cancel-button.tsx`
- Modify: `src/app/(public)/my-bookings/page.tsx`

- [ ] **Step 1: Server action**

```ts
// src/app/(public)/my-bookings/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantOrNotFound } from '@/lib/tenant/context'
import { canTransitionTo } from '@/lib/booking/status-machine'

const schema = z.object({ id: z.string().uuid() })

export type CustomerCancelState = { error?: string; success?: boolean }

export async function cancelByCustomerAction(
  _prev: CustomerCancelState,
  formData: FormData,
): Promise<CustomerCancelState> {
  const tenant = await getCurrentTenantOrNotFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const parsed = schema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: 'ID inválido' }

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!customer) return { error: 'Customer não encontrado' }

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, status, start_at')
    .eq('id', parsed.data.id)
    .eq('customer_id', customer.id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!appt) return { error: 'Agendamento não encontrado' }

  if (new Date(appt.start_at) < new Date()) {
    return { error: 'Agendamento já passou' }
  }

  if (!canTransitionTo(appt.status, 'CANCELLED')) {
    return { error: 'Agendamento não pode ser cancelado neste status' }
  }

  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: '[cliente] cancelamento solicitado pelo cliente',
    })
    .eq('id', parsed.data.id)

  if (error) return { error: error.message }

  revalidatePath('/my-bookings')
  return { success: true }
}
```

- [ ] **Step 2: Botão client**

```tsx
// src/app/(public)/my-bookings/_cancel-button.tsx
'use client'

import { useActionState } from 'react'
import { cancelByCustomerAction, type CustomerCancelState } from './actions'

const INITIAL: CustomerCancelState = {}

export function CancelButton({ appointmentId }: { appointmentId: string }) {
  const [state, action, pending] = useActionState(cancelByCustomerAction, INITIAL)

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="id" value={appointmentId} />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md border px-3 text-xs font-medium"
      >
        {pending ? 'Cancelando...' : 'Cancelar'}
      </button>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
      {state.success ? <p className="mt-1 text-xs text-green-700">Cancelado.</p> : null}
    </form>
  )
}
```

- [ ] **Step 3: Injetar no `my-bookings/page.tsx`**

Substituir o `<li>` para incluir o botão apenas quando o status permitir:

```tsx
// src/app/(public)/my-bookings/page.tsx  (trecho alterado)
// ... imports existentes
import { CancelButton } from './_cancel-button'

// ... na renderização:
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
    {['CONFIRMED', 'CHECKED_IN'].includes(a.status) && new Date(a.start_at) > new Date() ? (
      <CancelButton appointmentId={a.id} />
    ) : null}
  </li>
))}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/my-bookings/
git commit -m "feat(public): cancelamento de agendamento pelo customer"
```

---

## Task 5: Bloqueio de horário (availability_blocks)

**Files:**
- Create: `src/app/(salon)/dashboard/agenda/bloqueios/page.tsx`
- Create: `src/app/(salon)/dashboard/agenda/bloqueios/actions.ts`

- [ ] **Step 1: Server actions**

```ts
// src/app/(salon)/dashboard/agenda/bloqueios/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertStaff } from '@/lib/auth/guards'
import { availabilityBlockSchema } from '@/lib/validation/schemas'

export type BlockState = { error?: string; success?: boolean }

export async function createBlockAction(
  _prev: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const user = await assertStaff()
  const parsed = availabilityBlockSchema.safeParse({
    professionalId: formData.get('professionalId'),
    startAt: formData.get('startAt'),
    endAt: formData.get('endAt'),
    reason: formData.get('reason') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.from('availability_blocks').insert({
    tenant_id: user.profile.tenantId!,
    professional_id: parsed.data.professionalId,
    start_at: parsed.data.startAt,
    end_at: parsed.data.endAt,
    reason: parsed.data.reason ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/agenda/bloqueios')
  return { success: true }
}

export async function deleteBlockAction(_prev: BlockState, formData: FormData): Promise<BlockState> {
  const user = await assertStaff()
  const id = String(formData.get('id'))
  const supabase = await createClient()
  await supabase
    .from('availability_blocks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.profile.tenantId!)
  revalidatePath('/dashboard/agenda/bloqueios')
  return { success: true }
}
```

- [ ] **Step 2: Page**

```tsx
// src/app/(salon)/dashboard/agenda/bloqueios/page.tsx
import { assertStaff } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { BlockForm } from './_form'

export default async function BloqueiosPage() {
  await assertStaff()
  const supabase = await createClient()
  const [{ data: blocks }, { data: professionals }] = await Promise.all([
    supabase
      .from('availability_blocks')
      .select('id, start_at, end_at, reason, professionals(name, display_name)')
      .order('start_at'),
    supabase.from('professionals').select('id, name, display_name').eq('is_active', true),
  ])

  return (
    <main className="p-4 pb-20">
      <h1 className="text-xl font-bold">Bloqueios de agenda</h1>

      <ul className="mt-4 space-y-2">
        {(blocks ?? []).map((b) => (
          <li key={b.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">
              {b.professionals?.display_name || b.professionals?.name}
            </p>
            <p className="opacity-70">
              {new Date(b.start_at).toLocaleString('pt-BR')} –{' '}
              {new Date(b.end_at).toLocaleString('pt-BR')}
            </p>
            {b.reason ? <p className="opacity-70">Motivo: {b.reason}</p> : null}
          </li>
        ))}
      </ul>

      <BlockForm professionals={professionals ?? []} />
    </main>
  )
}
```

- [ ] **Step 3: Form component**

```tsx
// src/app/(salon)/dashboard/agenda/bloqueios/_form.tsx
'use client'

import { useActionState } from 'react'
import { createBlockAction, type BlockState } from './actions'

const INITIAL: BlockState = {}

type Professional = { id: string; name: string; display_name: string | null }

export function BlockForm({ professionals }: { professionals: Professional[] }) {
  const [state, action, pending] = useActionState(createBlockAction, INITIAL)

  return (
    <form action={action} className="mt-6 space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Novo bloqueio</h2>

      <label className="block">
        <span className="mb-1 block text-sm">Profissional</span>
        <select name="professionalId" required className="h-11 w-full rounded-md border px-3">
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name || p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm">Início</span>
          <input type="datetime-local" name="startAt" required className="h-11 w-full rounded-md border px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Fim</span>
          <input type="datetime-local" name="endAt" required className="h-11 w-full rounded-md border px-3" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm">Motivo (opcional)</span>
        <input name="reason" className="h-11 w-full rounded-md border px-3" />
      </label>

      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-green-700">Bloqueio criado.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-[var(--color-primary)] px-4 font-medium text-[var(--color-primary-fg)] disabled:opacity-50"
      >
        {pending ? 'Salvando...' : 'Criar bloqueio'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(salon\)/dashboard/agenda/bloqueios/
git commit -m "feat(agenda): bloqueio de horário (availability_blocks)"
```

---

## Task 6: pgTAP — transições permitidas e bloqueadas

**Files:**
- Create: `supabase/tests/rls_appointments_transitions.test.sql`

- [ ] **Step 1: Escrever teste**

```sql
-- supabase/tests/rls_appointments_transitions.test.sql
begin;
select plan(4);

-- Setup mínimo (reaproveita IDs do rls_appointments.test.sql se presentes)
insert into public.tenants (id, slug, name, subdomain) values
  ('11111111-1111-1111-1111-111111111111', 'tenant-a', 'Tenant A', 'tenant-a')
on conflict do nothing;

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@a.com')
on conflict do nothing;

insert into public.user_profiles (user_id, role, tenant_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SALON_OWNER', '11111111-1111-1111-1111-111111111111', 'Owner A')
on conflict do nothing;

insert into public.professionals (id, tenant_id, name) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Prof A')
on conflict do nothing;

insert into public.services (id, tenant_id, name, duration_minutes, price_cents) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Corte', 30, 4500)
on conflict do nothing;

insert into public.customers (id, tenant_id, name, phone) values
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Cliente X', '11999999999')
on conflict do nothing;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

insert into public.appointments (
  id, tenant_id, customer_id, professional_id, service_id,
  appointment_date, start_at, end_at, total_amount_cents, booked_by_source, status
) values (
  'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
  '11111111-1111-1111-1111-111111111111',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '2026-05-01', '2026-05-01 10:00-03', '2026-05-01 10:30-03', 4500, 'SALON_MANUAL', 'CONFIRMED'
);

-- Update para CHECKED_IN é permitido
update public.appointments set status = 'CHECKED_IN', checked_in_at = now()
  where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

select results_eq(
  $$select status::text from public.appointments where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$$,
  array['CHECKED_IN'],
  'CONFIRMED → CHECKED_IN permitido'
);

update public.appointments set status = 'IN_SERVICE', started_at = now()
  where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

select results_eq(
  $$select status::text from public.appointments where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$$,
  array['IN_SERVICE'],
  'CHECKED_IN → IN_SERVICE permitido'
);

update public.appointments set status = 'COMPLETED', completed_at = now()
  where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

select results_eq(
  $$select status::text from public.appointments where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'$$,
  array['COMPLETED'],
  'IN_SERVICE → COMPLETED permitido'
);

-- Nota: validação de transição está no app (status-machine.ts), não no DB via trigger.
-- Nesse teste apenas conferimos que RLS permite o update quando vem do owner.

-- Staff de outro tenant não consegue update
set local request.jwt.claim.sub = null;
-- Reset role e tentar update como anon
reset role;
set local role anon;

select results_eq(
  $$update public.appointments set status = 'CANCELLED' where id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1' returning id::text$$,
  array[]::text[],
  'Anônimo não consegue atualizar appointment (RLS bloqueia)'
);

select finish();
rollback;
```

- [ ] **Step 2: Rodar**

```bash
supabase db test
```

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_appointments_transitions.test.sql
git commit -m "test(db): pgTAP transições de status via UPDATE"
```

---

## Task 7: Sanity check

```bash
pnpm lint && pnpm typecheck && pnpm test && supabase db test && pnpm build
```

---

## Critério de aceitação do épico 6

- ✅ Server actions `checkInAction`, `startServiceAction`, `completeServiceAction`, `noShowAction`, `cancelBySalonAction` todas usando `canTransitionTo` para validar.
- ✅ `AppointmentCard` mostra apenas botões relevantes ao status atual.
- ✅ Página de detalhe `/dashboard/agenda/[id]` renderiza informações completas e permite cancelar.
- ✅ Customer consegue cancelar próprio appointment em `/my-bookings` desde que CONFIRMED/CHECKED_IN e ainda futuro.
- ✅ `PROFESSIONAL` só age em appointments em que é o profissional designado (validação no server action via lookup).
- ✅ Bloqueio de horário (`availability_blocks`) cadastrado via `/dashboard/agenda/bloqueios`.
- ✅ `computeAvailableSlots` (do Épico 4) continua respeitando blocks.
- ✅ pgTAP confirma que updates respeitam RLS.
- ✅ Reagendamento = cancelar + criar novo (sem fluxo dedicado; documentado no spec).

**Output:** salão tem ciclo completo de operação — confirmar chegada, atender, concluir, cancelar, bloquear. Próximo épico cobre o painel administrativo da plataforma + billing.
