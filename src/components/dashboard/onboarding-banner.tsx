import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import type { OnboardingState, StageState } from '@/lib/onboarding/derivations'

export function OnboardingBanner({ state }: { state: OnboardingState }) {
  if (state.allCompleted) return null
  // Mostra a primeira etapa em curso (1→2→3). Outras etapas pendentes
  // aparecem após o user concluir a atual.
  const stage: StageState =
    state.currentStage === 1 ? state.stage1 : state.currentStage === 2 ? state.stage2 : state.stage3

  return (
    <div className="border-b border-warning/30 bg-warning-bg/40">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-2.5 sm:px-8">
        <ListChecks className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="flex-1 text-[0.8125rem] text-fg">
          <span className="font-medium">
            Etapa {stage.stage}: {stage.title}
          </span>{' '}
          ·{' '}
          <span className="text-fg-muted">
            {stage.completedSteps} de {stage.totalSteps}{' '}
            {stage.totalSteps === 1 ? 'passo' : 'passos'}
          </span>
        </p>
        <Link
          href="/admin/setup"
          className="shrink-0 rounded-md bg-fg px-3 py-1 text-[0.75rem] font-medium text-bg hover:opacity-90"
        >
          Continuar →
        </Link>
      </div>
    </div>
  )
}
