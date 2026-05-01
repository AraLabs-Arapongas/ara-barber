'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** px por frame (~60fps). 0.5 = lento e elegante; 1 = mais ágil. */
  speed?: number
}

/**
 * Letreiro contínuo via animação de `scrollLeft` (não transform).
 *
 * Por que scrollLeft em vez de translateX:
 *   - Scroll do usuário e animação ficam no MESMO eixo, então o
 *     usuário pode arrastar/swipe sem brigar com a animação.
 *   - Pausar é trivial: só parar o requestAnimationFrame.
 *   - Sem máscaras vs. interação ambígua.
 *
 * Loop: o conteúdo é duplicado (lado a lado). Quando scrollLeft chega
 * em scrollWidth/2, voltamos pro começo subtraindo half — visualmente
 * idêntico (lista 2 = lista 1).
 *
 * Pausa em: hover (mouse) e touch ativo. Volta quando solta.
 */
export function TestimonialsMarquee({ children, speed = 0.5 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const el = ref.current
    if (!el) return
    // Respeita prefers-reduced-motion: para a animação, mas mantém scroll manual.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let rafId = 0
    const tick = () => {
      const half = el.scrollWidth / 2
      if (half > 0) {
        el.scrollLeft += speed
        if (el.scrollLeft >= half) el.scrollLeft -= half
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [paused, speed])

  return (
    <div
      ref={ref}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}
      className="-mx-6 overflow-x-auto sm:-mx-10"
      style={{
        maskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
        scrollbarWidth: 'none',
      }}
    >
      <ul className="flex w-max gap-5 px-6 pb-4 sm:gap-8 sm:px-10">{children}</ul>
    </div>
  )
}
