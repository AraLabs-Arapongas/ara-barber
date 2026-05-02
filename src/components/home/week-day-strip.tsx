import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type Props = {
  /** 7 dias começando no domingo da semana exibida (YYYY-MM-DD). */
  weekDateISOs: string[]
  /** Hoje em YYYY-MM-DD (timezone do tenant). */
  todayISO: string
  /** Dia atualmente selecionado em YYYY-MM-DD. */
  selectedDateISO: string
  /** Mês exibido no topo. Ex: "Maio". */
  monthLabel: string
  /** Pra onde apontam os links (selectedDate vira `?date=YYYY-MM-DD`). */
  hrefBase: string
  /** Domingo da semana anterior em YYYY-MM-DD (pro botão de chevron). */
  prevWeekDateISO: string
  /** Domingo da semana seguinte em YYYY-MM-DD. */
  nextWeekDateISO: string
}

/**
 * Strip semanal estilo calendário mobile: mês + DOM/SEG/TER... + números,
 * com seleção destacada em pílula sólida e botão "hoje" se a semana
 * exibida não contém o dia atual. Server-side (URL-driven) — todo
 * estado vive em `?date=YYYY-MM-DD`, sobrevive refresh, é compartilhável.
 */
export function WeekDayStrip({
  weekDateISOs,
  todayISO,
  selectedDateISO,
  monthLabel,
  hrefBase,
  prevWeekDateISO,
  nextWeekDateISO,
}: Props) {
  const containsToday = weekDateISOs.includes(todayISO)

  return (
    <section className="rounded-2xl bg-bg-subtle/50 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[0.875rem] font-medium capitalize text-fg">{monthLabel}</p>
        <div className="flex items-center gap-1">
          {/* Slot do "Hoje" sempre renderizado pra reservar espaço — evita
              flick (chevrons "pulando") quando navega entre semanas. */}
          <Link
            href={`${hrefBase}?date=${todayISO}`}
            aria-hidden={containsToday}
            tabIndex={containsToday ? -1 : 0}
            className={`rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] transition-opacity ${
              containsToday
                ? 'pointer-events-none opacity-0'
                : 'text-fg-muted hover:bg-bg-subtle hover:text-fg'
            }`}
          >
            Hoje
          </Link>
          <Link
            href={`${hrefBase}?date=${prevWeekDateISO}`}
            aria-label="Semana anterior"
            className="grid h-7 w-7 place-items-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`${hrefBase}?date=${nextWeekDateISO}`}
            aria-label="Semana seguinte"
            className="grid h-7 w-7 place-items-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-fg"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekDateISOs.map((iso, i) => (
          <div
            key={iso}
            className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-fg-subtle"
          >
            {WEEKDAYS[i]}
          </div>
        ))}
        {weekDateISOs.map((iso) => {
          const isSelected = iso === selectedDateISO
          const isToday = iso === todayISO
          const dayNumber = Number(iso.slice(8, 10))
          const baseClass =
            'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[0.9375rem] tabular-nums transition-colors'
          const stateClass = isSelected
            ? 'bg-brand-primary font-semibold text-brand-primary-fg'
            : isToday
              ? 'font-semibold text-brand-primary ring-1 ring-brand-primary/40 hover:bg-brand-primary/10'
              : 'text-fg hover:bg-bg-subtle'
          return (
            <Link
              key={`${iso}-day`}
              href={`${hrefBase}?date=${iso}`}
              className="block"
              aria-label={`Selecionar ${dayNumber}`}
              aria-current={isSelected ? 'date' : undefined}
            >
              <span className={`${baseClass} ${stateClass}`}>{dayNumber}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
