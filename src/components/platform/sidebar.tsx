'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Wallet, Users, FileText } from 'lucide-react'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenants', label: 'Tenants', icon: Building2 },
  { href: '/plans', label: 'Plans', icon: Wallet },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/audit', label: 'Audit', icon: FileText },
] as const

export function PlatformSidebar() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[0.875rem] transition-colors ${
              active ? 'bg-bg text-fg font-medium' : 'text-fg-muted hover:bg-bg hover:text-fg'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
