'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import {
  requestAndSubscribe,
  unsubscribe,
  currentPermission,
  isPushSupported,
} from '@/lib/push/register'

type State = 'on' | 'off' | 'unsupported' | 'denied' | 'loading' | 'pending'

/**
 * Toggle pra staff ativar/desativar push. Mora em /admin/dashboard/mais.
 * Surface de erros: se falhar (SW, VAPID, save no DB, auto-block do Chrome
 * após 2 dismisses), exibe mensagem em vez de silêncio.
 */
export function StaffPushToggle() {
  const [state, setState] = useState<State>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
    setErrorMsg(null)
    if (state === 'on') {
      setState('pending')
      await unsubscribe()
      setState('off')
      return
    }
    if (state === 'off') {
      setState('pending')
      const r = await requestAndSubscribe()
      // Re-lê permission depois — Chrome pode ter virado pra denied silenciosamente
      const perm = currentPermission()
      if (r.ok) {
        setState('on')
      } else if (r.reason === 'denied' || perm === 'denied') {
        setState('denied')
      } else {
        setState('off')
        setErrorMsg(r.error ?? 'Não foi possível ativar. Tente recarregar a página.')
        console.error('[push] subscribe failed', r)
      }
    }
  }

  const isPending = state === 'pending'
  const Icon = state === 'on' ? Bell : isPending ? Loader2 : BellOff
  const label =
    state === 'on'
      ? 'Avisos por push ativos'
      : state === 'off'
        ? 'Ativar avisos por push'
        : state === 'denied'
          ? 'Permissão negada no navegador'
          : state === 'unsupported'
            ? 'Push não suportado neste navegador'
            : state === 'pending'
              ? 'Ativando…'
              : 'Carregando…'
  const hint =
    state === 'on'
      ? 'Toque pra desativar.'
      : state === 'off'
        ? errorMsg ?? 'Recebe aviso de novo agendamento.'
        : state === 'denied'
          ? 'Habilite nas configurações do navegador (cadeado/site settings) e recarregue a página.'
          : state === 'unsupported'
            ? 'Tente no Chrome, Edge ou Safari PWA.'
            : state === 'pending'
              ? 'Aguarde…'
              : ' '

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'unsupported' || state === 'denied' || state === 'loading' || isPending}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-subtle disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted">
        <Icon className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg">{label}</p>
        <p className={`truncate text-[0.8125rem] ${errorMsg ? 'text-error' : 'text-fg-muted'}`}>
          {hint}
        </p>
      </div>
    </button>
  )
}
