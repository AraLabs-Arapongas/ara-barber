'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { Lock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const INITIAL: ResetPasswordState = {}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Mínimo 8 caracteres.'
  if (!/[a-zA-Z]/.test(pw)) return 'Inclua pelo menos uma letra.'
  if (!/[0-9]/.test(pw)) return 'Inclua pelo menos um número.'
  return null
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, INITIAL)
  const [clientError, setClientError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const password = String(fd.get('password') ?? '')
    const confirm = String(fd.get('confirm') ?? '')

    const pwErr = validatePassword(password)
    if (pwErr) {
      e.preventDefault()
      setClientError(pwErr)
      return
    }
    if (password !== confirm) {
      e.preventDefault()
      setClientError('Senhas não conferem.')
      return
    }
    setClientError(null)
  }

  // Server error (vinda da action) tem precedência só se não há client error ativo
  const visibleError = clientError ?? state.error ?? null

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
        onChange={() => clientError && setClientError(null)}
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
        onChange={() => clientError && setClientError(null)}
      />

      {visibleError ? (
        <Alert variant="error" title="Não foi possível atualizar">
          {visibleError}
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingText="Atualizando..."
        className="mt-3"
      >
        Definir nova senha
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  )
}
