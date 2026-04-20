import 'server-only'

import { createClient } from '@/lib/supabase/server'
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
  }
}

/**
 * Busca appointments de um dia específico no timezone do tenant.
 * Usa RLS — só retorna rows que o usuário atual pode ver.
 */
export async function getAgendaForDay(
  tenantId: string,
  dateISO: string,
  tenantTimezone: string,
): Promise<AgendaAppointment[]> {
  // Converte "YYYY-MM-DD" no timezone do tenant pra janela UTC correta
  // Simples: assume tenant_timezone válido via Intl
  const dayStart = new Date(`${dateISO}T00:00:00`)
  const dayEnd = new Date(`${dateISO}T23:59:59`)

  // Ajusta pro timezone do tenant — se UTC, ambos iguais
  // Para timezones tipo America/Sao_Paulo, usamos offset do dia
  const tzOffsetMs = getTimezoneOffsetMs(tenantTimezone, dayStart)
  const startUTC = new Date(dayStart.getTime() - tzOffsetMs)
  const endUTC = new Date(dayEnd.getTime() - tzOffsetMs)

  const supabase = await createClient()
  const { data } = await supabase
    .from('appointments')
    .select(
      `
      id, start_at, end_at, status, customer_id, professional_id, service_id,
      customer_name_snapshot, price_cents_snapshot, notes,
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
}

/**
 * Busca appointments do cliente atual. Quando `tenantId` for passado, filtra.
 * RLS já limita ao próprio customer via customers.user_id = auth.uid().
 */
export async function getMyCustomerAppointments(
  tenantId?: string,
): Promise<AgendaAppointment[]> {
  const supabase = await createClient()
  let query = supabase
    .from('appointments')
    .select(
      `
      id, start_at, end_at, status, customer_id, professional_id, service_id,
      customer_name_snapshot, price_cents_snapshot, notes,
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
