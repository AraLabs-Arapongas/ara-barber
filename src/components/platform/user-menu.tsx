'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

export function PlatformUserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.875rem] text-fg hover:bg-bg-subtle"
      >
        <span className="font-medium">{name}</span>
        <span className="text-fg-muted">▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-bg shadow-lg">
          <div className="border-b border-border px-3 py-2 text-[0.75rem] text-fg-muted">
            {email}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-[0.875rem] text-fg hover:bg-bg-subtle"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      ) : null}
    </div>
  )
}
