import { Calendar, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { MoneyStatCard } from '@/components/home/money-stat-card'
import { WeekAgendaStrip, type WeekDay } from '@/components/home/week-agenda-strip'
import { formatCentsToBrl } from '@/lib/money'

type Props = {
  todayCount: number
  completed: number
  canceled: number
  pendingActiveCount: number
  todayRevenueCents: number
  completedRevenueCents: number
  weekDays: WeekDay[]
  todayISO: string
}

/**
 * Visão "Hoje" pro topo da tela de Relatórios. Migrado da home staff em
 * 2026-05-02 quando a home virou enxuta (header + lista do dia + sino).
 * Agrega: stats grid (4 cards) + week chart strip.
 */
export function TodayOverview({
  todayCount,
  completed,
  canceled,
  pendingActiveCount,
  todayRevenueCents,
  completedRevenueCents,
  weekDays,
  todayISO,
}: Props) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
        Hoje
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="Agenda hoje"
          value={String(todayCount)}
          hint={`${completed} ${completed === 1 ? 'concluído' : 'concluídos'}`}
        />
        <MoneyStatCard
          label="Previsto"
          value={formatCentsToBrl(todayRevenueCents)}
          hint={`${formatCentsToBrl(completedRevenueCents)} já feito`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pendentes"
          value={String(pendingActiveCount)}
          hint={pendingActiveCount === 0 ? 'tudo em dia' : 'aguardando'}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Concluídos"
          value={String(completed)}
          hint={`${canceled} ${canceled === 1 ? 'cancelado/falta' : 'cancelados/faltas'}`}
        />
      </div>

      <div className="mt-4">
        <h3 className="mb-2 px-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
          Esta semana
        </h3>
        <WeekAgendaStrip days={weekDays} todayISO={todayISO} />
      </div>
    </section>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="py-4">
        <div className="mb-2 flex items-center gap-2 text-fg-muted">
          {icon}
          <span className="text-[0.75rem] font-medium uppercase tracking-[0.14em]">{label}</span>
        </div>
        <p className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-fg">
          {value}
        </p>
        <p className="text-[0.75rem] text-fg-muted">{hint}</p>
      </CardContent>
    </Card>
  )
}
