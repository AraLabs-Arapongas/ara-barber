'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChecklistSection } from './data'

const STORAGE_KEY = 'ara:mvp-checklist-v1'

const TONE_CLASSES: Record<ChecklistSection['tone'], string> = {
  blocker: 'border-error/40 bg-error-bg/40',
  decision: 'border-warning/40 bg-warning-bg/40',
  limitation: 'border-info/40 bg-info-bg/30',
  nice: 'border-success/40 bg-success-bg/30',
  plan: 'border-brand-primary/40 bg-brand-primary/5',
}

const TONE_CODE: Record<ChecklistSection['tone'], string> = {
  blocker: 'BT',
  decision: 'DE',
  limitation: 'LI',
  nice: 'NH',
  plan: 'OR',
}

type Props = {
  sections: ChecklistSection[]
}

export function MvpChecklistView({ sections }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata state vindo de localStorage
        setChecked(parsed)
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked))
    } catch {
      // ignore
    }
  }, [checked, loaded])

  const totals = useMemo(() => {
    const all = sections.flatMap((s) => s.items.map((i) => i.id))
    const done = all.filter((id) => checked[id]).length
    return { done, total: all.length }
  }, [sections, checked])

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function resetAll() {
    if (!confirm('Zerar todos os checks?')) return
    setChecked({})
  }

  const percent = totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              Progresso
            </p>
            <p className="mt-0.5 font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
              {totals.done}
              <span className="text-fg-subtle"> / {totals.total}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-[1.125rem] font-semibold text-brand-primary">
              {percent}%
            </span>
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[0.75rem] font-medium text-fg-muted hover:bg-bg-subtle"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Zerar
            </button>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
          <div
            className="h-full rounded-full bg-brand-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {sections.map((section) => {
        const sectionDone = section.items.filter((i) => checked[i.id]).length
        return (
          <section
            key={section.id}
            className={cn(
              'rounded-xl border p-4 shadow-xs sm:p-5',
              TONE_CLASSES[section.tone],
            )}
          >
            <header className="mb-3">
              <h2 className="font-display text-[1.125rem] font-semibold leading-tight tracking-tight text-fg sm:text-[1.25rem]">
                {section.title}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
                {section.subtitle}
              </p>
              <p className="mt-1 text-[0.6875rem] text-fg-subtle">
                {sectionDone} de {section.items.length}
              </p>
            </header>

            <ul className="space-y-2">
              {section.items.map((item, index) => {
                const isChecked = !!checked[item.id]
                const code = `${TONE_CODE[section.tone]}-${String(index + 1).padStart(2, '0')}`
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border bg-surface px-3 py-2.5 text-left transition-colors',
                        isChecked
                          ? 'border-border/60 opacity-60'
                          : 'border-border hover:border-border-strong',
                      )}
                      aria-pressed={isChecked}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          isChecked
                            ? 'border-brand-primary bg-brand-primary text-brand-primary-fg'
                            : 'border-border-strong bg-surface',
                        )}
                        aria-hidden="true"
                      >
                        {isChecked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-[0.9375rem] font-medium text-fg',
                            isChecked && 'line-through decoration-fg-subtle',
                          )}
                        >
                          <span className="mr-2 inline-block rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-wider text-fg-muted align-middle">
                            {code}
                          </span>
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
                            {item.detail}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <p className="px-1 text-[0.75rem] text-fg-subtle">
        Checks persistidos em localStorage deste browser. Não sincroniza entre dispositivos.
      </p>
    </div>
  )
}
