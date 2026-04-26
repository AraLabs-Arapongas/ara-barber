import type { AgendaAppointment } from '@/lib/appointments/queries'

/**
 * Considera atrasado quando o appointment ainda está em estado "pendente"
 * (SCHEDULED ou CONFIRMED) e o horário de início já passou.
 */
export function isLate(
  appointment: { status: string; startAt: string },
  now: Date = new Date(),
): boolean {
  if (appointment.status !== 'SCHEDULED' && appointment.status !== 'CONFIRMED') return false
  return new Date(appointment.startAt).getTime() < now.getTime()
}

/**
 * Retorna minutos de atraso (ou 0 se não está atrasado).
 */
export function lateMinutes(
  appointment: { status: string; startAt: string },
  now: Date = new Date(),
): number {
  if (!isLate(appointment, now)) return 0
  return Math.floor((now.getTime() - new Date(appointment.startAt).getTime()) / 60000)
}

export type WorkingWindow = { startTime: string; endTime: string }

/**
 * Devolve o intervalo de trabalho do profissional no dia (no timezone do tenant).
 * Retorna null se o profissional não tem availability cadastrada pro weekday.
 */
export function worksToday(
  availability: Array<{
    professionalId: string
    weekday: number
    startTime: string
    endTime: string
  }>,
  professionalId: string,
  weekday: number,
): WorkingWindow | null {
  const entry = availability.find(
    (a) => a.professionalId === professionalId && a.weekday === weekday,
  )
  if (!entry) return null
  return { startTime: entry.startTime, endTime: entry.endTime }
}

/**
 * True se o profissional não tem nenhuma `professional_availability` cadastrada
 * (nenhum dia da semana). Usado pra alerta "sem horário configurado".
 */
export function hasNoSchedule(
  availability: Array<{ professionalId: string }>,
  professionalId: string,
): boolean {
  return !availability.some((a) => a.professionalId === professionalId)
}

/**
 * Conta agendamentos ativos (excluindo CANCELED/NO_SHOW) de um profissional num dia.
 */
export function countAppointmentsForProfessional(
  appointments: AgendaAppointment[],
  professionalId: string,
): number {
  return appointments.filter(
    (a) =>
      a.professionalId === professionalId &&
      a.status !== 'CANCELED' &&
      a.status !== 'NO_SHOW',
  ).length
}
