'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import {
  saveBusinessHoursAction,
  INITIAL_HOURS_STATE,
  type SaveHoursState,
} from './actions'

type Row = { weekday: number; startTime: string; endTime: string; isOpen: boolean }

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function HoursEditor({ initial }: { initial: Row[] }) {
  const [hours, setHours] = useState<Row[]>(initial)
  const [state, action, pending] = useActionState<SaveHoursState, FormData>(
    saveBusinessHoursAction,
    INITIAL_HOURS_STATE,
  )

  function update(i: number, patch: Partial<Row>) {
    setHours((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="payload" value={JSON.stringify({ hours })} />

      <ul className="space-y-2">
        {hours.map((h, i) => (
          <li
            key={h.weekday}
            className="rounded-xl border border-border bg-surface px-4 py-3 shadow-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-fg">{DAYS[h.weekday]}</span>
              <label className="inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] text-fg-muted">
                <input
                  type="checkbox"
                  checked={h.isOpen}
                  onChange={(e) => update(i, { isOpen: e.target.checked })}
                  className="h-4 w-4 accent-brand-primary"
                />
                {h.isOpen ? 'Aberto' : 'Fechado'}
              </label>
            </div>

            {h.isOpen ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                    Abre
                  </span>
                  <input
                    type="time"
                    value={h.startTime}
                    onChange={(e) => update(i, { startTime: e.target.value })}
                    className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle">
                    Fecha
                  </span>
                  <input
                    type="time"
                    value={h.endTime}
                    onChange={(e) => update(i, { endTime: e.target.value })}
                    className="h-11 rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
                  />
                </label>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {state.error ? (
        <Alert variant="error" title="Não foi possível salvar">
          {state.error}
        </Alert>
      ) : null}
      {state.success ? <Alert variant="success">Horários atualizados.</Alert> : null}

      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Salvando...">
        Salvar horários
      </Button>
    </form>
  )
}
