import type { Database } from '@/lib/supabase/types'

export type AppointmentStatus = Database['public']['Enums']['appointment_status']

export type TransitionActor = 'staff' | 'customer'

export type TransitionContext = {
  actor: TransitionActor
  now: Date
  startAt: Date
  endAt: Date
  cancellationWindowHours: number
}

type Rule = (ctx: TransitionContext) => { ok: true } | { ok: false; reason: string }

const REQUIRE_STAFF: Rule = (ctx) =>
  ctx.actor === 'staff'
    ? { ok: true }
    : { ok: false, reason: 'Apenas staff pode fazer essa transição.' }

const REQUIRE_PAST_START: Rule = (ctx) =>
  ctx.now.getTime() >= ctx.startAt.getTime()
    ? { ok: true }
    : { ok: false, reason: 'Só é possível depois do horário passar.' }

const REQUIRE_PAST_END: Rule = (ctx) =>
  ctx.now.getTime() >= ctx.endAt.getTime()
    ? { ok: true }
    : { ok: false, reason: 'Só é possível depois do serviço terminar.' }

const REQUIRE_WITHIN_CANCEL_WINDOW: Rule = (ctx) => {
  if (ctx.actor === 'staff') return { ok: true }
  const cutoff = ctx.startAt.getTime() - ctx.cancellationWindowHours * 60 * 60 * 1000
  return ctx.now.getTime() <= cutoff
    ? { ok: true }
    : { ok: false, reason: `Cancelamento só até ${ctx.cancellationWindowHours}h antes.` }
}

const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, Rule[]>>> = {
  SCHEDULED: {
    CONFIRMED: [REQUIRE_STAFF],
    CANCELED: [REQUIRE_WITHIN_CANCEL_WINDOW],
    NO_SHOW: [REQUIRE_STAFF, REQUIRE_PAST_START],
  },
  CONFIRMED: {
    CANCELED: [REQUIRE_WITHIN_CANCEL_WINDOW],
    NO_SHOW: [REQUIRE_STAFF, REQUIRE_PAST_START],
    COMPLETED: [REQUIRE_STAFF, REQUIRE_PAST_END],
  },
  COMPLETED: {},
  CANCELED: {},
  NO_SHOW: {},
}

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
  ctx: TransitionContext,
): { ok: true } | { ok: false; reason: string } {
  const rules = TRANSITIONS[from]?.[to]
  if (!rules) return { ok: false, reason: `Transição ${from} → ${to} não é permitida.` }
  for (const rule of rules) {
    const result = rule(ctx)
    if (!result.ok) return result
  }
  return { ok: true }
}
