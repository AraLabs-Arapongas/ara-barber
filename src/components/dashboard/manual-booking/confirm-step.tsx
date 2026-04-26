'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { BookingContext } from '@/app/admin/(authenticated)/actions/booking-context'
import { formatCentsToBrl } from '@/lib/money'

import type { CustomerSelection } from './customer-step'

type State = {
  customer: CustomerSelection | null
  serviceId: string | null
  professionalId: string | null
  startAtISO: string | null
  notes: string
}

export function ConfirmStep({
  state,
  context,
  notes,
  onNotesChange,
  onBack,
  onSubmit,
  pending,
}: {
  state: State
  context: BookingContext
  notes: string
  onNotesChange: (n: string) => void
  onBack: () => void
  onSubmit: () => void
  pending: boolean
}) {
  if (!state.customer || !state.serviceId || !state.professionalId || !state.startAtISO) {
    return null
  }

  const service = context.services.find((s) => s.id === state.serviceId)
  const professional = context.professionals.find((p) => p.id === state.professionalId)
  if (!service || !professional) return null

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: context.tenantTimezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(state.startAtISO))
  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: context.tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(state.startAtISO))

  return (
    <section className="space-y-4">
      <Card>
        <CardContent className="space-y-2 py-4">
          <Row label="Cliente" value={state.customer.name || '(sem nome)'} />
          <Row
            label="Serviço"
            value={`${service.name} · ${service.durationMinutes} min · ${formatCentsToBrl(service.priceCents)}`}
          />
          <Row label="Profissional" value={professional.displayName ?? professional.name} />
          <Row label="Quando" value={`${dateLabel} às ${timeLabel}`} />
        </CardContent>
      </Card>

      <textarea
        placeholder="Observações (opcional)"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:border-brand-primary focus-visible:bg-surface-raised"
        rows={3}
        maxLength={500}
      />

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
          Voltar
        </Button>
        <Button type="button" onClick={onSubmit} disabled={pending} loading={pending}>
          {pending ? 'Criando…' : 'Criar agendamento'}
        </Button>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="text-right font-medium text-fg">{value}</span>
    </div>
  )
}
