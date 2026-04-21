import { cn } from '@/lib/utils'

type Props = {
  name: string
  size?: number
  className?: string
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function InitialsAvatar({ name, size = 40, className }: Props) {
  const initials = deriveInitials(name)
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
