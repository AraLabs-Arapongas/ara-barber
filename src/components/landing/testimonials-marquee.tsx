'use client'

import { useRef, useState, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

/**
 * Wrapper de letreiro com scroll manual.
 *
 * Estados:
 *  - idle: animação CSS rolando o conteúdo
 *  - interacting: animação pausada + overflow-x-auto pra usuário arrastar
 *
 * Como funciona o "swap": no momento que o usuário toca/passa mouse, a
 * gente captura o `transform` atual da animação, copia ele pra
 * scrollLeft do container, pausa a animação, e libera o scroll. Quando
 * o ponteiro sai, recolocamos o conteúdo na posição correspondente
 * (transform = -scrollLeft) e religamos a animação. Sem isso, o swap
 * causa "jump" porque scroll e transform são eixos independentes.
 */
export function TestimonialsMarquee({ children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLUListElement>(null)
  const [interacting, setInteracting] = useState(false)

  function snapshotTransformToScroll() {
    const wrapper = wrapperRef.current
    const inner = innerRef.current
    if (!wrapper || !inner) return
    // Pega transform atual da animação CSS.
    const m = new DOMMatrixReadOnly(getComputedStyle(inner).transform)
    const x = -m.m41 // translateX é negativo (-50% direção)
    // Zera o transform e usa scrollLeft pra "manter posição visual".
    inner.style.transform = 'translateX(0)'
    wrapper.scrollLeft = x
  }

  function snapshotScrollToTransform() {
    const wrapper = wrapperRef.current
    const inner = innerRef.current
    if (!wrapper || !inner) return
    const x = wrapper.scrollLeft
    wrapper.scrollLeft = 0
    inner.style.transform = `translateX(${-x}px)`
  }

  function onEnter() {
    if (interacting) return
    snapshotTransformToScroll()
    setInteracting(true)
  }

  function onLeave() {
    if (!interacting) return
    snapshotScrollToTransform()
    // Limpa o style.transform inline pra animação CSS reassumir o controle.
    requestAnimationFrame(() => {
      if (innerRef.current) innerRef.current.style.transform = ''
    })
    setInteracting(false)
  }

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={onEnter}
      onPointerDown={onEnter}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
      onTouchEnd={onLeave}
      data-interacting={interacting || undefined}
      className="relative -mx-6 overflow-hidden data-[interacting]:overflow-x-auto sm:-mx-10"
      style={{
        maskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)',
        scrollbarWidth: 'none',
      }}
    >
      <ul
        ref={innerRef}
        className="flex w-max gap-5 px-6 pb-4 motion-safe:animate-marquee-x sm:gap-8 sm:px-10 [[data-interacting]_&]:[animation-play-state:paused]"
      >
        {children}
      </ul>
    </div>
  )
}
