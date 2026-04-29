import { describe, expect, it } from 'vitest'

import {
  computeComboSlots,
  ANY_PROFESSIONAL_SENTINEL,
  type ComboSlotInput,
} from '@/lib/booking/slots'

const TZ = 'America/Sao_Paulo'
const DATE = '2026-05-04' // Segunda-feira (weekday=1)

// Helpers pra montar o input de forma legível.
function baseInput(overrides: Partial<ComboSlotInput> = {}): ComboSlotInput {
  return {
    services: [],
    bufferMinutes: 10,
    dateISO: DATE,
    tenantTimezone: TZ,
    businessHours: [
      { weekday: 1, isOpen: true, startTime: '09:00', endTime: '18:00' },
    ],
    availability: [],
    blocks: [],
    existingAppointments: [],
    now: new Date(`${DATE}T08:00:00-03:00`),
    stepMinutes: 30,
    minAdvanceHours: 0,
    ...overrides,
  }
}

const PRO_A = '11111111-0000-0000-0000-000000000001'
const PRO_B = '22222222-0000-0000-0000-000000000002'

describe('computeComboSlots', () => {
  it('encaixa 2 serviços com mesmo profissional sem aplicar buffer', () => {
    const slots = computeComboSlots(
      baseInput({
        services: [
          {
            serviceId: 's1',
            durationMinutes: 30,
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
          {
            serviceId: 's2',
            durationMinutes: 60,
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
        ],
        availability: [
          { professionalId: PRO_A, weekday: 1, startTime: '09:00', endTime: '18:00' },
        ],
      }),
    )

    expect(slots.length).toBeGreaterThan(0)
    const s = slots[0]
    expect(s.segments).toHaveLength(2)
    // 09:00 → 09:30 → 10:30 (sem buffer porque mesmo prof)
    expect(s.segments[0].startISO).toBe(slot('09:00'))
    expect(s.segments[0].endISO).toBe(slot('09:30'))
    expect(s.segments[1].startISO).toBe(slot('09:30'))
    expect(s.segments[1].endISO).toBe(slot('10:30'))
  })

  it('aplica buffer entre serviços com profissionais diferentes', () => {
    const slots = computeComboSlots(
      baseInput({
        services: [
          {
            serviceId: 's1',
            durationMinutes: 30,
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
          {
            serviceId: 's2',
            durationMinutes: 60,
            professionalId: PRO_B,
            candidateProfessionalIds: [PRO_B],
          },
        ],
        availability: [
          { professionalId: PRO_A, weekday: 1, startTime: '09:00', endTime: '18:00' },
          { professionalId: PRO_B, weekday: 1, startTime: '09:00', endTime: '18:00' },
        ],
        bufferMinutes: 10,
      }),
    )

    expect(slots.length).toBeGreaterThan(0)
    const s = slots[0]
    // 09:00 → 09:30 (PRO_A), depois 10min buffer, depois 09:40 → 10:40 (PRO_B)
    expect(s.segments[0].startISO).toBe(slot('09:00'))
    expect(s.segments[0].endISO).toBe(slot('09:30'))
    expect(s.segments[1].startISO).toBe(slot('09:40'))
    expect(s.segments[1].endISO).toBe(slot('10:40'))
  })

  it('resolve "Qualquer" pegando primeiro candidato livre', () => {
    const slots = computeComboSlots(
      baseInput({
        services: [
          {
            serviceId: 's1',
            durationMinutes: 30,
            professionalId: ANY_PROFESSIONAL_SENTINEL,
            candidateProfessionalIds: [PRO_A, PRO_B],
          },
        ],
        availability: [
          { professionalId: PRO_A, weekday: 1, startTime: '09:00', endTime: '18:00' },
          { professionalId: PRO_B, weekday: 1, startTime: '09:00', endTime: '18:00' },
        ],
      }),
    )

    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].segments[0].professionalId).toBe(PRO_A)
  })

  it('rejeita slot quando segundo serviço conflita com appointment existente', () => {
    const slots = computeComboSlots(
      baseInput({
        services: [
          {
            serviceId: 's1',
            durationMinutes: 30,
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
          {
            serviceId: 's2',
            durationMinutes: 60,
            professionalId: PRO_B,
            candidateProfessionalIds: [PRO_B],
          },
        ],
        availability: [
          { professionalId: PRO_A, weekday: 1, startTime: '09:00', endTime: '18:00' },
          { professionalId: PRO_B, weekday: 1, startTime: '09:00', endTime: '18:00' },
        ],
        // PRO_B ocupado das 09:40 às 10:40 — bloqueia o início às 09:00.
        existingAppointments: [
          { professionalId: PRO_B, startAt: slot('09:40'), endAt: slot('10:40') },
        ],
      }),
    )

    // Slots inválidos enquanto o segundo segmento (PRO_B) sobrepõe o
    // appointment existente em 09:40–10:40:
    //   09:00 → segundo seg = 09:40–10:40 (overlap total)
    //   09:30 → segundo seg = 10:10–11:10 (overlap até 10:40)
    // Primeiro slot válido: 10:00 → segundo seg = 10:40–11:40
    // (toca em 10:40 mas não sobrepõe — strict less-than).
    expect(slots.find((s) => s.time === '09:00')).toBeUndefined()
    expect(slots.find((s) => s.time === '09:30')).toBeUndefined()
    expect(slots.find((s) => s.time === '10:00')).toBeDefined()
  })

  it('respeita bufferMinutes = 0 (back-to-back literal)', () => {
    const slots = computeComboSlots(
      baseInput({
        services: [
          {
            serviceId: 's1',
            durationMinutes: 30,
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
          {
            serviceId: 's2',
            durationMinutes: 60,
            professionalId: PRO_B,
            candidateProfessionalIds: [PRO_B],
          },
        ],
        availability: [
          { professionalId: PRO_A, weekday: 1, startTime: '09:00', endTime: '18:00' },
          { professionalId: PRO_B, weekday: 1, startTime: '09:00', endTime: '18:00' },
        ],
        bufferMinutes: 0,
      }),
    )

    const s = slots[0]
    // Sem buffer: 09:00–09:30 (PRO_A) → 09:30–10:30 (PRO_B)
    expect(s.segments[1].startISO).toBe(slot('09:30'))
  })

  it('retorna [] quando nenhuma sequência cabe no dia', () => {
    const slots = computeComboSlots(
      baseInput({
        services: [
          {
            serviceId: 's1',
            durationMinutes: 480, // 8h — combo de 8h+8h não cabe
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
          {
            serviceId: 's2',
            durationMinutes: 480,
            professionalId: PRO_A,
            candidateProfessionalIds: [PRO_A],
          },
        ],
        availability: [
          { professionalId: PRO_A, weekday: 1, startTime: '09:00', endTime: '18:00' },
        ],
      }),
    )

    expect(slots).toEqual([])
  })
})

/**
 * Gera ISO string UTC pra um horário local (HH:MM) na data fixa do teste,
 * fuso America/Sao_Paulo (UTC-3, sem DST nesse período).
 */
function slot(hhmm: string): string {
  return new Date(`${DATE}T${hhmm}:00-03:00`).toISOString()
}
