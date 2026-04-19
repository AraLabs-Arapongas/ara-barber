import { describe, it, expect } from 'vitest'
import {
  parseBrlToCents,
  formatCentsToBrl,
  parsePercentToBasisPoints,
} from '@/lib/money'

describe('parseBrlToCents', () => {
  it.each([
    ['10', 1000],
    ['10,50', 1050],
    ['10.50', 1050],
    ['R$ 10,50', 1050],
    ['1.000,00', 100000],
    ['0', 0],
    ['0,99', 99],
  ])('parses %s to %d cents', (input, expected) => {
    expect(parseBrlToCents(input)).toBe(expected)
  })

  it.each([null, undefined, '', '   ', 'abc', '-10'])('rejects %p', (input) => {
    expect(parseBrlToCents(input)).toBeNull()
  })
})

describe('formatCentsToBrl', () => {
  it('formats 1050 as R$ 10,50', () => {
    expect(formatCentsToBrl(1050)).toMatch(/R\$\s*10,50/)
  })
  it('formats 0 as R$ 0,00', () => {
    expect(formatCentsToBrl(0)).toMatch(/R\$\s*0,00/)
  })
})

describe('parsePercentToBasisPoints', () => {
  it.each([
    ['50', 5000],
    ['50,5', 5050],
    ['100', 10000],
    ['0', 0],
    ['12,34', 1234],
    ['50%', 5000],
  ])('parses %s to %d bp', (input, expected) => {
    expect(parsePercentToBasisPoints(input)).toBe(expected)
  })

  it.each([null, undefined, '', 'abc', '-5'])('rejects %p', (input) => {
    expect(parsePercentToBasisPoints(input)).toBeNull()
  })
})
