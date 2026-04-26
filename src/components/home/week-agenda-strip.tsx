'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'

const MONEY_HIDDEN_KEY = 'ara:money-hidden'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export type WeekDay = {
  /** YYYY-MM-DD na timezone do tenant. */
  dateISO: string
  count: number
  revenueCents: number
}

/**
 * Strip horizontal com 7 dias da semana (Dom→Sáb). Mostra contagem de
 * agendamentos ou R$ previsto por dia, em barras de altura proporcional.
 *
 * - Toggle Count / R$ no header da seção.
 * - Em modo R$, valor é mascarado (R$ ••••) por default; eye toggle ao lado
 *   sincroniza com o card "Previsto" (mesmo localStorage key).
 * - Hoje destacado em brand-primary.
 * - Sem click — visualização pura. Navegação pra dias específicos fica via
 *   /admin/dashboard/agenda?date=… acessada por outros caminhos.
 */
export function WeekAgendaStrip({ days, todayISO }: { days: WeekDay[]; todayISO: string }) {
  const [mode, setMode] = useState<'count' | 'revenue'>('count')
  const [moneyHidden, setMoneyHidden] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(MONEY_HIDDEN_KEY)
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMoneyHidden(stored === '1')
    }
  }, [])

  function toggleMoney() {
    setMoneyHidden((h) => {
      const next = !h
      try {
        window.localStorage.setItem(MONEY_HIDDEN_KEY, next ? '1' : '0')
      } catch {
        // localStorage pode falhar em modo privado; tudo bem.
      }
      return next
    })
  }

  const totalCount = days.reduce((s, d) => s + d.count, 0)
  const totalRevenue = days.reduce((s, d) => s + d.revenueCents, 0)
  const maxValue =
    mode === 'count'
      ? Math.max(...days.map((d) => d.count), 1)
      : Math.max(...days.map((d) => d.revenueCents), 1)

  const totalLabel =
    mode === 'count'
      ? `${totalCount} ${totalCount === 1 ? 'agendamento' : 'agendamentos'}`
      : moneyHidden
        ? 'R$ ••••'
        : `${formatCentsToBrl(totalRevenue)} previsto`

  return (
    <section className="my-4">
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Esta semana
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('count')}
            className={`rounded-md px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide transition-colors ${
              mode === 'count'
                ? 'bg-fg text-bg'
                : 'text-fg-subtle hover:bg-bg-subtle hover:text-fg-muted'
            }`}
            aria-pressed={mode === 'count'}
          >
            Count
          </button>
          <button
            type="button"
            onClick={() => setMode('revenue')}
            className={`rounded-md px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide transition-colors ${
              mode === 'revenue'
                ? 'bg-fg text-bg'
                : 'text-fg-subtle hover:bg-bg-subtle hover:text-fg-muted'
            }`}
            aria-pressed={mode === 'revenue'}
          >
            R$
          </button>
          {mode === 'revenue' ? (
            <button
              type="button"
              onClick={toggleMoney}
              className="-m-1 ml-0.5 rounded p-1 text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg-muted"
              aria-label={moneyHidden ? 'Mostrar valores' : 'Ocultar valores'}
              aria-pressed={moneyHidden}
            >
              {moneyHidden ? (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </header>

      <Card>
        <CardContent className="py-3">
          <p className="mb-3 text-sm text-fg-muted">{totalLabel}</p>

          <div className="flex h-20 items-end justify-between gap-1.5">
            {days.map((day, i) => {
              const value = mode === 'count' ? day.count : day.revenueCents
              const heightPct = value === 0 ? 0 : Math.max(8, (value / maxValue) * 100)
              const isToday = day.dateISO === todayISO
              const label = DAY_LABELS[i]
              const valueDescription =
                mode === 'count'
                  ? `${day.count} ${day.count === 1 ? 'agendamento' : 'agendamentos'}`
                  : moneyHidden
                    ? 'valor oculto'
                    : formatCentsToBrl(day.revenueCents)
              return (
                <div
                  key={day.dateISO}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${label} · ${valueDescription}`}
                >
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    {value > 0 ? (
                      <div
                        className={`w-full rounded-t ${
                          isToday ? 'bg-brand-primary' : 'bg-fg-muted/50'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    ) : null}
                  </div>
                  <span
                    className={`text-[0.6875rem] tabular-nums ${
                      isToday ? 'font-semibold text-brand-primary' : 'text-fg-subtle'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
