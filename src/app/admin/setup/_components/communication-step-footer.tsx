'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { advanceCommunicationStep, dismissWizardAction } from '@/lib/onboarding/actions'

type Props = {
  next: 'whatsapp' | 'push' | 'finish'
  backHref?: string
}

/**
 * Footer dos sub-steps da Etapa 3 (comunicação). Diferente dos outros
 * porque cada sub-step da Etapa 3 não tem form próprio — só "veja e
 * continue". Server action `advanceCommunicationStep` aceita `next`
 * (próximo step ou 'finish' pra completar a etapa).
 */
export function CommunicationStepFooter({ next, backHref }: Props) {
  const [pending, startTransition] = useTransition()

  function handleAdvance() {
    const fd = new FormData()
    fd.set('next', next)
    startTransition(async () => {
      await advanceCommunicationStep({}, fd)
    })
  }

  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <form action={dismissWizardAction}>
        <button
          type="submit"
          className="text-[0.75rem] text-fg-subtle hover:text-fg underline-offset-2 hover:underline"
        >
          Sair do wizard
        </button>
      </form>
      <div className="flex items-center gap-2">
        {backHref ? (
          <Link href={backHref} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Voltar
          </Link>
        ) : null}
        <Button type="button" onClick={handleAdvance} disabled={pending} size="sm">
          {pending ? 'Salvando...' : next === 'finish' ? 'Concluir Etapa 3' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
