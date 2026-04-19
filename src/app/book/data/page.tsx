'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { StepIndicator } from '@/components/book/step-indicator'
import { bookHrefWith, parseBookParams } from '@/lib/mock/booking-params'
import { atMidnight } from '@/lib/mock/helpers'
import { cn } from '@/lib/utils'

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function BookStepDate() {
  const tenantSlug = useTenantSlug()
  const { data: businessHours } = useMockStore(
    tenantSlug,
    ENTITY.businessHours.key,
    ENTITY.businessHours.schema,
    ENTITY.businessHours.seed,
  )
  const { data: availability } = useMockStore(
    tenantSlug,
    ENTITY.availability.key,
    ENTITY.availability.schema,
    ENTITY.availability.seed,
  )
  const sp = useSearchParams()
  const current = parseBookParams(sp ?? new URLSearchParams())

  const openWeekdays = useMemo(() => {
    const salonOpen = new Set(businessHours.filter((h) => h.isOpen).map((h) => h.weekday))
    if (current.professionalId && current.professionalId !== 'any') {
      const profDays = new Set(
        availability.filter((a) => a.professionalId === current.professionalId).map((a) => a.weekday),
      )
      return new Set([...salonOpen].filter((w) => profDays.has(w)))
    }
    const anyProfDays = new Set(availability.map((a) => a.weekday))
    return new Set([...salonOpen].filter((w) => anyProfDays.has(w)))
  }, [businessHours, availability, current.professionalId])

  const days = useMemo(() => {
    const today = atMidnight(new Date())
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [])

  if (!current.serviceId || !current.professionalId) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10 sm:px-6">
        <p className="text-fg-muted">
          Finalize os passos anteriores.{' '}
          <Link href="/book" className="font-medium text-brand-primary hover:underline">
            Voltar
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-24 sm:px-6">
      <Link
        href={bookHrefWith('/book/profissional', current)}
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Profissional
      </Link>

      <StepIndicator current={3} total={6} labels={['Serviço', 'Profissional', 'Data', 'Horário', 'Login', 'Confirmar']} />

      <h1 className="font-display text-[1.625rem] font-semibold leading-tight tracking-tight text-fg">
        Quando?
      </h1>
      <p className="mt-1 mb-5 text-[0.9375rem] text-fg-muted">
        Escolha o dia nos próximos 14 dias.
      </p>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((d) => {
          const weekday = d.getDay()
          const available = openWeekdays.has(weekday)
          const dateStr = toDateStr(d)
          const selected = current.date === dateStr
          const content = (
            <div
              className={cn(
                'flex flex-col items-center rounded-lg px-2 py-3 text-center transition-colors',
                available
                  ? selected
                    ? 'bg-brand-primary text-brand-primary-fg shadow-md'
                    : 'bg-surface border border-border text-fg hover:border-border-strong'
                  : 'bg-bg-subtle text-fg-subtle opacity-60',
              )}
            >
              <span className="text-[0.6875rem] font-medium uppercase tracking-wide">
                {WEEK_LABELS[weekday]}
              </span>
              <span className="mt-0.5 font-display text-[1.25rem] font-semibold leading-none tracking-tight">
                {d.getDate()}
              </span>
              <span className="mt-0.5 text-[0.6875rem]">
                {d.toLocaleDateString('pt-BR', { month: 'short' })}
              </span>
            </div>
          )
          return (
            <li key={dateStr}>
              {available ? (
                <Link
                  href={bookHrefWith('/book/horario', { ...current, date: dateStr })}
                  aria-current={selected ? 'true' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <div aria-disabled="true">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
