import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  label?: string
  variant?: 'ghost' | 'secondary'
  size?: 'sm' | 'md'
}

/**
 * Botão "Sair" que POSTa em /auth/logout (route handler existente limpa cookies
 * e redireciona pra raiz via 303). Form nativo — zero JS necessário.
 */
export function LogoutButton({ label = 'Sair', variant = 'ghost', size = 'sm' }: Props) {
  return (
    <form action="/auth/logout" method="post" className="inline-flex">
      <Button type="submit" variant={variant} size={size}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    </form>
  )
}
