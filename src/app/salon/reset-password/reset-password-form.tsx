'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const INITIAL: ResetPasswordState = {}

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'senha123',
  'qwerty123', 'admin123', 'thiago123', 'abc12345', 'password123',
  'aralabs123', '11111111', '00000000', 'iloveyou', 'welcome123',
])

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Mínimo 8 caracteres.'
  if (!/[a-zA-Z]/.test(pw)) return 'Inclua pelo menos uma letra.'
  if (!/[0-9]/.test(pw)) return 'Inclua pelo menos um número.'
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return 'Senha muito comum. Escolhe outra.'
  return null
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const passwordError = password ? validatePassword(password) : null
  const matchError = confirm && password !== confirm ? 'Senhas não conferem.' : null
  const isValid = !passwordError && !matchError && password.length > 0 && confirm.length > 0
  const showPasswordError = submitAttempted && passwordError
  const showMatchError = (submitAttempted || confirm.length > 0) && matchError

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    setSubmitAttempted(true)
    if (!isValid) {
      e.preventDefault()
    }
  }

  // Server error (vinda da action) tem precedência só se não há erro client-side ativo
  const serverError = state.error && !showPasswordError && !showMatchError ? state.error : null
  const visibleError = showPasswordError || showMatchError || serverError

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3">
      <Input
        aria-label="Nova senha"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres com letras e números"
        leftIcon={<Lock className="h-4 w-4" />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Input
        aria-label="Confirmar senha"
        name="confirm"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repita a senha"
        leftIcon={<Lock className="h-4 w-4" />}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {visibleError ? (
        <Alert variant="error" title="Não foi possível atualizar">
          {showPasswordError ? passwordError : showMatchError ? matchError : serverError}
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingText="Atualizando..."
        disabled={!isValid && submitAttempted}
        className="mt-3"
      >
        Definir nova senha
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  )
}
