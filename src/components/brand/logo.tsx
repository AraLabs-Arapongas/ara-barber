import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wordmark "Ara Barber" composto em Fraunces.
 * O ornamento tipográfico (dois pontos + ponto fino) evoca
 * a barra do barber pole sem cair no clichê.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-display text-[1.375rem] font-semibold tracking-tight text-fg',
        className,
      )}
      aria-label="Ara Barber"
    >
      <span>Ara</span>
      <span
        className="mx-1.5 inline-block h-[0.35em] w-[0.35em] rounded-full bg-brand-accent"
        aria-hidden="true"
      />
      <span className="italic" style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}>
        Barber
      </span>
    </span>
  )
}

/**
 * Monograma "AB" — ícone quadrado, serifa com SOFT alto, bg petróleo.
 */
export function Monogram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-10 w-10', className)}
      role="img"
      aria-label="Ara Barber monograma"
      {...props}
    >
      <rect width="64" height="64" rx="16" fill="var(--brand-primary)" />
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--brand-primary-fg)"
        fontFamily="var(--font-display)"
        fontWeight="600"
        fontSize="28"
        letterSpacing="-0.04em"
        fontStyle="italic"
        style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" } as React.CSSProperties}
      >
        Ab
      </text>
      <circle cx="52" cy="18" r="2.5" fill="var(--brand-accent)" />
    </svg>
  )
}

/**
 * Ornamento decorativo — listras diagonais warm (referência ao barber pole
 * reinterpretada em paleta quente). Usado como pano de fundo do painel esquerdo
 * do login desktop. Não aparece em mobile.
 */
export function BarberStripeOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid slice"
      className={cn('absolute inset-0 h-full w-full', className)}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="stripe"
          patternUnits="userSpaceOnUse"
          width="64"
          height="64"
          patternTransform="rotate(22)"
        >
          <rect width="64" height="64" fill="transparent" />
          <rect x="0" y="0" width="20" height="64" fill="var(--brand-accent)" opacity="0.09" />
          <rect x="32" y="0" width="4" height="64" fill="var(--brand-primary)" opacity="0.06" />
        </pattern>
        <radialGradient id="fade" cx="30%" cy="40%" r="70%">
          <stop offset="0%" stopColor="var(--color-bg)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--color-bg)" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#stripe)" />
      <rect width="100%" height="100%" fill="url(#fade)" />
    </svg>
  )
}

/**
 * Glifo ornamental — um "pente tipográfico" feito de linhas finas,
 * referência sutil à barbearia sem representação literal.
 */
export function ComboGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      className={cn('h-40 w-30', className)}
      aria-hidden="true"
      fill="none"
    >
      <g stroke="var(--brand-primary)" strokeWidth="1.25" strokeLinecap="round">
        {/* corpo do pente */}
        <path
          d="M10 20 Q60 8 110 20 L110 60 Q60 72 10 60 Z"
          fill="var(--brand-accent)"
          fillOpacity="0.18"
        />
        {/* dentes */}
        {Array.from({ length: 14 }).map((_, i) => {
          const x = 14 + i * 7
          return <line key={i} x1={x} y1="60" x2={x} y2={130 - (i % 2) * 8} />
        })}
      </g>
    </svg>
  )
}
