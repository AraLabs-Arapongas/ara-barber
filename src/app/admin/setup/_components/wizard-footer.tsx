'use client'

import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { dismissWizardAction } from '@/lib/onboarding/actions'

type Props = {
  backHref?: string
  canSubmit: boolean
  pending: boolean
  submitLabel?: string
}

export function WizardFooter({ backHref, canSubmit, pending, submitLabel = 'Continuar' }: Props) {
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
        <Button type="submit" form="step-form" disabled={!canSubmit || pending} size="sm">
          {pending ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
