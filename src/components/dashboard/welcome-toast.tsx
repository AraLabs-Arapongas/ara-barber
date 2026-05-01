'use client'

import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function WelcomeToast({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="mb-4 border-brand-primary/30 bg-brand-primary/5">
      <CardContent className="flex items-start gap-3 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary text-[1rem]">
          🎉
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1rem] font-semibold text-fg">
            Pronto! Sua agenda tá no ar.
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
            Compartilhe seu link com clientes:
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
            <span className="flex-1 truncate text-[0.8125rem] font-mono text-fg">{url}</span>
            <button
              onClick={copy}
              className="shrink-0 rounded-md bg-brand-primary px-3 py-1 text-[0.75rem] font-medium text-bg hover:opacity-90"
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Copiado
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </span>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={() => setHidden(true)}
          className="shrink-0 rounded p-1 text-fg-muted hover:bg-bg-subtle"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
