'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type Hour = { weekday: number; isOpen: boolean; startTime: string; endTime: string }

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

/**
 * Horário de funcionamento em accordion. Por default fechado e mostra
 * só status de hoje (Aberto/Fechado + janela). Clica pra ver semana
 * inteira. Mantém a home enxuta sem perder a info quando precisar.
 */
export function BusinessHoursAccordion({ hours }: { hours: Hour[] }) {
  const [open, setOpen] = useState(false)
  const todayWeekday = new Date().getDay()
  const today = hours.find((h) => h.weekday === todayWeekday)

  const todaySummary = today
    ? today.isOpen
      ? `Hoje ${today.startTime.slice(0, 5)}–${today.endTime.slice(0, 5)}`
      : 'Fechado hoje'
    : 'Horário não cadastrado'

  // Ordena de Seg a Dom (mais natural pra leitura).
  const sorted = [...hours].sort((a, b) => {
    const aw = a.weekday === 0 ? 7 : a.weekday
    const bw = b.weekday === 0 ? 7 : b.weekday
    return aw - bw
  })

  return (
    <Card className="shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
            Funcionamento
          </p>
          <p className="mt-0.5 text-[0.875rem] font-medium text-fg">{todaySummary}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <CardContent className="border-t border-border/60 pt-3">
          <ul className="space-y-1 text-[0.875rem]">
            {sorted.map((h) => (
              <li key={h.weekday} className="flex items-center justify-between">
                <span
                  className={`font-medium ${
                    h.weekday === todayWeekday ? 'text-brand-primary' : 'text-fg'
                  }`}
                >
                  {WEEKDAY_LABELS[h.weekday]}
                </span>
                <span className="text-fg-muted">
                  {h.isOpen ? `${h.startTime.slice(0, 5)} – ${h.endTime.slice(0, 5)}` : 'Fechado'}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  )
}
