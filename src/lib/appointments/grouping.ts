import type { AgendaAppointment } from '@/lib/appointments/queries'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'

/**
 * Versão "agrupada" de uma reserva pra UI cliente. Combo aparece como
 * 1 entry com N segments; single como entry direto.
 */
export type DisplayBooking =
  | { kind: 'single'; appointment: AgendaAppointment }
  | { kind: 'combo'; group: ComboGroup }

export type ComboGroup = {
  id: string
  status: AppointmentStatus
  /** Mais cedo dos start_at — pra ordenação. */
  startAt: string
  /** Mais tarde dos end_at — duração total. */
  endAt: string
  segments: AgendaAppointment[]
}

/**
 * Agrupa uma lista flat de appointments em DisplayBookings:
 *   - appointments com group_id null → kind: 'single'
 *   - appointments com mesmo group_id → kind: 'combo' (sorted por position)
 *
 * Ordena o resultado por startAt ascendente. Status do combo deriva do
 * status compartilhado (todos sincronizados pelas RPCs de cancel).
 */
export function groupBookings(appointments: AgendaAppointment[]): DisplayBooking[] {
  const groups = new Map<string, AgendaAppointment[]>()
  const singles: AgendaAppointment[] = []

  for (const appt of appointments) {
    if (appt.groupId) {
      const arr = groups.get(appt.groupId) ?? []
      arr.push(appt)
      groups.set(appt.groupId, arr)
    } else {
      singles.push(appt)
    }
  }

  const result: DisplayBooking[] = []

  for (const appt of singles) {
    result.push({ kind: 'single', appointment: appt })
  }

  for (const [groupId, segs] of groups) {
    const sorted = [...segs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const startAt = sorted[0]?.startAt ?? ''
    const endAt = sorted[sorted.length - 1]?.endAt ?? ''
    // Status do combo: se todos cancelados → CANCELED; se algum confirmed → CONFIRMED;
    // senão → status do primeiro. (Cancel via RPC sincroniza todos, então normalmente
    // todos têm o mesmo status.)
    const status: AppointmentStatus = sorted.every((s) => s.status === 'CANCELED')
      ? 'CANCELED'
      : sorted.some((s) => s.status === 'CONFIRMED')
        ? 'CONFIRMED'
        : (sorted[0]?.status ?? 'SCHEDULED')

    result.push({
      kind: 'combo',
      group: { id: groupId, status, startAt, endAt, segments: sorted },
    })
  }

  // Ordena por startAt ascendente (próximas primeiro).
  result.sort((a, b) => {
    const aStart = a.kind === 'single' ? a.appointment.startAt : a.group.startAt
    const bStart = b.kind === 'single' ? b.appointment.startAt : b.group.startAt
    return new Date(aStart).getTime() - new Date(bStart).getTime()
  })

  return result
}
