import type { StageId } from '@/lib/onboarding/derivations'
import { STAGE_TITLES, STAGE_TOTAL_STEPS } from '@/lib/onboarding/derivations'

type Props = {
  stage: StageId
  /** Sub-step atual dentro da etapa (1-indexed). */
  stepInStage: number
  /** Título do sub-step (ex: "Horários"). */
  stepTitle: string
}

export function ProgressIndicator({ stage, stepInStage, stepTitle }: Props) {
  const total = STAGE_TOTAL_STEPS[stage]
  const pct = (stepInStage / total) * 100
  return (
    <div className="mb-8">
      <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        Etapa {stage} · {STAGE_TITLES[stage]}
      </p>
      <p className="mb-2 text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
        Passo {stepInStage} de {total}
      </p>
      <h1 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
        {stepTitle}
      </h1>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
