import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/secret'
import { cacheTags } from '@/lib/cache/tags'
import type { Database } from '@/lib/supabase/types'

export type AppointmentStatus = Database['public']['Enums']['appointment_status']

export type AgendaAppointment = {
  id: string
  startAt: string
  endAt: string
  status: AppointmentStatus
  customerName: string | null
  serviceName: string | null
  professionalName: string | null
  customerId: string | null
  professionalId: string
  serviceId: string
  priceCentsSnapshot: number | null
  notes: string | null
  /** Quando NOT NULL, este appointment pertence a um combo. */
  groupId: string | null
  /** Ordem dentro do combo (0-indexed). NULL pra single bookings. */
  position: number | null
}

type Row = {
  id: string
  start_at: string
  end_at: string
  status: AppointmentStatus
  customer_id: string | null
  professional_id: string
  service_id: string
  customer_name_snapshot: string | null
  price_cents_snapshot: number | null
  notes: string | null
  group_id: string | null
  position: number | null
  customer: { name: string | null } | null
  service: { name: string } | null
  professional: { name: string } | null
}

function rowToAppointment(row: Row): AgendaAppointment {
  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    customerName: row.customer?.name ?? row.customer_name_snapshot ?? null,
    serviceName: row.service?.name ?? null,
    professionalName: row.professional?.name ?? null,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    priceCentsSnapshot: row.price_cents_snapshot,
    notes: row.notes,
    groupId: row.group_id,
    position: row.position,
  }
}

/**
 * Busca appointments de um dia específico no timezone do tenant.
 *
 * **Cacheada** (`unstable_cache`). Usa secret client (bypass RLS)
 * porque o cache não pode usar cookies. Caller DEVE garantir auth via
 * `assertStaff({ expectedTenantId: tenantId })` na rota/layout antes de
 * chamar — sem isso, cache scoped por tenant ainda evita leakage entre
 * tenants mas não impede usuário não-staff de ler.
 *
 * Invalidação:
 *   - Mutations em appointments do dia (create/cancel/update) chamam
 *     `updateTag(cacheTags.agendaDay(tenantId, dateISO))`.
 *   - Realtime hook detecta postgres_changes e chama
 *     `invalidateAgendaForDay()` antes de `router.refresh()`.
 */
export async function getAgendaForDay(
  tenantId: string,
  dateISO: string,
  tenantTimezone: string,
): Promise<AgendaAppointment[]> {
  return unstable_cache(
    async () => {
      // Converte "YYYY-MM-DD" no timezone do tenant pra janela UTC correta
      const dayStart = new Date(`${dateISO}T00:00:00`)
      const dayEnd = new Date(`${dateISO}T23:59:59`)

      const tzOffsetMs = getTimezoneOffsetMs(tenantTimezone, dayStart)
      const startUTC = new Date(dayStart.getTime() - tzOffsetMs)
      const endUTC = new Date(dayEnd.getTime() - tzOffsetMs)

      const supabase = createSecretClient()
      const { data } = await supabase
        .from('appointments')
        .select(
          `
          id, start_at, end_at, status, customer_id, professional_id, service_id,
          customer_name_snapshot, price_cents_snapshot, notes, group_id, position,
          customer:customers(name),
          service:services(name),
          professional:professionals(name)
        `,
        )
        .eq('tenant_id', tenantId)
        .gte('start_at', startUTC.toISOString())
        .lte('start_at', endUTC.toISOString())
        .order('start_at', { ascending: true })

      const rows = (data ?? []) as unknown as Row[]
      return rows.map(rowToAppointment)
    },
    ['getAgendaForDay', tenantId, dateISO, tenantTimezone],
    { tags: [cacheTags.agendaDay(tenantId, dateISO)], revalidate: 86400 },
  )()
}

/**
 * Agendamentos SCHEDULED (aguardando confirmação do staff) a partir de `fromISO`,
 * ordenados por horário ascendente. Limita a 10 pra não explodir a home.
 *
 * **Cacheada** (Next 16). `fromISO` deve ser passado em granularidade de dia
 * (ex: início do dia local) pra cache hits funcionarem — passar `now()` quebra
 * o cache em cada request. Caller deve assertStaff(tenantId).
 */
export async function getPendingConfirmations(
  tenantId: string,
  fromISO: string,
  limit = 10,
): Promise<AgendaAppointment[]> {
  return unstable_cache(
    async () => {
      const supabase = createSecretClient()
      const { data } = await supabase
        .from('appointments')
        .select(
          `
          id, start_at, end_at, status, customer_id, professional_id, service_id,
          customer_name_snapshot, price_cents_snapshot, notes, group_id, position,
          customer:customers(name),
          service:services(name),
          professional:professionals(name)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'SCHEDULED')
        .gte('start_at', fromISO)
        .order('start_at', { ascending: true })
        .limit(limit)

      const rows = (data ?? []) as unknown as Row[]
      return rows.map(rowToAppointment)
    },
    ['getPendingConfirmations', tenantId, fromISO, String(limit)],
    { tags: [cacheTags.agendaPending(tenantId)], revalidate: 86400 },
  )()
}

/**
 * Busca appointments do cliente atual. Quando `tenantId` for passado, filtra.
 * RLS já limita ao próprio customer via customers.user_id = auth.uid().
 */
export async function getMyCustomerAppointments(tenantId?: string): Promise<AgendaAppointment[]> {
  const supabase = await createClient()
  let query = supabase
    .from('appointments')
    .select(
      `
      id, start_at, end_at, status, customer_id, professional_id, service_id,
      customer_name_snapshot, price_cents_snapshot, notes, group_id, position,
      customer:customers(name),
      service:services(name),
      professional:professionals(name)
    `,
    )
    .order('start_at', { ascending: false })

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]
  return rows.map(rowToAppointment)
}

/**
 * Calcula offset (ms) de um timezone IANA em relação ao UTC numa data.
 * Positivo = à leste de UTC (ex: +03:00 = 10800000).
 */
function getTimezoneOffsetMs(timezone: string, date: Date): number {
  try {
    // Formata a data no tz do tenant, e em UTC. A diferença é o offset.
    const tzStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
    const utcStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
    const parse = (s: string) => {
      const [d, t] = s.split(', ')
      const [mm, dd, yyyy] = d.split('/').map(Number)
      const [hh, mi, ss] = t.split(':').map(Number)
      return Date.UTC(yyyy, mm - 1, dd, hh, mi, ss)
    }
    return parse(tzStr) - parse(utcStr)
  } catch {
    return 0
  }
}
