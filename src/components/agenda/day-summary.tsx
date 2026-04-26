import { formatCentsToBrl } from '@/lib/money'
import { isLate } from '@/lib/admin/derivations'
import type { Database } from '@/lib/supabase/types'

type AppointmentStatus = Database['public']['Enums']['appointment_status']

type SummaryAppointment = {
  id: string
  status: AppointmentStatus
  startAt: string
  serviceId: string
  priceCentsSnapshot: number | null
}

export function DaySummary({
  appointments,
  priceById,
}: {
  appointments: SummaryAppointment[]
  priceById: Map<string, number>
}) {
  const active = appointments.filter(
    (a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW',
  )
  if (active.length === 0) return null

  const revenue = active.reduce(
    (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
    0,
  )
  const now = new Date()
  const late = active.filter((a) =>
    isLate({ status: a.status, startAt: a.startAt }, now),
  ).length

  return (
    <p className="my-2 text-[0.8125rem] text-fg-muted">
      {active.length} {active.length === 1 ? 'agendamento' : 'agendamentos'} ·{' '}
      {formatCentsToBrl(revenue)} previsto
      {late > 0 ? ` · ${late} ${late === 1 ? 'atraso' : 'atrasos'}` : ''}
    </p>
  )
}
