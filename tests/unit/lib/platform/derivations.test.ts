import { describe, expect, it } from 'vitest'
import {
  calculateMRR,
  countByStatus,
  filterTrialsExpiringWithinDays,
} from '@/lib/platform/derivations'

const sampleTenants = [
  {
    id: 't1',
    billing_status: 'ACTIVE',
    monthly_price_cents: 9900,
    status: 'ACTIVE',
    trial_ends_at: null,
  },
  {
    id: 't2',
    billing_status: 'ACTIVE',
    monthly_price_cents: 19900,
    status: 'ACTIVE',
    trial_ends_at: null,
  },
  {
    id: 't3',
    billing_status: 'TRIALING',
    monthly_price_cents: 9900,
    status: 'ACTIVE',
    trial_ends_at: '2026-05-03T00:00:00Z',
  },
  {
    id: 't4',
    billing_status: 'TRIALING',
    monthly_price_cents: 9900,
    status: 'ACTIVE',
    trial_ends_at: '2026-05-15T00:00:00Z',
  },
  {
    id: 't5',
    billing_status: 'SUSPENDED',
    monthly_price_cents: 9900,
    status: 'SUSPENDED',
    trial_ends_at: null,
  },
] as const

describe('calculateMRR', () => {
  it('soma só billing_status=ACTIVE', () => {
    expect(calculateMRR(sampleTenants)).toBe(29800)
  })

  it('retorna 0 quando lista vazia', () => {
    expect(calculateMRR([])).toBe(0)
  })

  it('ignora monthly_price_cents null', () => {
    expect(
      calculateMRR([
        {
          id: 'x',
          billing_status: 'ACTIVE',
          monthly_price_cents: null,
          status: 'ACTIVE',
          trial_ends_at: null,
        },
      ]),
    ).toBe(0)
  })
})

describe('countByStatus', () => {
  it('agrupa por tenant.status', () => {
    expect(countByStatus(sampleTenants)).toEqual({ ACTIVE: 4, SUSPENDED: 1, ARCHIVED: 0 })
  })
})

describe('filterTrialsExpiringWithinDays', () => {
  it('retorna trials que vencem dentro da janela (referência fixa)', () => {
    const ref = new Date('2026-04-29T00:00:00Z')
    const result = filterTrialsExpiringWithinDays(sampleTenants, 7, ref)
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('inclui trials já vencidos (deadline passou)', () => {
    const ref = new Date('2026-05-04T00:00:00Z')
    const result = filterTrialsExpiringWithinDays(sampleTenants, 7, ref)
    expect(result.map((t) => t.id)).toContain('t3')
  })
})
