'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ADMIN_TABS, findActiveTabIndex } from '@/lib/admin/tabs'

const HOME_PATH = '/admin/dashboard'

/** Min horizontal distance pra contar como swipe (em px). */
const SWIPE_THRESHOLD = 60

/** Razão dx/dy mínima — evita disparar quando o gesto é mais vertical (scroll). */
const HORIZONTAL_RATIO = 1.5

/** Tempo máximo do gesto (ms). Acima disso provavelmente não é swipe. */
const MAX_DURATION = 800

type Touch = {
  x: number
  y: number
  t: number
}

/**
 * Wrapper invisível que escuta touch gestures pra navegar:
 *
 * - **Na home (/admin/dashboard):** swipe horizontal muda o `?date=`
 *   (próximo/anterior dia). Swipe vertical não faz nada (deixa scroll).
 *
 * - **Nas outras tabs do bottom-nav:** swipe horizontal cicla entre
 *   tabs (Início → Agenda → Equipe → Serviços → Mais → Início).
 *
 * Só dispara em touch (não em mouse drag), respeita threshold de distância
 * e exige movimento predominantemente horizontal pra não conflitar com scroll.
 *
 * Renderiza só `children` — o handler vive em listeners passivos no document
 * pra cobrir a área inteira do dashboard.
 */
export function SwipeNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const startRef = useRef<Touch | null>(null)
  // Refs evitam re-attach dos listeners a cada render.
  const ctxRef = useRef({ pathname, params: searchParams?.toString() ?? '' })
  ctxRef.current = { pathname, params: searchParams?.toString() ?? '' }

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    }

    function onEnd(e: TouchEvent) {
      const start = startRef.current
      startRef.current = null
      if (!start) return
      const t = e.changedTouches[0]
      if (!t) return

      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      const duration = Date.now() - start.t

      if (adx < SWIPE_THRESHOLD) return
      if (ady > 0 && adx / ady < HORIZONTAL_RATIO) return
      if (duration > MAX_DURATION) return

      const direction: 'left' | 'right' = dx < 0 ? 'left' : 'right'
      handleSwipe(direction)
    }

    function handleSwipe(direction: 'left' | 'right') {
      const { pathname, params } = ctxRef.current

      // Home: swipe horizontal muda o dia selecionado
      if (pathname === HOME_PATH) {
        const sp = new URLSearchParams(params)
        const currentDate = sp.get('date') ?? localTodayISO()
        const next = shiftDateISO(currentDate, direction === 'left' ? 1 : -1)
        sp.set('date', next)
        router.push(`${HOME_PATH}?${sp.toString()}`)
        return
      }

      // Outras tabs: cicla pra próxima/anterior
      const idx = findActiveTabIndex(pathname)
      if (idx === -1) return // não está em uma tab principal — ignora
      const total = ADMIN_TABS.length
      const nextIdx = direction === 'left' ? (idx + 1) % total : (idx - 1 + total) % total
      router.push(ADMIN_TABS[nextIdx].href)
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [router])

  return <>{children}</>
}

function localTodayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function shiftDateISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}
