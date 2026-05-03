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
  /**
   * Granularidade do grid em minutos. Vem de `tenants.slot_interval_minutes`
   * (5/10/15/20/30/60). Default 30 quando não passado (compat com testes).
   */
  stepMinutes?: number
  /**
   * Antecedência mínima pra agendar (em horas). Slots cujo `startAt` é
   * anterior a `now + minAdvanceMinutes` são omitidos. Vem de
   * `tenants.min_advance_minutes`. Default 0.
   */
  minAdvanceMinutes?: number
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
 * Retorna todos os slots do dia dentro do horário de funcionamento da empresa
 * (union das janelas dos profissionais candidatos com as horas de operação),
 * marcando cada um como disponível ou não. Slots no passado são omitidos.
 *
 * Um slot é "disponível" se existe ao menos um profissional candidato:
 * - cuja jornada semanal cobre aquele horário inteiro,
 * - sem conflito com appointments ativos,
 * - sem bloqueio em availability_blocks (próprios do profissional ou tenant-wide
 *   com `professional_id IS NULL`).
 */
export function computeSlots(input: SlotInput): Slot[] {
  const step = input.stepMinutes ?? 30
  const minAdvanceMs = (input.minAdvanceMinutes ?? 0) * 60 * 60_000
  const earliestAllowed = input.now.getTime() + minAdvanceMs
  const weekday = weekdayInTenantTZ(input.dateISO, input.tenantTimezone)

  const weekdayHours = input.businessHours.find((h) => h.weekday === weekday)
  if (!weekdayHours || !weekdayHours.isOpen) return []
  const businessStart = timeToMinutes(weekdayHours.startTime)
  const businessEnd = timeToMinutes(weekdayHours.endTime)

  const results: Slot[] = []

  for (let t = businessStart; t + input.serviceDurationMinutes <= businessEnd; t += step) {
    const time = minutesToTime(t)
    const slotStart = dateTimeInTenantTZ(input.dateISO, time, input.tenantTimezone)
    const slotEnd = new Date(slotStart.getTime() + input.serviceDurationMinutes * 60_000)

    // Respeita antecedência mínima: slot precisa ser >= agora + minAdvance.
    // (minAdvance=0 reduz à checagem original "não no passado".)
    if (slotStart.getTime() < earliestAllowed) continue

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
          (b.professionalId === profId || b.professionalId === null) &&
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

// ============================================================================
// Combo slots: cliente reserva N serviços back-to-back numa única ação.
// ============================================================================

/** Sentinel pra "qualquer profissional" — replicado de booking/shared/types
 * pra evitar dependência cruzada (slots.ts é puro, sem React). */
export const ANY_PROFESSIONAL_SENTINEL = 'any' as const

export type ComboService = {
  /** UUID do serviço (ou identificador único pra dedupe). */
  serviceId: string
  durationMinutes: number
  /** UUID do profissional escolhido OU 'any'. */
  professionalId: string
  /**
   * IDs dos profs candidatos quando `professionalId === 'any'`.
   * (Quem atende esse serviço.) Quando profissional fixo, ignorado.
   */
  candidateProfessionalIds: string[]
}

export type ComboSlotInput = {
  /** Lista ordenada — primeira é o serviço inicial. */
  services: ComboService[]
  /** `tenants.combo_buffer_minutes`. Aplica entre serviços com profs DIFERENTES. */
  bufferMinutes: number
  dateISO: string
  tenantTimezone: string
  businessHours: BusinessHour[]
  availability: ProfessionalAvailabilityEntry[]
  blocks: AvailabilityBlock[]
  /** Appointments já existentes (pra detectar conflito). Inclui combos
   *  já reservados como N entradas separadas. */
  existingAppointments: Array<{ professionalId: string; startAt: string; endAt: string }>
  now: Date
  stepMinutes?: number
  minAdvanceMinutes?: number
}

export type ComboSegment = {
  serviceId: string
  /** Resolvido (pra 'any' vira o real). */
  professionalId: string
  startISO: string
  endISO: string
}

export type ComboSlot = {
  /** Horário do início do PRIMEIRO serviço. */
  time: string
  startISO: string
  /** Fim do ÚLTIMO serviço (inclui buffers acumulados). */
  endISO: string
  available: boolean
  /** Detalhes de cada serviço (prof resolvido, tempo de cada). */
  segments: ComboSegment[]
}

/**
 * Calcula slots pra combo de serviços back-to-back.
 *
 * Pra cada candidato T no dia, tenta encaixar a sequência inteira:
 *   serviço 0 em [T, T+dur0]
 *   serviço 1 em [T+dur0+buf?, T+dur0+buf?+dur1]
 *   ...
 *
 * Buffer aplica APENAS entre serviços com profissionais diferentes
 * (mesmo prof não precisa transição). Quando 'any', o prof resolvido
 * é o primeiro candidato livre.
 *
 * Slot é `available` quando todos os serviços encaixam sem conflito,
 * dentro de business_hours, dentro de professional_availability,
 * sem availability_blocks e sem appointment ativo.
 */
export function computeComboSlots(input: ComboSlotInput): ComboSlot[] {
  if (input.services.length === 0) return []

  const step = input.stepMinutes ?? 30
  const minAdvanceMs = (input.minAdvanceMinutes ?? 0) * 60 * 60_000
  const earliestAllowed = input.now.getTime() + minAdvanceMs
  const weekday = weekdayInTenantTZ(input.dateISO, input.tenantTimezone)

  const weekdayHours = input.businessHours.find((h) => h.weekday === weekday)
  if (!weekdayHours || !weekdayHours.isOpen) return []
  const businessStart = timeToMinutes(weekdayHours.startTime)
  const businessEnd = timeToMinutes(weekdayHours.endTime)

  // Pré-calcula a duração total mínima da sequência (sem buffer ainda) pra
  // pular Ts impossíveis cedo.
  const minTotalMinutes = input.services.reduce((sum, s) => sum + s.durationMinutes, 0)

  const results: ComboSlot[] = []

  outer: for (let t = businessStart; t + minTotalMinutes <= businessEnd; t += step) {
    const time = minutesToTime(t)
    const firstSlotStart = dateTimeInTenantTZ(input.dateISO, time, input.tenantTimezone)
    if (firstSlotStart.getTime() < earliestAllowed) continue

    // Walk a sequência. `cursor` é o instante em minutos (relativo ao dia)
    // onde o próximo serviço começa.
    let cursor = t
    let prevProf: string | null = null
    const segments: ComboSegment[] = []

    for (let i = 0; i < input.services.length; i++) {
      const svc = input.services[i]

      // Buffer aplica antes do serviço i (i > 0) se o prof do anterior
      // for diferente do que vai atender este. Pra 'any', resolveremos o
      // prof abaixo, mas precisamos decidir o cursor agora; então usamos
      // a heurística: se o anterior teve prof X e este tem prof Y fixo
      // (Y != X), aplica buffer; se este é 'any', tentamos primeiro sem
      // buffer (mesmo prof) e depois com buffer (prof diferente) — mas
      // isso multiplica complexidade. Solução prática: SEMPRE aplica buffer
      // quando i>0 e (prevProf != svc.professionalId fixo) OU svc é 'any'
      // (assume que pode dar prof diferente). Exceção: se i>0 e prevProf
      // === svc.professionalId fixo, sem buffer.
      let segmentStartMin = cursor
      if (i > 0) {
        const sameAsPrev =
          svc.professionalId !== ANY_PROFESSIONAL_SENTINEL &&
          prevProf !== null &&
          svc.professionalId === prevProf
        if (!sameAsPrev) segmentStartMin = cursor + input.bufferMinutes
      }

      const segmentEndMin = segmentStartMin + svc.durationMinutes
      if (segmentEndMin > businessEnd) continue outer

      const segStart = dateTimeInTenantTZ(
        input.dateISO,
        minutesToTime(segmentStartMin),
        input.tenantTimezone,
      )
      const segEnd = new Date(segStart.getTime() + svc.durationMinutes * 60_000)

      // Lista de profs candidatos pra este serviço.
      const candidates =
        svc.professionalId === ANY_PROFESSIONAL_SENTINEL
          ? svc.candidateProfessionalIds
          : [svc.professionalId]

      // Acha primeiro candidato disponível pra este segment.
      let chosen: string | undefined
      for (const profId of candidates) {
        const withinJourney = input.availability.some(
          (a) =>
            a.professionalId === profId &&
            a.weekday === weekday &&
            timeToMinutes(a.startTime) <= segmentStartMin &&
            timeToMinutes(a.endTime) >= segmentEndMin,
        )
        if (!withinJourney) continue

        const blocked = input.blocks.some(
          (b) =>
            (b.professionalId === profId || b.professionalId === null) &&
            new Date(b.startAt).getTime() < segEnd.getTime() &&
            new Date(b.endAt).getTime() > segStart.getTime(),
        )
        if (blocked) continue

        const conflict = input.existingAppointments.some(
          (a) =>
            a.professionalId === profId &&
            new Date(a.startAt).getTime() < segEnd.getTime() &&
            new Date(a.endAt).getTime() > segStart.getTime(),
        )
        if (conflict) continue

        chosen = profId
        break
      }

      if (!chosen) continue outer // sequência quebra aqui, próximo T

      segments.push({
        serviceId: svc.serviceId,
        professionalId: chosen,
        startISO: segStart.toISOString(),
        endISO: segEnd.toISOString(),
      })

      cursor = segmentEndMin
      prevProf = chosen
    }

    // Sequência inteira encaixou. Slot disponível.
    results.push({
      time,
      startISO: firstSlotStart.toISOString(),
      endISO: dateTimeInTenantTZ(
        input.dateISO,
        minutesToTime(cursor),
        input.tenantTimezone,
      ).toISOString(),
      available: true,
      segments,
    })
  }

  return results
}
