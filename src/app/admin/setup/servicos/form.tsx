'use client'

import { useActionState, useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
            className="rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Input
                value={r.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                placeholder="Nome do serviço"
                className="h-9 min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={rows.length === 1}
                className="shrink-0 rounded p-1 text-fg-muted hover:bg-bg-subtle disabled:opacity-30"
                aria-label="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select
                value={r.duration_minutes}
                onChange={(e) => update(idx, { duration_minutes: Number(e.target.value) })}
                className="h-9 rounded-md border border-border bg-bg px-2 text-[0.8125rem]"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}min
                  </option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[0.8125rem] text-fg-muted">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={(r.price_cents / 100).toFixed(2).replace('.', ',')}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^\d,.]/g, '').replace(',', '.')
                    const num = Number(cleaned)
                    update(idx, {
                      price_cents: Number.isFinite(num) ? Math.round(num * 100) : 0,
                    })
                  }}
                  className="h-9 w-24 text-right"
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
