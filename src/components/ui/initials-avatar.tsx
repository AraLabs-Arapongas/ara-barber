import { cn } from '@/lib/utils'

type Props = {
  name: string
  /** Quando setado, mostra a foto em vez das iniciais. */
  photoUrl?: string | null
  size?: number
  className?: string
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

/**
 * Avatar circular: mostra `photoUrl` se houver, senão iniciais em
 * pílula da cor primária. `<img>` cru em vez de next/image porque o
 * componente é usado em listas curtas (5-15 items) e não compensa
 * o overhead do loader pra esse volume.
 */
export function InitialsAvatar({ name, photoUrl, size = 40, className }: Props) {
  const initials = deriveInitials(name)

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        'bg-brand-primary text-brand-primary-fg font-display font-semibold',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}
