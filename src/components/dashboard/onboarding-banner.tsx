import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import type { OnboardingState } from '@/lib/onboarding/derivations'

export function OnboardingBanner({ state }: { state: OnboardingState }) {
  if (state.completed) return null
  return (
    <div className="border-b border-warning/30 bg-warning-bg/40">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-2.5 sm:px-8">
        <ListChecks className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="flex-1 text-[0.8125rem] text-fg">
          <span className="font-medium">Configure seu negócio</span> ·{' '}
          <span className="text-fg-muted">
            {state.completedSteps} de 4 etapas concluídas
          </span>
        </p>
        <Link
          href="/admin/setup"
          className="shrink-0 rounded-md bg-fg px-3 py-1 text-[0.75rem] font-medium text-bg hover:opacity-90"
        >
          Continuar setup →
        </Link>
      </div>
    </div>
  )
}
