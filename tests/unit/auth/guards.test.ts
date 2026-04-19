import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertStaff, assertPlatformAdmin, AuthError } from '@/lib/auth/guards'
import * as session from '@/lib/auth/session'

vi.mock('@/lib/auth/session')

describe('assertStaff', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna o usuário quando staff ativo', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'SALON_OWNER', tenantId: 't1' },
    })

    const result = await assertStaff()
    expect(result.profile.role).toBe('SALON_OWNER')
  })

  it('lança AuthError UNAUTHORIZED quando sem sessão', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue(null)

    await expect(assertStaff()).rejects.toThrow(AuthError)
  })

  it('lança AuthError FORBIDDEN quando role != staff', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'CUSTOMER', tenantId: null },
    })

    await expect(assertStaff()).rejects.toThrow(AuthError)
  })

  it('lança quando tenantId do host difere do tenantId do perfil', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'SALON_OWNER', tenantId: 't1' },
    })

    await expect(assertStaff({ expectedTenantId: 't2' })).rejects.toThrow(AuthError)
  })
})

describe('assertPlatformAdmin', () => {
  it('retorna usuário quando PLATFORM_ADMIN', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Admin', role: 'PLATFORM_ADMIN', tenantId: null },
    })

    const result = await assertPlatformAdmin()
    expect(result.profile.role).toBe('PLATFORM_ADMIN')
  })

  it('lança quando role != PLATFORM_ADMIN', async () => {
    vi.mocked(session.getSessionUser).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      profile: { id: 'p1', name: 'Alice', role: 'SALON_OWNER', tenantId: 't1' },
    })

    await expect(assertPlatformAdmin()).rejects.toThrow(AuthError)
  })
})
