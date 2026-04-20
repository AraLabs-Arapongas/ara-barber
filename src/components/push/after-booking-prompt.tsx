'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import {
  requestAndSubscribe,
  currentPermission,
  isPushSupported,
} from '@/lib/push/register'

type Props = {
  /**
   * Quando true, o prompt é elegível pra aparecer. O componente decide
   * internamente se realmente mostra (depende de suporte + permissão atual).
   */
  trigger: boolean
  onDone: () => void
}

/**
 * Prompt que aparece logo após o cliente confirmar uma reserva, pedindo
 * permissão de push. Se o browser não suporta ou já decidiu (granted/denied),
 * dispara `onDone` imediatamente sem mostrar a sheet.
 */
export function AfterBookingPushPrompt({ trigger, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!trigger) return
    if (!isPushSupported()) {
      onDone()
      return
    }
    const perm = currentPermission()
    if (perm === 'granted' || perm === 'denied' || perm === 'unsupported') {
      onDone()
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reage ao trigger vindo do pai
    setOpen(true)
  }, [trigger, onDone])

  async function enable() {
    setPending(true)
    await requestAndSubscribe()
    setPending(false)
    setOpen(false)
    onDone()
  }

  function later() {
    setOpen(false)
    onDone()
  }

  if (!open) return null

  return (
    <BottomSheet
      open={open}
      onClose={later}
      title="Receber avisos do salão"
      description="Confirmação e lembretes direto no seu celular."
    >
      <div className="space-y-3 pb-2">
        <Button fullWidth onClick={enable} loading={pending}>
          Ativar avisos
        </Button>
        <Button variant="secondary" fullWidth onClick={later} disabled={pending}>
          Agora não
        </Button>
      </div>
    </BottomSheet>
  )
}
