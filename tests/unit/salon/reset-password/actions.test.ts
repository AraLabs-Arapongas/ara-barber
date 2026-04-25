import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetPasswordAction, type ResetPasswordState } from '@/app/salon/reset-password/actions'
import * as supabaseServer from '@/lib/supabase/server'

type SupabaseClientReturn = Awaited<ReturnType<typeof supabaseServer.createClient>>

vi.mock('@/lib/supabase/server')
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

const INITIAL: ResetPasswordState = {}

function makeFormData(password: string, confirm: string): FormData {
  const fd = new FormData()
  fd.set('password', password)
  fd.set('confirm', confirm)
  return fd
}

function mockSupabaseAuth(updateUser: ReturnType<typeof vi.fn>) {
  vi.mocked(supabaseServer.createClient).mockResolvedValue({
    auth: { updateUser },
  } as unknown as SupabaseClientReturn)
}

describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejeita senha com menos de 8 caracteres', async () => {
    const result = await resetPasswordAction(INITIAL, makeFormData('short', 'short'))
    expect(result.error).toContain('Mínimo 8 caracteres')
  })

  it('rejeita quando confirmação não bate', async () => {
    const result = await resetPasswordAction(INITIAL, makeFormData('abcdefgh', 'abcdefgX'))
    expect(result.error).toContain('Senhas não conferem')
  })

  it('chama updateUser e redireciona pra /salon/dashboard em caso de sucesso', async () => {
    const update = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockSupabaseAuth(update)

    await expect(
      resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123')),
    ).rejects.toThrow('NEXT_REDIRECT:/salon/dashboard')

    expect(update).toHaveBeenCalledWith({ password: 'newpass123' })
  })

  it('retorna error com message do Supabase quando code é desconhecido', async () => {
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Some unmapped error', code: 'unknown_code' },
    })
    mockSupabaseAuth(update)

    const result = await resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123'))

    expect(result.error).toBe('Some unmapped error')
  })

  it('traduz code "weak_password" pra mensagem PT-BR', async () => {
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Password is too weak', code: 'weak_password' },
    })
    mockSupabaseAuth(update)

    const result = await resetPasswordAction(INITIAL, makeFormData('thiago1234', 'thiago1234'))

    expect(result.error).toContain('Senha muito fraca')
    expect(result.error).toContain('vazamentos conhecidos')
  })

  it('traduz code "same_password" pra mensagem PT-BR', async () => {
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'New password should be different from the old password', code: 'same_password' },
    })
    mockSupabaseAuth(update)

    const result = await resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123'))

    expect(result.error).toBe('A nova senha precisa ser diferente da atual.')
  })

  it('traduz code "session_not_found" pra mensagem que orienta solicitar novo link', async () => {
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Session not found', code: 'session_not_found' },
    })
    mockSupabaseAuth(update)

    const result = await resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123'))

    expect(result.error).toContain('Sessão de recuperação expirou')
    expect(result.error).toContain('Esqueci a senha')
  })

  it('fallback genérico quando message vazia e code desconhecido', async () => {
    const update = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: '', code: 'unknown' },
    })
    mockSupabaseAuth(update)

    const result = await resetPasswordAction(INITIAL, makeFormData('newpass123', 'newpass123'))

    expect(result.error).toBe('Erro ao atualizar senha. Tente novamente.')
  })
})
