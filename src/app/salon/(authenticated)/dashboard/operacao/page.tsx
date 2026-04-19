'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ChevronLeft, KeyRound, Shield, Monitor } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

function hashPin(pin: string): string {
  // Mock hash — só pra não exibir o PIN claro no localStorage.
  let h = 0
  for (let i = 0; i < pin.length; i++) {
    h = (h << 5) - h + pin.charCodeAt(i)
    h |= 0
  }
  return `mock_${Math.abs(h).toString(36)}`
}

export default function OperacaoPage() {
  const tenantSlug = useTenantSlug()
  const { data: mode, setData } = useMockStore(
    tenantSlug,
    ENTITY.operationMode.key,
    ENTITY.operationMode.schema,
    ENTITY.operationMode.seed,
  )
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const pin = String(fd.get('pin') ?? '').trim()
    const confirm = String(fd.get('confirm') ?? '').trim()
    if (pin.length < 4) {
      setMessage({ kind: 'error', text: 'PIN precisa de pelo menos 4 dígitos.' })
      return
    }
    if (pin !== confirm) {
      setMessage({ kind: 'error', text: 'PINs não batem.' })
      return
    }
    setData({ pinHash: hashPin(pin), enabled: true })
    setMessage({ kind: 'success', text: 'PIN configurado. Modo operação ativo.' })
    e.currentTarget.reset()
  }

  function disable() {
    if (!window.confirm('Desabilitar modo operação? O PIN será apagado.')) return
    setData({ pinHash: null, enabled: false })
    setMessage({ kind: 'success', text: 'Modo operação desabilitado.' })
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
      <Link
        href="/salon/dashboard/mais"
        className="mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>

      <header className="mb-6">
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
          Operação
        </p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
          Modo operação
        </h1>
        <p className="mt-1 text-[0.875rem] text-fg-muted">
          Tablet/caixa com PIN para a equipe gerenciar a agenda sem precisar de login completo.
        </p>
      </header>

      <Card className="mb-4 shadow-xs">
        <CardContent className="flex items-start gap-3 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-subtle text-fg-muted">
            {mode.enabled ? (
              <Shield className="h-5 w-5 text-success" aria-hidden="true" />
            ) : (
              <Monitor className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">
              {mode.enabled ? 'Ativado' : 'Desativado'}
            </p>
            <p className="text-[0.8125rem] text-fg-muted">
              {mode.enabled
                ? 'Equipe pode usar o tablet com PIN curto sem logar com email/senha.'
                : 'Ative abaixo configurando um PIN de 4 a 8 dígitos.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5">
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label={mode.enabled ? 'Novo PIN' : 'PIN'}
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              minLength={4}
              maxLength={8}
              placeholder="••••"
              required
              leftIcon={<KeyRound className="h-4 w-4" />}
              hint="De 4 a 8 dígitos."
            />
            <Input
              label="Confirmar PIN"
              name="confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              minLength={4}
              maxLength={8}
              placeholder="••••"
              required
            />

            {message ? (
              <Alert variant={message.kind}>{message.text}</Alert>
            ) : null}

            <Button type="submit" size="lg" fullWidth>
              {mode.enabled ? 'Trocar PIN' : 'Ativar modo operação'}
            </Button>

            {mode.enabled ? (
              <Button type="button" variant="destructive" fullWidth onClick={disable}>
                Desabilitar
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
