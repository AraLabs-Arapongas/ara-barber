import { describe, it, expect, vi, beforeEach } from 'vitest'
import { forgotPasswordAction, type ForgotPasswordState } from '@/app/salon/forgot-password/actions'
import * as supabaseServer from '@/lib/supabase/server'
import * as nextHeaders from 'next/headers'

vi.mock('@/lib/supabase/server')
vi.mock('next/headers')

const INITIAL: ForgotPasswordState = {}

function makeFormData(email: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  return fd
}

function mockSupabaseAuth(resetPasswordForEmail: ReturnType<typeof vi.fn>) {
  vi.mocked(supabaseServer.createClient).mockResolvedValue({
    auth: { resetPasswordForEmail },
  } as any)
}

function mockHeaders(host: string) {
  vi.mocked(nextHeaders.headers).mockResolvedValue({
    get: (key: string) => (key === 'x-ara-host' ? host : null),
  } as any)
}

describe('forgotPasswordAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejeita email com formato inválido', async () => {
    const result = await forgotPasswordAction(INITIAL, makeFormData('not-an-email'))
    expect(result.error).toBe('E-mail inválido.')
  })

  it('chama resetPasswordForEmail com redirectTo dinâmico baseado em x-ara-host', async () => {
    const reset = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseAuth(reset)
    mockHeaders('qa-aralabs.aralabs.com.br')

    const result = await forgotPasswordAction(INITIAL, makeFormData('user@example.com'))

    expect(reset).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://qa-aralabs.aralabs.com.br/salon/reset-password',
    })
    expect(result.ok).toBe(true)
  })

  it('retorna ok=true mesmo se Supabase devolver erro (anti-enumeration)', async () => {
    const reset = vi.fn().mockResolvedValue({
      error: { message: 'User not found' },
    })
    mockSupabaseAuth(reset)
    mockHeaders('qa-aralabs.aralabs.com.br')

    const result = await forgotPasswordAction(INITIAL, makeFormData('ghost@example.com'))

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('usa http em dev quando NODE_ENV !== production', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const reset = vi.fn().mockResolvedValue({ error: null })
    mockSupabaseAuth(reset)
    mockHeaders('qa-aralabs.lvh.me:3008')

    await forgotPasswordAction(INITIAL, makeFormData('user@example.com'))

    expect(reset).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://qa-aralabs.lvh.me:3008/salon/reset-password',
    })

    vi.unstubAllEnvs()
  })
})
