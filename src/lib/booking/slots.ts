import type {
  AvailabilityBlock,
  BusinessHour,
  ProfessionalAvailabilityEntry,
} from '@/lib/booking/queries'

export type SlotInput = {
  serviceDurationMinutes: number
  dateISO: string
  tenantTimezone: string
  candidateProfessionalIds: string[]
  businessHours: BusinessHour[]
  availability: ProfessionalAvailabilityEntry[]
  blocks: AvailabilityBlock[]
  existingAppointments: Array<{ professionalId: string; startAt: string; endAt: string }>
  now: Date
  stepMinutes?: number
}

export type Slot = {
  time: string
  available: boolean
  /** Só presente quando available=true — primeiro profissional livre naquele horário. */
  professionalId?: string
  startISO: string
  endISO: string
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Calcula offset (ms) do timezone IANA em relação ao UTC numa data.
 * Cópia do helper em @/lib/appointments/queries pra não criar dependência cruzada.
 */
export function getTimezoneOffsetMs(timezone: string, date: Date): number {
  try {
    const fmt = (tz: string) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
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
    return parse(fmt(timezone)) - parse(fmt('UTC'))
  } catch {
    return 0
  }
}

/**
 * Retorna o Date UTC correspondente a um "YYYY-MM-DD HH:MM" no timezone do tenant.
 */
export function dateTimeInTenantTZ(
  dateISO: string,
  timeHHMM: string,
  tenantTimezone: string,
): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const [hh, mm] = timeHHMM.split(':').map(Number)
  const localEpoch = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0)
  const offset = getTimezoneOffsetMs(tenantTimezone, new Date(localEpoch))
  return new Date(localEpoch - offset)
}

/**
 * Descobre o dia-da-semana (0=Dom..6=Sáb) de uma data YYYY-MM-DD no tz do tenant.
 */
export function weekdayInTenantTZ(dateISO: string, tenantTimezone: string): number {
  const [y, m, d] = dateISO.split('-').map(Number)
  const noon = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0))
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: tenantTimezone,
    weekday: 'short',
  }).format(noon)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[weekdayName] ?? 0
}

/**
 * Retorna todos os slots do dia dentro do horário de funcionamento do salão
 * (union das janelas dos profissionais candidatos com as horas do salão),
 * marcando cada um como disponível ou não. Slots no passado são omitidos.
 *
 * Um slot é "disponível" se existe ao menos um profissional candidato:
 * - cuja jornada semanal cobre aquele horário inteiro,
 * - sem conflito com appointments ativos,
 * - sem bloqueio em availability_blocks.
 */
export function computeSlots(input: SlotInput): Slot[] {
  const step = input.stepMinutes ?? 30
  const weekday = weekdayInTenantTZ(input.dateISO, input.tenantTimezone)

  const salonHours = input.businessHours.find((h) => h.weekday === weekday)
  if (!salonHours || !salonHours.isOpen) return []
  const salonStart = timeToMinutes(salonHours.startTime)
  const salonEnd = timeToMinutes(salonHours.endTime)

  const results: Slot[] = []

  for (let t = salonStart; t + input.serviceDurationMinutes <= salonEnd; t += step) {
    const time = minutesToTime(t)
    const slotStart = dateTimeInTenantTZ(input.dateISO, time, input.tenantTimezone)
    const slotEnd = new Date(
      slotStart.getTime() + input.serviceDurationMinutes * 60_000,
    )

    if (slotStart.getTime() < input.now.getTime()) continue

    let availableProId: string | undefined
    for (const profId of input.candidateProfessionalIds) {
      const withinJourney = input.availability.some(
        (a) =>
          a.professionalId === profId &&
          a.weekday === weekday &&
          timeToMinutes(a.startTime) <= t &&
          timeToMinutes(a.endTime) >= t + input.serviceDurationMinutes,
      )
      if (!withinJourney) continue

      const blocked = input.blocks.some(
        (b) =>
          b.professionalId === profId &&
          new Date(b.startAt).getTime() < slotEnd.getTime() &&
          new Date(b.endAt).getTime() > slotStart.getTime(),
      )
      if (blocked) continue

      const conflict = input.existingAppointments.some(
        (a) =>
          a.professionalId === profId &&
          new Date(a.startAt).getTime() < slotEnd.getTime() &&
          new Date(a.endAt).getTime() > slotStart.getTime(),
      )
      if (conflict) continue

      availableProId = profId
      break
    }

    results.push({
      time,
      available: availableProId !== undefined,
      professionalId: availableProId,
      startISO: slotStart.toISOString(),
      endISO: slotEnd.toISOString(),
    })
  }

  return results
}
