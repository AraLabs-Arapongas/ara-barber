'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import {
  requestAndSubscribe,
  unsubscribe,
  currentPermission,
  isPushSupported,
} from '@/lib/push/register'

const DISMISS_KEY = 'ara:staff-push-dismissed'

/**
 * Toggle pra staff ativar/desativar push. Mora em /admin/dashboard/mais.
 * Limpa a flag de dismiss do banner pra que o staff possa reativar caso
 * tenha dispensado antes.
 */
export function StaffPushToggle() {
  const [state, setState] = useState<'on' | 'off' | 'unsupported' | 'denied' | 'loading'>(
    'loading',
  )

  useEffect(() => {
    if (!isPushSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê capability do browser
      setState('unsupported')
      return
    }
    const perm = currentPermission()
    if (perm === 'granted') setState('on')
    else if (perm === 'denied') setState('denied')
    else setState('off')
  }, [])

  async function toggle() {
    if (state === 'on') {
      await unsubscribe()
      setState('off')
      return
    }
    if (state === 'off') {
      localStorage.removeItem(DISMISS_KEY)
      const r = await requestAndSubscribe()
      if (r.ok) setState('on')
      else if (r.reason === 'denied') setState('denied')
    }
  }

  const Icon = state === 'on' ? Bell : BellOff
  const label =
    state === 'on'
      ? 'Avisos por push ativos'
      : state === 'off'
        ? 'Ativar avisos por push'
        : state === 'denied'
          ? 'Permissão negada no navegador'
          : state === 'unsupported'
            ? 'Push não suportado neste navegador'
            : 'Carregando…'
  const hint =
    state === 'on'
      ? 'Toque pra desativar.'
      : state === 'off'
        ? 'Recebe aviso de novo agendamento.'
        : state === 'denied'
          ? 'Habilite nas configurações do navegador.'
          : state === 'unsupported'
            ? 'Tente no Chrome, Edge ou Safari PWA.'
            : ' '

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'unsupported' || state === 'denied' || state === 'loading'}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg">{label}</p>
        <p className="truncate text-[0.8125rem] text-fg-muted">{hint}</p>
      </div>
    </button>
  )
}
