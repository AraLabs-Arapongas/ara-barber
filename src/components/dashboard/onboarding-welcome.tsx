'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Compass } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { setOnboardingStep } from '@/app/admin/(authenticated)/actions/onboarding-step'

type Props = {
  /** Server controla a renderização; client só mantém estado de open. */
  show: boolean
}

/**
 * Modal de boas-vindas do owner. Aparece UMA vez (na home, quando
 * `onboarding_step IS NULL`) e oferece dois caminhos:
 *
 * - **Me guie em 5 minutos:** marca `step='tour'`, leva pra
 *   `/admin/setup` (wizard de 4 etapas: horários, serviços,
 *   profissionais, vínculos).
 * - **Vou explorar sozinho:** marca `step='skipped'` + cookie de
 *   bypass. Modal não aparece de novo. Banner persistente continua
 *   mostrando "X de 4 etapas" até completar.
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
        router.push('/admin/setup')
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
              Wizard guiado: horários → serviços → profissionais → vínculos.
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
              Banner no topo mostra o progresso — sem pressão.
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
