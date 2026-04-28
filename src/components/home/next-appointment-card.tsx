'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ListChecks, RefreshCw, X } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { useConfirm } from '@/components/ui/confirm/provider'
import { STATUS_LABELS, STATUS_TONE } from '@/lib/appointments/labels'
import type { AppointmentStatus } from '@/lib/appointments/status-rules'
import { cancelCustomerAppointment } from '@/lib/appointments/server-actions'

type Props = {
  appointment: {
    id: string
    serviceId: string
    serviceName: string | null
    professionalId: string
    professionalName: string | null
    startAt: string
    status: AppointmentStatus
  }
  tenantTimezone: string
  /** Em horas — usado pra checar se ainda dá tempo de cancelar. */
  cancellationWindowHours: number
  /** Tenant pode desligar cancelamento self-service. Quando false, esconde o botão. */
  customerCanCancel: boolean
}

/**
 * Card hero "Sua próxima reserva" com 3 ações inline ao pé:
 *   - Ver detalhes (link pra /meus-agendamentos/[id])
 *   - Reagendar (link pro wizard pré-preenchido — não cancela auto)
 *   - Cancelar (ação client com confirm; só aparece se elegível)
 *
 * O título do card (Serviço + Hoje/Amanhã/data + profissional) NÃO é
 * mais clicável inteiro — substituído pelo botão "Ver detalhes" pra
 * que os outros 2 botões não disparem o link por engano.
 */
export function NextAppointmentCardHero({
  appointment,
  tenantTimezone,
  cancellationWindowHours,
  customerCanCancel,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Captura "agora" uma vez no mount pra manter `canCancel` puro durante
  // os renders. Em apps long-lived isso pode ficar levemente fora; aceito
  // — a defesa real é o server action que rejeita fora da janela.
  const [nowMs] = useState(() => Date.now())

  const startMs = new Date(appointment.startAt).getTime()
  const cutoff = startMs - cancellationWindowHours * 60 * 60 * 1000
  const eligibleStatus =
    appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED'
  const canCancel = customerCanCancel && eligibleStatus && nowMs <= cutoff

  const dateLabel = smartDateLabel(appointment.startAt, tenantTimezone)
  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(appointment.startAt))

  const reagendarHref = `/book?step=datetime&serviceId=${appointment.serviceId}&professionalId=${appointment.professionalId}`

  async function handleCancel() {
    const ok = await confirm({
      title: 'Cancelar esta reserva?',
      description: 'Seu horário será liberado pra outros clientes.',
      confirmLabel: 'Cancelar reserva',
      cancelLabel: 'Voltar',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await cancelCustomerAppointment({ appointmentId: appointment.id })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Card className="shadow-xs border-brand-primary/20 bg-brand-primary/5 overflow-hidden">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.25rem] font-semibold leading-tight tracking-tight text-fg">
              {appointment.serviceName ?? 'Serviço'}
            </p>
            <p className="mt-1.5 text-[0.9375rem]">
              <span className="font-semibold text-brand-primary">{dateLabel}</span>
              <span className="text-fg-muted"> · </span>
              <span className="font-semibold text-fg">{timeLabel}</span>
            </p>
            {appointment.professionalName ? (
              <p className="mt-1 text-[0.8125rem] text-fg-muted">
                com <span className="text-fg">{appointment.professionalName}</span>
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide ${STATUS_TONE[appointment.status]}`}
          >
            {STATUS_LABELS[appointment.status]}
          </span>
        </div>
      </CardContent>

      {error ? (
        <div className="px-4 pb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

      {/* Ações inline. Divididas por separadores verticais. Cada
          coluna ocupa 1/N pra dar peso visual igual. */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch border-t border-brand-primary/15">
        <Link
          href={`/meus-agendamentos/${appointment.id}`}
          className="flex items-center justify-center gap-1.5 py-3 text-[0.875rem] font-medium text-brand-primary hover:bg-brand-primary/5"
        >
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          Ver detalhes
        </Link>
        <span aria-hidden="true" className="my-2 w-px bg-brand-primary/15" />
        <Link
          href={reagendarHref}
          className="flex items-center justify-center gap-1.5 py-3 text-[0.875rem] font-medium text-brand-primary hover:bg-brand-primary/5"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reagendar
        </Link>
        <span aria-hidden="true" className="my-2 w-px bg-brand-primary/15" />
        {canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="flex items-center justify-center gap-1.5 py-3 text-[0.875rem] font-medium text-error hover:bg-error-bg disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {pending ? 'Cancelando...' : 'Cancelar'}
          </button>
        ) : (
          <span
            className="flex items-center justify-center gap-1.5 py-3 text-[0.875rem] font-medium text-fg-subtle"
            aria-disabled="true"
            title={
              !customerCanCancel
                ? 'Cancelamento online indisponível'
                : 'Fora da janela de cancelamento'
            }
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancelar
          </span>
        )}
      </div>
    </Card>
  )
}

/**
 * Retorna "Hoje" / "Amanhã" / weekday curto (ex: "Qua") relativo ao
 * dia atual no fuso do tenant. Pra reservas mais distantes, usa
 * "DD/MM" (curto, cabe na linha).
 */
function smartDateLabel(iso: string, tenantTimezone: string): string {
  const fmtDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: tenantTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const today = fmtDate.format(new Date())
  const target = fmtDate.format(new Date(iso))

  if (today === target) return 'Hoje'

  // Calcula diferença em dias (em string YYYY-MM-DD).
  const [ty, tm, td] = today.split('-').map(Number)
  const [ay, am, ad] = target.split('-').map(Number)
  const todayUTC = Date.UTC(ty, tm - 1, td)
  const targetUTC = Date.UTC(ay, am - 1, ad)
  const diffDays = Math.round((targetUTC - todayUTC) / (24 * 60 * 60 * 1000))

  if (diffDays === 1) return 'Amanhã'
  if (diffDays > 0 && diffDays < 7) {
    const weekday = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tenantTimezone,
      weekday: 'long',
    }).format(new Date(iso))
    return weekday.charAt(0).toUpperCase() + weekday.slice(1)
  }
  // Mais distante: data curta DD/MM
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso))
}
