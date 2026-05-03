'use client'

import { useActionState, useState } from 'react'
import { saveLandingStep } from '@/lib/onboarding/actions'
import type { StepActionState } from '@/lib/onboarding/schemas'
import { WizardFooter } from '../_components/wizard-footer'

type Block = { type: string; label: string }

export function LandingStepForm({
  blocks,
  initialEnabled,
}: {
  blocks: Block[]
  initialEnabled: string[]
}) {
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(initialEnabled))
  const [state, action, pending] = useActionState<StepActionState, FormData>(saveLandingStep, {})

  function toggle(type: string) {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({ enabled_blocks: Array.from(enabled) })}
        />
        {blocks.map((b) => (
          <label
            key={b.type}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-bg-subtle/30 px-3 py-3"
          >
            <input
              type="checkbox"
              checked={enabled.has(b.type)}
              onChange={() => toggle(b.type)}
              className="h-4 w-4 accent-brand-primary"
            />
            <span className="text-[0.9375rem] text-fg">{b.label}</span>
          </label>
        ))}
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-error">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/marca"
        canSubmit={enabled.size > 0}
        pending={pending}
        submitLabel="Concluir Etapa 2"
      />
    </>
  )
}
