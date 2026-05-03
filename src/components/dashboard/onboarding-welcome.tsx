'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Compass } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { setOnboardingStep } from '@/app/admin/(authenticated)/actions/onboarding'

type Props = {
  /** Quando true, abre o modal automaticamente. Server controla via
   *  `onboardingStep === null` (nunca viu) e renderiza condicionalmente. */
  show: boolean
}

/**
 * Modal de boas-vindas do owner novo. Aparece UMA vez (na primeira
 * visita à home) e oferece 2 caminhos:
 * - **Guiar em 5 minutos:** marca `onboarding_step = 'tour'` e leva pra
 *   primeira tela (Horários). Banner sticky vai guiando pelas próximas.
 * - **Explorar sozinho:** marca `onboarding_step = 'skipped'`. Modal não
 *   aparece de novo, mas o checklist no topo da home segue mostrando o
 *   progresso até completar.
 */
export function OnboardingWelcome({ show }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(show)
  const [pending, startTransition] = useTransition()

  function choose(step: 'tour' | 'skipped') {
    startTransition(async () => {
      await setOnboardingStep({ step })
      setOpen(false)
      if (step === 'tour') {
        router.push('/admin/dashboard/mais') // Passo 1: horários estão em Mais
      } else {
        router.refresh()
      }
    })
  }

  return (
    <BottomSheet
      open={open}
      onClose={pending ? () => {} : () => choose('skipped')}
      title="Bem-vindo ao seu painel"
      description="Vamos deixar tudo pronto pra você começar a receber agendamentos."
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => choose('tour')}
          disabled={pending}
          className="flex w-full items-start gap-4 rounded-xl border border-brand-primary/40 bg-brand-primary/5 px-4 py-4 text-left transition-colors hover:bg-brand-primary/10 disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-brand-primary-fg">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">Me guie em 5 minutos</p>
            <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
              Configure horários, serviços, profissionais e vínculos passo a passo.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => choose('skipped')}
          disabled={pending}
          className="flex w-full items-start gap-4 rounded-xl border border-border bg-bg-subtle px-4 py-4 text-left transition-colors hover:bg-surface-raised disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-fg-muted">
            <Compass className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">Vou explorar sozinho</p>
            <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
              O checklist na home mostra o que ainda falta — sem pressão.
            </p>
          </div>
        </button>

        <p className="pt-2 text-center text-[0.75rem] text-fg-subtle">
          Você pode trocar a qualquer momento.
        </p>
      </div>
    </BottomSheet>
  )
}
