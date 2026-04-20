'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { deleteMyAccountForTenant } from '@/app/perfil/actions'

export function DeleteAccountButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    const phrase = window.prompt(
      'Essa ação apaga seu cadastro neste salão, cancela reservas futuras e não pode ser desfeita. Digite APAGAR para confirmar:',
    )
    if (phrase?.trim().toUpperCase() !== 'APAGAR') return
    setError(null)
    startTransition(async () => {
      const result = await deleteMyAccountForTenant()
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/')
      router.refresh()
    })
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        fullWidth
        onClick={handleClick}
        loading={pending}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Apagar minha conta neste salão
      </Button>
      {error ? (
        <Alert variant="error" className="mt-2">
          {error}
        </Alert>
      ) : null}
    </div>
  )
}
