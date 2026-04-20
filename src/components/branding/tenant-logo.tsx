import Image from 'next/image'
import { cn } from '@/lib/utils'

type Props = {
  logoUrl: string | null
  name: string
  size?: number
  className?: string
}

/**
 * Logo do tenant. Se não houver `logoUrl`, renderiza fallback com as duas
 * primeiras letras do nome em cima da cor primária do tenant (--brand-primary).
 */
export function TenantLogo({ logoUrl, name, size = 48, className }: Props) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className={cn('h-auto max-w-full rounded-xl object-contain', className)}
        priority
      />
    )
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div
      className={cn(
        'flex aspect-square max-w-full items-center justify-center rounded-xl',
        'bg-brand-primary text-brand-primary-fg font-display font-semibold',
        className,
      )}
      style={{
        width: size,
        fontSize: Math.round(size * 0.42),
      }}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
