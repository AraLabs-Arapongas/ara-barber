import { describe, it, expect } from 'vitest'
import { formatBrPhone, unformatBrPhone } from '@/lib/format'

describe('formatBrPhone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['1198', '(11) 98'],
    ['11987', '(11) 987'],
    ['1132321234', '(11) 3232-1234'],
    ['11987654321', '(11) 98765-4321'],
    ['abc11def987', '(11) 987'],
    ['434444333434343', '(43) 44443-3343'],
  ])('%s -> %s', (raw, expected) => {
    expect(formatBrPhone(raw)).toBe(expected)
  })
})

describe('unformatBrPhone', () => {
  it('strips non-digits', () => {
    expect(unformatBrPhone('(11) 98765-4321')).toBe('11987654321')
    expect(unformatBrPhone('  (43) 9999-8888 ')).toBe('4399998888')
  })
})
