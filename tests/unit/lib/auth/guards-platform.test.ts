import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}))

import { assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import { getSessionUser } from '@/lib/auth/session'

const mocked = vi.mocked(getSessionUser)

describe('assertPlatformAdmin', () => {
  beforeEach(() => mocked.mockReset())

  it('throws UNAUTHORIZED quando não há user', async () => {
    mocked.mockResolvedValue(null)
    await expect(assertPlatformAdmin()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws UNAUTHORIZED quando user sem profile', async () => {
    mocked.mockResolvedValue({ id: 'u1', email: 'x@y.com', profile: null })
    await expect(assertPlatformAdmin()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('throws FORBIDDEN quando role não é PLATFORM_ADMIN', async () => {
    mocked.mockResolvedValue({
      id: 'u1',
      email: 'x@y.com',
      profile: { id: 'p1', name: 'X', role: 'BUSINESS_OWNER', tenantId: 't1' },
    })
    await expect(assertPlatformAdmin()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns user quando role é PLATFORM_ADMIN', async () => {
    const user = {
      id: 'u1',
      email: 'x@y.com',
      profile: { id: 'p1', name: 'X', role: 'PLATFORM_ADMIN' as const, tenantId: null },
    }
    mocked.mockResolvedValue(user)
    await expect(assertPlatformAdmin()).resolves.toEqual(user)
  })

  it('throws AuthError instance, não Error genérico', async () => {
    mocked.mockResolvedValue(null)
    await expect(assertPlatformAdmin()).rejects.toBeInstanceOf(AuthError)
  })
})
