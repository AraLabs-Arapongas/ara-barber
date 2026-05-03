import Link from 'next/link'
import { Check, Circle, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { OnboardingItem } from '@/lib/onboarding/state'

type Props = {
  items: OnboardingItem[]
  doneCount: number
  totalCount: number
}

/**
 * Checklist persistente no topo da home. Some quando todos os items
 * estão `done` (auto-completion no server marca `onboarding_completed_at`).
 *
 * Cada item linka pra a tela exata onde ele se resolve. Owner clica,
 * preenche, volta — checkmark vira ✓ no próximo render do server
 * component.
 */
export function OnboardingChecklist({ items, doneCount, totalCount }: Props) {
  const nextItem = items.find((i) => !i.done)
  const isHalfway = doneCount >= Math.ceil(totalCount / 2)

  return (
    <Card className="mb-4 overflow-hidden border-brand-primary/30">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-brand-primary/5 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-primary">
            Pra começar
          </p>
          <p className="mt-0.5 text-[0.875rem] text-fg">
            <span className="font-semibold">{doneCount} de {totalCount}</span> itens prontos
            {isHalfway && doneCount < totalCount ? ' — quase lá' : ''}
          </p>
        </div>
        {nextItem ? (
          <Link
            href={nextItem.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-primary px-3 py-1.5 text-[0.75rem] font-medium text-brand-primary-fg hover:opacity-90"
          >
            Próximo
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle ${
                item.done ? 'text-fg-muted' : 'text-fg'
              }`}
            >
              {item.done ? (
                <Check
                  className="h-4 w-4 shrink-0 text-success"
                  aria-label="Concluído"
                  strokeWidth={3}
                />
              ) : (
                <Circle
                  className="h-4 w-4 shrink-0 text-fg-subtle"
                  aria-label="Pendente"
                />
              )}
              <span className={`flex-1 text-[0.875rem] ${item.done ? 'line-through' : ''}`}>
                {item.label}
              </span>
              {!item.done ? (
                <ArrowRight className="h-3 w-3 shrink-0 text-fg-subtle" aria-hidden="true" />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
