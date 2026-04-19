import Link from 'next/link'
import { AraLabsMark, AraLabsWordmark } from '@/components/brand/logo'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Quando false, não renderiza (usado no futuro pra white-label premium). */
  enabled?: boolean
}

const HREF = 'https://aralabs.com.br'
const ARIA = 'Desenvolvido por AraLabs'

/**
 * Atribuição AraLabs única em todas as telas:
 * "Desenvolvido por [mark][aralabs wordmark]".
 *
 * Tipografia e logos ampliados em ~80% vs footer padrão.
 */
export function AraLabsAttribution({ className, enabled = true }: Props) {
  if (!enabled) return null

  return (
    <Link
      href={HREF}
      aria-label={ARIA}
      className={cn(
        'group inline-flex flex-wrap items-center justify-center gap-y-1',
        'text-[0.8125rem] text-fg-muted sm:text-[0.875rem]',
        'transition-colors hover:text-fg',
        className,
      )}
    >
      <span>Desenvolvido por&nbsp;</span>
      <span className="inline-flex items-center">
        <AraLabsMark
          className="h-5 w-auto text-fg-muted transition-colors group-hover:text-brand-primary sm:h-6"
          aria-hidden="true"
        />
        <AraLabsWordmark
          className="h-3.5 w-auto text-fg-muted transition-colors group-hover:text-brand-primary sm:h-4"
          aria-hidden="true"
        />
      </span>
    </Link>
  )
}
