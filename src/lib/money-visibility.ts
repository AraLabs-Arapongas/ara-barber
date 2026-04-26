'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ara:money-hidden'
const TOGGLE_EVENT = 'ara:money-toggle'

/**
 * Hook compartilhado pra "esconder valores financeiros" (estilo Nubank).
 * Default: hidden (mais seguro pra staff com cliente do lado).
 *
 * Sincroniza entre componentes na mesma aba via CustomEvent. Persiste
 * em localStorage entre sessões. Nunca é incluído no SSR/render inicial
 * (sempre arranca como `true` server-side; client hidrata e respeita).
 */
export function useMoneyHidden(): { hidden: boolean; toggle: () => void } {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(stored === '1')
    }

    function onToggle(e: Event) {
      const detail = (e as CustomEvent<{ hidden: boolean }>).detail
      if (detail) setHidden(detail.hidden)
    }
    window.addEventListener(TOGGLE_EVENT, onToggle)
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle)
  }, [])

  function toggle() {
    setHidden((h) => {
      const next = !h
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // localStorage pode falhar em modo privado; tudo bem.
      }
      window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: { hidden: next } }))
      return next
    })
  }

  return { hidden, toggle }
}

export const MASK = 'R$ ••••'
