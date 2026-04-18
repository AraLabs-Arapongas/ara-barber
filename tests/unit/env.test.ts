import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireEnv } from '@/lib/utils/env'

describe('requireEnv', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL }
  })

  afterEach(() => {
    process.env = ORIGINAL
  })

  it('retorna o valor quando a variável está definida', () => {
    process.env.TEST_VAR = 'hello'
    expect(requireEnv('TEST_VAR')).toBe('hello')
  })

  it('lança erro quando a variável está ausente', () => {
    delete process.env.TEST_VAR
    expect(() => requireEnv('TEST_VAR')).toThrow(/Missing env var TEST_VAR/)
  })

  it('lança erro quando a variável é string vazia', () => {
    process.env.TEST_VAR = ''
    expect(() => requireEnv('TEST_VAR')).toThrow(/Missing env var TEST_VAR/)
  })
})
