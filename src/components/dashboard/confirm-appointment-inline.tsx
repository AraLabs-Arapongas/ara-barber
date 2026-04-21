'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { transitionAppointmentStatus } from '@/app/salon/(authenticated)/actions/appointment-status'

type Props = {
  appointmentId: string
}

/**
 * Botão inline usado na home do staff pra confirmar um agendamento
 * SCHEDULED em um toque, sem abrir o detalhe. Reusa a server action
 * existente de transição de status.
 */
export function ConfirmAppointmentInline({ appointmentId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    startTransition(async () => {
      const result = await transitionAppointmentStatus({
        appointmentId,
        nextStatus: 'CONFIRMED',
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={error ?? undefined}
      aria-label="Confirmar agendamento"
      className="inline-flex items-center gap-1 rounded-md bg-brand-primary px-2.5 py-1.5 text-[0.75rem] font-medium text-brand-primary-fg transition-opacity hover:brightness-110 disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      {pending ? 'Confirmando...' : 'Confirmar'}
    </button>
  )
}
