'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { deleteMyAccountForTenant } from '@/app/perfil/actions'
import { useConfirm } from '@/components/ui/confirm/provider'

export function DeleteAccountButton() {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    const ok = await confirm.typed({
      title: 'Apagar minha conta neste salão?',
      description:
        'Essa ação apaga seu cadastro, cancela reservas futuras e não pode ser desfeita.',
      phrase: 'APAGAR',
      confirmLabel: 'Apagar conta',
      destructive: true,
    })
    if (!ok) return
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
