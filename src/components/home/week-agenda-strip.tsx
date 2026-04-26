'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'
import { MASK, useMoneyHidden } from '@/lib/money-visibility'

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
 * - R$ respeita o estado global de visibilidade (`useMoneyHidden`) — toggle
 *   no header da página esconde/mostra.
 * - Hoje destacado com ring; dia selecionado em brand-primary (quando
 *   `selectedDateISO` ≠ `todayISO`).
 * - `onDayClickHref` opcional: quando passado, cada dia vira um Link.
 *   Quando ausente, é só visualização.
 */
export type WeekNav = {
  rangeLabel: string
  prevHref: string
  nextHref: string
  todayHref: string
  /** Quando true, botão "Hoje" fica desabilitado (já estamos na semana de hoje). */
  isCurrentWeek: boolean
}

export function WeekAgendaStrip({
  days,
  todayISO,
  selectedDateISO,
  onDayClickHref,
  weekNav,
}: {
  days: WeekDay[]
  todayISO: string
  /** Dia destacado em brand-primary. Quando ausente, só `todayISO` é destacado. */
  selectedDateISO?: string
  /** Função que recebe a dateISO e devolve o href de navegação. Se ausente, sem click. */
  onDayClickHref?: (dateISO: string) => string
  /** Navegação entre semanas (Path II — strip vira o seletor de dia da Agenda). */
  weekNav?: WeekNav
}) {
  const [mode, setMode] = useState<'count' | 'revenue'>('count')
  const { hidden: moneyHidden } = useMoneyHidden()

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
        ? MASK
        : `${formatCentsToBrl(totalRevenue)} previsto`

  return (
    <section className="my-4">
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Esta semana
        </h2>
        <div className="flex items-center gap-1">
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
        </div>
      </header>

      <Card>
        <CardContent className="py-3">
          {weekNav ? (
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link
                href={weekNav.prevHref}
                aria-label="Semana anterior"
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <div className="flex flex-1 items-center justify-center gap-3">
                <p className="text-sm font-medium text-fg">{weekNav.rangeLabel}</p>
                {!weekNav.isCurrentWeek ? (
                  <Link
                    href={weekNav.todayHref}
                    className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-muted hover:bg-bg-subtle hover:text-fg"
                  >
                    Hoje
                  </Link>
                ) : null}
              </div>
              <Link
                href={weekNav.nextHref}
                aria-label="Próxima semana"
                className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <p className="mb-3 text-sm text-fg-muted">{totalLabel}</p>
          )}

          <div className="flex h-20 items-end justify-between gap-1.5">
            {days.map((day, i) => {
              const value = mode === 'count' ? day.count : day.revenueCents
              const heightPct = value === 0 ? 0 : Math.max(8, (value / maxValue) * 100)
              const isToday = day.dateISO === todayISO
              const isSelected = selectedDateISO ? day.dateISO === selectedDateISO : isToday
              const label = DAY_LABELS[i]
              const dateNumber = day.dateISO.slice(8, 10)
              const valueDescription =
                mode === 'count'
                  ? `${day.count} ${day.count === 1 ? 'agendamento' : 'agendamentos'}`
                  : moneyHidden
                    ? 'valor oculto'
                    : formatCentsToBrl(day.revenueCents)

              const barClass = `w-full rounded-t ${
                isSelected ? 'bg-brand-primary' : 'bg-fg-muted/50'
              }`
              const labelClass = `text-[0.6875rem] tabular-nums ${
                isSelected ? 'font-semibold text-brand-primary' : 'text-fg-subtle'
              }`
              const dateClass = `text-[0.625rem] tabular-nums ${
                isToday && !isSelected
                  ? 'rounded bg-brand-primary/10 px-1 text-brand-primary'
                  : isSelected
                    ? 'text-brand-primary'
                    : 'text-fg-subtle'
              }`

              const inner = (
                <>
                  <div className="relative flex w-full flex-1 items-end justify-center">
                    {value > 0 ? (
                      <div className={barClass} style={{ height: `${heightPct}%` }} />
                    ) : null}
                  </div>
                  <span className={labelClass}>{label}</span>
                  <span className={dateClass}>{dateNumber}</span>
                </>
              )

              const wrapperBase = 'flex flex-1 flex-col items-center gap-0.5'
              const titleAttr = `${label} ${dateNumber} · ${valueDescription}`

              if (onDayClickHref) {
                return (
                  <Link
                    key={day.dateISO}
                    href={onDayClickHref(day.dateISO)}
                    className={`${wrapperBase} group transition-opacity hover:opacity-80`}
                    title={titleAttr}
                  >
                    {inner}
                  </Link>
                )
              }
              return (
                <div key={day.dateISO} className={wrapperBase} title={titleAttr}>
                  {inner}
                </div>
              )
            })}
          </div>

          {weekNav ? <p className="mt-3 text-center text-sm text-fg-muted">{totalLabel}</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}
