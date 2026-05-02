'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, CalendarOff } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { ConfirmAppointmentInline } from '@/components/dashboard/confirm-appointment-inline'

export type PendingAppointment = {
  id: string
  startAtISO: string
  serviceName: string | null
  customerName: string | null
  professionalName: string | null
}

export type AttentionItem = {
  kind: 'no-schedule'
  professionalId: string
  professionalName: string
}

type Props = {
  pending: PendingAppointment[]
  attention: AttentionItem[]
  tenantTimezone: string
}

/**
 * Sino do header da home staff. Badge mostra count total de coisas
 * pra resolver (pendentes de confirmação + items de atenção).
 * Click abre BottomSheet com inbox unificado.
 *
 * Server fetcha os dados, este componente client só lida com a UI
 * de toggle + ações (confirmar inline, navegar pro detalhe/profissional).
 */
export function NotificationBell({ pending, attention, tenantTimezone }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const total = pending.length + attention.length
  const hasAlerts = total > 0

  const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tenantTimezone,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  function close() {
    setOpen(false)
    // Re-busca server data após confirmar/navegar
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 w-10 items-center justify-center text-fg-muted transition-colors hover:text-fg"
        aria-label={
          hasAlerts
            ? `${total} ${total === 1 ? 'notificação' : 'notificações'}`
            : 'Notificações (nenhuma)'
        }
      >
        {hasAlerts ? (
          <BellRing className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Bell className="h-5 w-5" aria-hidden="true" />
        )}
        {hasAlerts ? (
          <span
            className="absolute right-1 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[0.625rem] font-semibold leading-none text-warning-fg"
            aria-hidden="true"
          >
            {total > 9 ? '9+' : total}
          </span>
        ) : null}
      </button>

      <BottomSheet
        open={open}
        onClose={close}
        title={hasAlerts ? `${total} pra resolver` : 'Tudo em dia'}
        description={
          hasAlerts
            ? 'Confirmações e pendências precisam da sua atenção.'
            : 'Nenhuma confirmação ou pendência no momento.'
        }
      >
        {pending.length > 0 ? (
          <section className="mb-5">
            <h3 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-warning">
              Precisam confirmar ({pending.length})
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {pending.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-3 first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium text-fg">
                      {a.serviceName ?? 'Serviço'}
                    </p>
                    <p className="truncate text-[0.75rem] text-fg-muted">
                      {dateTimeFmt.format(new Date(a.startAtISO))} · {a.customerName ?? 'cliente'}
                      {a.professionalName ? ` · ${a.professionalName}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ConfirmAppointmentInline appointmentId={a.id} />
                    <Link
                      href={`/admin/dashboard/agenda/${a.id}`}
                      onClick={close}
                      className="rounded-md px-2 py-1 text-[0.75rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
                      aria-label="Ver detalhe"
                    >
                      Ver
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {attention.length > 0 ? (
          <section className="mb-2">
            <h3 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-fg-subtle">
              Atenção ({attention.length})
            </h3>
            <ul className="space-y-2">
              {attention.map((item) => (
                <li key={`no-schedule-${item.professionalId}`}>
                  <Link
                    href={`/admin/dashboard/profissionais/${item.professionalId}`}
                    onClick={close}
                    className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-3 transition-colors hover:bg-warning-bg/40"
                  >
                    <CalendarOff
                      className="h-4 w-4 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <p className="text-[0.875rem] text-fg">
                      <span className="font-medium">{item.professionalName}</span> está sem
                      horário configurado.
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!hasAlerts ? (
          <p className="py-6 text-center text-[0.875rem] text-fg-muted">
            Quando aparecer algo novo (confirmação pendente, profissional sem horário, etc.), você
            verá aqui.
          </p>
        ) : null}
      </BottomSheet>
    </>
  )
}
