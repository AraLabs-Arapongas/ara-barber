import { describe, it, expect } from 'vitest'
import { DEFAULT_LANDING_BLOCKS } from '@/lib/landing/queries'

describe('landing default blocks', () => {
  it('lista os 7 blocos esperados em ordem', () => {
    const types = DEFAULT_LANDING_BLOCKS.map((b) => b.blockType)
    expect(types).toEqual([
      'HERO',
      'SERVICES',
      'DIFFERENTIALS',
      'PROFESSIONALS',
      'TESTIMONIALS',
      'CONTACT',
      'FINAL_CTA',
    ])
  })

  it('PROFESSIONALS começa desabilitado por padrão', () => {
    const pro = DEFAULT_LANDING_BLOCKS.find((b) => b.blockType === 'PROFESSIONALS')
    expect(pro?.enabled).toBe(false)
  })

  it('positions são únicos e crescentes', () => {
    const positions = DEFAULT_LANDING_BLOCKS.map((b) => b.position)
    expect(new Set(positions).size).toBe(positions.length)
    const sorted = [...positions].sort((a, b) => a - b)
    expect(positions).toEqual(sorted)
  })
})
