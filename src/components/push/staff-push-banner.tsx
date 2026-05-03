'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requestAndSubscribe, isPushSupported, currentPermission } from '@/lib/push/register'

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
    // Tudo aqui depende de browser APIs (Notification.permission, navigator).
    // O setState síncrono é intencional — refletimos estado de uma "external
    // store" (browser API) imediatamente após mount. eslint-disable cobre isso.
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  async function enable() {
    setPending(true)
    const r = await requestAndSubscribe()
    setPending(false)
    if (r.ok) setStatus('granted')
    else if (r.reason === 'denied') setStatus('denied')
  }

  // Não renderiza nada quando: loading, sem suporte do browser, OU
  // já está com permissão concedida. Banner verde "ativos" só polui
  // a tela — o sino na home já indica o estado real.
  if (status === 'loading' || status === 'unsupported' || status === 'granted') return null

  if (status === 'denied') {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
        <BellOff className="h-4 w-4 shrink-0 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-fg">Avisos bloqueados</p>
          <p className="truncate text-[0.8125rem] text-fg-muted">
            Desbloqueie no navegador e tente de novo.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={enable} loading={pending}>
          Tentar
        </Button>
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
