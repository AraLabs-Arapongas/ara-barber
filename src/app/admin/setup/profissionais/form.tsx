'use client'

import { useActionState, useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { saveProfessionalsStep, type StepActionState } from '@/lib/onboarding/actions'
import { WizardFooter } from '../_components/wizard-footer'

type Row = { name: string }

export function ProfessionalsForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial)
  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveProfessionalsStep,
    {},
  )
  const isValid = useMemo(
    () => rows.length >= 1 && rows.every((r) => r.name.trim().length > 0),
    [rows],
  )

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({
            professionals: rows.map((r) => ({ name: r.name.trim() })),
          })}
        />
        {rows.map((r, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5"
          >
            <Input
              value={r.name}
              onChange={(e) =>
                setRows((prev) => prev.map((p, i) => (i === idx ? { name: e.target.value } : p)))
              }
              placeholder="Nome do profissional"
              className="h-9 flex-1"
            />
            <button
              type="button"
              onClick={() =>
                setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
              }
              disabled={rows.length === 1}
              className="rounded p-1 text-fg-muted hover:bg-bg-subtle disabled:opacity-30"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { name: '' }])}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-[0.8125rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <Plus className="h-4 w-4" /> Adicionar profissional
        </button>
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/servicos"
        canSubmit={isValid}
        pending={pending}
      />
    </>
  )
}
