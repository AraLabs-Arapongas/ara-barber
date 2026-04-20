'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  requestAndSubscribe,
  isPushSupported,
  currentPermission,
} from '@/lib/push/register'

const DISMISS_KEY = 'ara:staff-push-dismissed'

/**
 * Banner persistente no topo da agenda staff pedindo permissão de push.
 * Some de vez após clicar X (dismiss permanente). Reativável via toggle em
 * /salon/dashboard/mais.
 */
export function StaffPushBanner() {
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    const perm = currentPermission()
    if (perm === 'granted' || perm === 'denied' || perm === 'unsupported') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reage a estado do browser
    setVisible(true)
  }, [])

  async function enable() {
    setPending(true)
    const r = await requestAndSubscribe()
    setPending(false)
    if (r.ok) setVisible(false)
    else if (r.reason === 'denied') {
      localStorage.setItem(DISMISS_KEY, '1')
      setVisible(false)
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium text-fg">Avisar quando entrar agendamento</p>
        <p className="truncate text-[0.8125rem] text-fg-muted">
          Notificação no celular em tempo real.
        </p>
      </div>
      <Button size="sm" onClick={enable} loading={pending}>
        Ativar
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
