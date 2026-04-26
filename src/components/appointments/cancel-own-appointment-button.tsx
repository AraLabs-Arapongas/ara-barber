'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { useConfirm } from '@/components/ui/confirm/provider'
import { cancelCustomerAppointment } from '@/lib/appointments/server-actions'

type Props = {
  appointmentId: string
  cancellationWindowHours: number
}

export function CancelOwnAppointmentButton({ appointmentId, cancellationWindowHours }: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    const ok = await confirm({
      title: 'Cancelar esta reserva?',
      description: `Só é possível cancelar até ${cancellationWindowHours}h antes do horário. Seu horário será liberado pra outros clientes.`,
      confirmLabel: 'Cancelar reserva',
      cancelLabel: 'Voltar',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await cancelCustomerAppointment({ appointmentId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/meus-agendamentos')
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Button
        variant="destructive"
        fullWidth
        onClick={handleCancel}
        loading={pending}
        loadingText="Cancelando..."
      >
        <X className="h-4 w-4" />
        Cancelar reserva
      </Button>
    </div>
  )
}
