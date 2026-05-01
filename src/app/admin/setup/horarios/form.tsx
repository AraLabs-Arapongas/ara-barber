'use client'

import { useActionState, useState, useMemo } from 'react'
import { saveBusinessHoursStep} from '@/lib/onboarding/actions'
import type { StepActionState } from '@/lib/onboarding/schemas'
import { SelectSheet } from '@/components/ui/select-sheet'
import { WizardFooter } from '../_components/wizard-footer'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

type Day = {
  weekday: number
  is_open: boolean
  start_time: string
  end_time: string
}

export function HoursForm({ initialDays }: { initialDays: Day[] }) {
  const [days, setDays] = useState<Day[]>(initialDays)
  const [state, action, pending] = useActionState<StepActionState, FormData>(
    saveBusinessHoursStep,
    {},
  )

  const isValid = useMemo(
    () =>
      days.every((d) => !d.is_open || d.start_time < d.end_time) &&
      days.some((d) => d.is_open),
    [days],
  )

  function update(weekday: number, patch: Partial<Day>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)))
  }

  return (
    <>
      <form id="step-form" action={action} className="space-y-2">
        <input type="hidden" name="payload" value={JSON.stringify({ days })} />
        {days.map((d) => (
          <div
            key={d.weekday}
            className="rounded-md border border-border bg-bg-subtle/30 px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <label className="flex flex-1 items-center gap-2 text-[0.875rem] text-fg cursor-pointer">
                <input
                  type="checkbox"
                  checked={d.is_open}
                  onChange={(e) => update(d.weekday, { is_open: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="font-medium">{WEEKDAYS[d.weekday]}</span>
              </label>
              <SelectSheet
                value={d.start_time}
                onChange={(v) => update(d.weekday, { start_time: v })}
                options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                sheetTitle={`${WEEKDAYS[d.weekday]} — abre às`}
                placeholder="--:--"
                disabled={!d.is_open}
                className="w-[92px]"
              />
              <span className="shrink-0 text-fg-subtle">→</span>
              <SelectSheet
                value={d.end_time}
                onChange={(v) => update(d.weekday, { end_time: v })}
                options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
                sheetTitle={`${WEEKDAYS[d.weekday]} — fecha às`}
                placeholder="--:--"
                disabled={!d.is_open}
                className="w-[92px]"
              />
            </div>
          </div>
        ))}
        {state.error ? (
          <p className="mt-3 text-[0.8125rem] text-danger">{state.error}</p>
        ) : null}
      </form>
      <WizardFooter canSubmit={isValid} pending={pending} />
    </>
  )
}
