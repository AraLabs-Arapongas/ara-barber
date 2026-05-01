import { describe, expect, it } from 'vitest'
import {
  BusinessHoursStepSchema,
  ServicesStepSchema,
  ProfessionalsStepSchema,
  LinksStepSchema,
} from '@/lib/onboarding/actions'

describe('BusinessHoursStepSchema', () => {
  it('aceita 7 dias válidos', () => {
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_open: weekday !== 0,
      start_time: '09:00',
      end_time: '18:00',
    }))
    expect(BusinessHoursStepSchema.safeParse({ days }).success).toBe(true)
  })
  it('rejeita quantidade != 7', () => {
    expect(BusinessHoursStepSchema.safeParse({ days: [] }).success).toBe(false)
  })
  it('rejeita start_time >= end_time quando aberto', () => {
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_open: true,
      start_time: '18:00',
      end_time: '09:00',
    }))
    expect(BusinessHoursStepSchema.safeParse({ days }).success).toBe(false)
  })
  it('aceita start_time >= end_time quando fechado', () => {
    const days = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      is_open: false,
      start_time: '00:00',
      end_time: '00:00',
    }))
    expect(BusinessHoursStepSchema.safeParse({ days }).success).toBe(true)
  })
})

describe('ServicesStepSchema', () => {
  it('aceita 1 serviço válido', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: 'Corte', duration_minutes: 30, price_cents: 5000 }],
      }).success,
    ).toBe(true)
  })
  it('rejeita 0 serviços', () => {
    expect(ServicesStepSchema.safeParse({ services: [] }).success).toBe(false)
  })
  it('rejeita duração 0 ou negativa', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: 'Corte', duration_minutes: 0, price_cents: 5000 }],
      }).success,
    ).toBe(false)
  })
  it('rejeita preço negativo', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: 'Corte', duration_minutes: 30, price_cents: -1 }],
      }).success,
    ).toBe(false)
  })
  it('rejeita nome vazio', () => {
    expect(
      ServicesStepSchema.safeParse({
        services: [{ name: '', duration_minutes: 30, price_cents: 5000 }],
      }).success,
    ).toBe(false)
  })
})

describe('ProfessionalsStepSchema', () => {
  it('aceita 1 profissional válido', () => {
    expect(
      ProfessionalsStepSchema.safeParse({ professionals: [{ name: 'João' }] }).success,
    ).toBe(true)
  })
  it('rejeita 0 profissionais', () => {
    expect(ProfessionalsStepSchema.safeParse({ professionals: [] }).success).toBe(false)
  })
  it('rejeita nome vazio', () => {
    expect(
      ProfessionalsStepSchema.safeParse({ professionals: [{ name: '' }] }).success,
    ).toBe(false)
  })
  it('rejeita nome > 80 chars', () => {
    expect(
      ProfessionalsStepSchema.safeParse({
        professionals: [{ name: 'a'.repeat(81) }],
      }).success,
    ).toBe(false)
  })
})

describe('LinksStepSchema', () => {
  it('aceita ≥1 vínculo', () => {
    expect(
      LinksStepSchema.safeParse({
        links: [
          {
            service_id: '00000000-0000-0000-0000-000000000001',
            professional_id: '00000000-0000-0000-0000-000000000002',
          },
        ],
      }).success,
    ).toBe(true)
  })
  it('rejeita 0 vínculos', () => {
    expect(LinksStepSchema.safeParse({ links: [] }).success).toBe(false)
  })
  it('rejeita uuid inválido', () => {
    expect(
      LinksStepSchema.safeParse({
        links: [{ service_id: 'not-uuid', professional_id: 'also-not' }],
      }).success,
    ).toBe(false)
  })
})
