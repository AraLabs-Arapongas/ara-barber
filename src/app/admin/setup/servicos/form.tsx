'use client'

import { useActionState, useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { StyledInput } from '@/components/ui/styled-input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { SelectSheet } from '@/components/ui/select-sheet'
import { saveServicesStep} from '@/lib/onboarding/actions'
import type { StepActionState } from '@/lib/onboarding/schemas'
import { WizardFooter } from '../_components/wizard-footer'

type Row = { name: string; duration_minutes: number; price_cents: number }

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function ServicesForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial)
  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveServicesStep,
    {},
  )

  const isValid = useMemo(
    () =>
      rows.length >= 1 &&
      rows.every((r) => r.name.trim().length > 0 && r.duration_minutes > 0 && r.price_cents >= 0),
    [rows],
  )

  function update(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function add() {
    setRows((prev) => [...prev, { name: '', duration_minutes: 30, price_cents: 0 }])
  }
  function remove(idx: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({
            services: rows.map((r) => ({
              name: r.name.trim(),
              duration_minutes: r.duration_minutes,
              price_cents: r.price_cents,
            })),
          })}
        />
        {rows.map((r, idx) => (
          <div
            key={idx}
            className="rounded-md border border-border bg-bg-subtle/30 px-2.5 py-2.5"
          >
            <StyledInput
              value={r.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder="Nome do serviço"
              onClear={rows.length > 1 ? () => remove(idx) : undefined}
              clearLabel="Remover serviço"
              clearDisabled={rows.length === 1}
            />
            <div className="mt-2 flex items-center gap-2">
              <SelectSheet
                value={r.duration_minutes}
                onChange={(v) => update(idx, { duration_minutes: v })}
                options={DURATIONS.map((d) => ({ value: d, label: `${d}min` }))}
                sheetTitle="Duração do serviço"
                className="w-[88px]"
              />
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[0.8125rem] text-fg-muted">R$</span>
                <CurrencyInput
                  valueCents={r.price_cents}
                  onChangeCents={(c) => update(idx, { price_cents: c })}
                  containerClassName="w-28"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-[0.8125rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
        >
          <Plus className="h-4 w-4" /> Adicionar serviço
        </button>
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter
        backHref="/admin/setup/horarios"
        canSubmit={isValid}
        pending={pending}
      />
    </>
  )
}
