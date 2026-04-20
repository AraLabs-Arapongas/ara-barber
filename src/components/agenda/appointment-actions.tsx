'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { transitionAppointmentStatus } from '@/app/salon/(authenticated)/actions/appointment-status'

type TransitionStatus = 'CONFIRMED' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW'

type Action = {
  next: TransitionStatus
  label: string
  variant: 'primary' | 'secondary' | 'destructive'
}

type Props = {
  appointmentId: string
  actions: Action[]
}

export function AppointmentActions({ appointmentId, actions }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function trigger(next: TransitionStatus) {
    setError(null)
    let reason: string | undefined
    if (next === 'CANCELED') {
      const r = window.prompt('Motivo do cancelamento (opcional):')
      if (r === null) return
      reason = r.trim() || undefined
    }
    startTransition(async () => {
      const result = await transitionAppointmentStatus({
        appointmentId,
        nextStatus: next,
        reason,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  if (actions.length === 0) {
    return (
      <p className="px-1 text-[0.8125rem] text-fg-subtle">
        Este agendamento não pode mais mudar de status.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Button
            key={a.next}
            type="button"
            variant={a.variant}
            disabled={pending}
            onClick={() => trigger(a.next)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  )
}
