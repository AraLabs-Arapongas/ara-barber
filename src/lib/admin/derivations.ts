import type { Database } from '@/lib/supabase/types'

type AppointmentStatus = Database['public']['Enums']['appointment_status']

// Funções `isLate`/`lateMinutes` removidas em 2026-04-29: sem estado
// ARRIVED no enum, todo CONFIRMED com horário passado virava "atrasado"
// — incluindo cliente já sentado na cadeira sendo atendido. Confundia
// o staff. Reabilitar quando ARRIVED/IN_PROGRESS entrarem (épico 10 #31).

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
  appointments: Array<{ professionalId: string; status: AppointmentStatus }>,
  professionalId: string,
): number {
  return appointments.filter(
    (a) => a.professionalId === professionalId && a.status !== 'CANCELED' && a.status !== 'NO_SHOW',
  ).length
}
