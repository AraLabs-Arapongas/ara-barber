import type { Appointment, AppointmentStatus } from './schemas'

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Marcado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Feito',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não veio',
}

export const STATUS_TONE: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-bg-subtle text-fg-muted',
  CONFIRMED: 'bg-info-bg text-info',
  IN_PROGRESS: 'bg-warning-bg text-warning',
  COMPLETED: 'bg-success-bg text-success',
  CANCELED: 'bg-bg-subtle text-fg-subtle',
  NO_SHOW: 'bg-error-bg text-error',
}

export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'IN_PROGRESS', 'CANCELED', 'NO_SHOW'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELED'],
  COMPLETED: ['SCHEDULED'],
  CANCELED: [],
  NO_SHOW: [],
}

export function atMidnight(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatDayLabel(d: Date): string {
  const today = atMidnight(new Date())
  const target = atMidnight(d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fullDateTimeLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })} · ${timeLabel(iso)}`
}

export function sortByStart(a: Appointment, b: Appointment): number {
  return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
}

export function appointmentsOnDay(appts: Appointment[], day: Date): Appointment[] {
  return appts.filter((a) => sameDay(new Date(a.startAt), day)).sort(sortByStart)
}

export function iso(d: Date): string {
  return d.toISOString()
}
