'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { formatCentsToBrl } from '@/lib/money'
import { MASK, useMoneyHidden } from '@/lib/money-visibility'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export type WeekDay = {
  /** YYYY-MM-DD na timezone do tenant. */
  dateISO: string
  count: number
  revenueCents: number
  /** Quando presente, transforma a barra em link clicável (Path II). */
  href?: string
}

export type WeekNav = {
  rangeLabel: string
  prevHref: string
  nextHref: string
  todayHref: string
  /** Quando true, botão "Hoje" fica desabilitado (já estamos na semana de hoje). */
  isCurrentWeek: boolean
}

type ChartPoint = {
  dateISO: string
  label: string
  dateNumber: string
  value: number
  count: number
  revenueCents: number
  isToday: boolean
  isSelected: boolean
  href?: string
}

/**
 * Strip semanal com chart de barras (recharts). Mostra 7 dias da semana
 * (Dom→Sáb) com count de agendamentos ou R$ previsto por dia.
 *
 * - Toggle Count / R$ no header da seção.
 * - R$ respeita o estado global de visibilidade (`useMoneyHidden`).
 * - Hoje destacado; dia selecionado em brand-primary.
 * - `onDayClickHref` opcional: torna as barras clicáveis (navega pra rota
 *   informada). `weekNav` opcional: adiciona prev/next/today semana acima.
 */
export function WeekAgendaStrip({
  days,
  todayISO,
  selectedDateISO,
  weekNav,
}: {
  days: WeekDay[]
  todayISO: string
  selectedDateISO?: string
  weekNav?: WeekNav
}) {
  const hasClickableDays = days.some((d) => d.href)
  const [mode, setMode] = useState<'count' | 'revenue'>('count')
  const { hidden: moneyHidden } = useMoneyHidden()
  const router = useRouter()

  const totalCount = days.reduce((s, d) => s + d.count, 0)
  const totalRevenue = days.reduce((s, d) => s + d.revenueCents, 0)

  const chartData: ChartPoint[] = useMemo(
    () =>
      days.map((day, i) => {
        const isToday = day.dateISO === todayISO
        const isSelected = selectedDateISO ? day.dateISO === selectedDateISO : isToday
        return {
          dateISO: day.dateISO,
          label: DAY_LABELS[i] ?? '',
          dateNumber: day.dateISO.slice(8, 10),
          value: mode === 'count' ? day.count : day.revenueCents,
          count: day.count,
          revenueCents: day.revenueCents,
          isToday,
          isSelected,
          href: day.href,
        }
      }),
    [days, todayISO, selectedDateISO, mode],
  )

  const totalLabel =
    mode === 'count'
      ? `${totalCount} ${totalCount === 1 ? 'agendamento' : 'agendamentos'}`
      : moneyHidden
        ? MASK
        : `${formatCentsToBrl(totalRevenue)} previsto`

  function handleBarClick(data: unknown) {
    const point = data as ChartPoint | undefined
    if (point?.href) router.push(point.href)
  }

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
            <div className="mb-2 flex items-center justify-between gap-2">
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
            <p className="mb-2 text-sm text-fg-muted">{totalLabel}</p>
          )}

          <div className="relative h-32 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={120}>
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={(props) => {
                    const { x, y, payload } = props as {
                      x: number
                      y: number
                      payload: { value: string; index: number }
                    }
                    const point = chartData[payload.index]
                    if (!point) return <g />
                    const dayColor = point.isSelected
                      ? 'var(--color-brand-primary)'
                      : 'var(--color-fg-subtle)'
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={12}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={point.isSelected ? 600 : 400}
                          fill={dayColor}
                        >
                          {payload.value}
                        </text>
                        <text
                          x={0}
                          y={0}
                          dy={26}
                          textAnchor="middle"
                          fontSize={10}
                          fill={dayColor}
                          opacity={point.isSelected || point.isToday ? 1 : 0.7}
                        >
                          {point.dateNumber}
                        </text>
                      </g>
                    )
                  }}
                  height={36}
                  interval={0}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-bg-subtle)', opacity: 0.5 }}
                  content={(props) => {
                    const cast = props as unknown as {
                      active?: boolean
                      payload?: ReadonlyArray<{ payload: ChartPoint }>
                    }
                    return (
                      <ChartTooltip
                        active={cast.active}
                        payload={cast.payload}
                        mode={mode}
                        moneyHidden={moneyHidden}
                      />
                    )
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  cursor={hasClickableDays ? 'pointer' : 'default'}
                  onClick={handleBarClick}
                >
                  {chartData.map((point) => (
                    <Cell
                      key={point.dateISO}
                      fill={
                        point.isSelected ? 'var(--color-brand-primary)' : 'var(--color-fg-muted)'
                      }
                      fillOpacity={point.isSelected ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {weekNav ? <p className="mt-2 text-center text-sm text-fg-muted">{totalLabel}</p> : null}
        </CardContent>
      </Card>
    </section>
  )
}

function ChartTooltip({
  active,
  payload,
  mode,
  moneyHidden,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ChartPoint }>
  mode: 'count' | 'revenue'
  moneyHidden: boolean
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload
  if (!point) return null
  const valueText =
    mode === 'count'
      ? `${point.count} ${point.count === 1 ? 'agendamento' : 'agendamentos'}`
      : moneyHidden
        ? MASK
        : formatCentsToBrl(point.revenueCents)
  return (
    <div className="rounded-md border border-border bg-bg px-2 py-1 text-[0.75rem] shadow-md">
      <p className="font-medium text-fg">
        {point.label} {point.dateNumber}
      </p>
      <p className="text-fg-muted">{valueText}</p>
    </div>
  )
}
