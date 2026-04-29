import { formatCentsToBrl } from '@/lib/money'
import { MoneyValue } from '@/components/ui/money-value'
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
  const active = appointments.filter((a) => a.status !== 'CANCELED' && a.status !== 'NO_SHOW')
  if (active.length === 0) return null

  const revenue = active.reduce(
    (sum, a) => sum + (a.priceCentsSnapshot ?? priceById.get(a.serviceId) ?? 0),
    0,
  )

  return (
    <p className="my-2 text-[0.8125rem] text-fg-muted">
      {active.length} {active.length === 1 ? 'agendamento' : 'agendamentos'} ·{' '}
      <MoneyValue value={formatCentsToBrl(revenue)} /> previsto
    </p>
  )
}
