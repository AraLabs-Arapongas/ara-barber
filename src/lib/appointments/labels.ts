import type { AppointmentStatus } from '@/lib/appointments/status-rules'

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Marcado',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Feito',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não veio',
}

export const STATUS_TONE: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-warning-bg text-warning',
  CONFIRMED: 'bg-info-bg text-info',
  COMPLETED: 'bg-success-bg text-success',
  CANCELED: 'bg-bg-subtle text-fg-subtle',
  NO_SHOW: 'bg-error-bg text-error',
}

/**
 * "Hoje às 14:30" / "Amanhã às 09:00" / "Qui, 25 abr às 14:30"
 */
export function fullDateTimeLabel(iso: string, tenantTimezone: string): string {
  const d = new Date(iso)
  const dateFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
  const timeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return `${dateFmt} · ${timeFmt}`
}
