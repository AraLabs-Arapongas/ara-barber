'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  requestAndSubscribe,
  isPushSupported,
  currentPermission,
} from '@/lib/push/register'

type Status = 'loading' | 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * Banner persistente no topo da agenda staff pedindo permissão de push.
 * Sempre visível enquanto não tiver subscription ativa, sem dismiss permanente
 * (o user perdia o caminho pra reativar). Quando perm já é `granted`, tenta
 * re-registrar subscription silenciosamente (self-heal pra casos onde a
 * subscription server-side foi perdida).
 */
export function StaffPushBanner() {
  const [status, setStatus] = useState<Status>('loading')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    const perm = currentPermission()
    if (perm === 'granted') {
      // Self-heal: garante que existe subscription server-side mesmo se já tinha
      // dado permissão antes (subscription pode ter sido perdida em rebuild,
      // troca de browser etc). Idempotente.
      void requestAndSubscribe().then((r) => {
        setStatus(r.ok ? 'granted' : 'default')
      })
      return
    }
    if (perm === 'denied') setStatus('denied')
    else if (perm === 'unsupported') setStatus('unsupported')
    else setStatus('default')
  }, [])

  async function enable() {
    setPending(true)
    const r = await requestAndSubscribe()
    setPending(false)
    if (r.ok) setStatus('granted')
    else if (r.reason === 'denied') setStatus('denied')
  }

  if (status === 'loading' || status === 'unsupported') return null

  if (status === 'granted') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success-bg px-4 py-2.5 text-[0.8125rem] text-success">
        <Check className="h-4 w-4 shrink-0" />
        <span>Avisos ativos neste aparelho.</span>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
        <BellOff className="h-4 w-4 shrink-0 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-fg">Avisos bloqueados</p>
          <p className="truncate text-[0.8125rem] text-fg-muted">
            Libere notificação nas configs do navegador.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
      <Bell className="h-4 w-4 shrink-0 text-brand-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium text-fg">Avisar quando entrar agendamento</p>
        <p className="truncate text-[0.8125rem] text-fg-muted">
          Notificação no celular em tempo real.
        </p>
      </div>
      <Button size="sm" onClick={enable} loading={pending}>
        Ativar
      </Button>
    </div>
  )
}
