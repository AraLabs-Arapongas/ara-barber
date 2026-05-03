'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, Copy, ExternalLink, Globe, Loader2, RefreshCw, Trash2 } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm/provider'
import {
  checkCustomDomainStatus,
  removeCustomDomain,
  setCustomDomain,
} from '@/app/admin/(authenticated)/actions/tenant-domain'

type DomainStatus = {
  verified: boolean
  configurationOk: boolean
  instructions: Array<{ type: 'CNAME' | 'A'; value: string }>
}

type Props = {
  initialDomain: string | null
  initialStatus: DomainStatus | null
}

export function CustomDomainManager({ initialDomain, initialStatus }: Props) {
  const [domain, setDomain] = useState<string | null>(initialDomain)
  const [status, setStatus] = useState<DomainStatus | null>(initialStatus)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const confirm = useConfirm()

  // Polling automático enquanto não verificou. 10s nos primeiros 5min,
  // depois para — usuário precisa clicar "Verificar" manualmente. Evita
  // bater na Vercel pra sempre se DNS nunca foi configurado.
  useEffect(() => {
    if (!domain || status?.configurationOk) return
    let attempts = 0
    const max = 30 // 30 × 10s = 5min
    const id = setInterval(async () => {
      if (attempts >= max) {
        clearInterval(id)
        return
      }
      attempts += 1
      const r = await checkCustomDomainStatus()
      if (r.ok && r.status) {
        setStatus(r.status)
        if (r.status.configurationOk) clearInterval(id)
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [domain, status?.configurationOk])

  function handleSet() {
    setError(null)
    startTransition(async () => {
      const r = await setCustomDomain({ domain: draft })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setDomain(draft.trim().toLowerCase())
      setStatus(r.status)
      setDraft('')
    })
  }

  async function handleRemove() {
    const ok = await confirm({
      title: 'Remover domínio próprio?',
      description: 'Seu site volta a usar apenas o subdomínio padrão.',
      confirmLabel: 'Remover',
      cancelLabel: 'Voltar',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const r = await removeCustomDomain()
      if (!r.ok) {
        setError(r.error)
        return
      }
      setDomain(null)
      setStatus(null)
    })
  }

  function handleRecheck() {
    setError(null)
    startTransition(async () => {
      const r = await checkCustomDomainStatus()
      if (r.ok && r.status) setStatus(r.status)
    })
  }

  // Estado 1 — sem domínio cadastrado
  if (!domain) {
    return (
      <div className="space-y-4">
        <Input
          label="Domínio próprio"
          placeholder="agendar.seusite.com.br"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          hint="Use um subdomínio do seu site (recomendado) ou um domínio dedicado."
          leftIcon={<Globe className="h-4 w-4" />}
          autoComplete="off"
          autoCapitalize="none"
        />
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button onClick={handleSet} loading={pending} disabled={!draft.trim()} fullWidth>
          Configurar domínio
        </Button>
        <p className="text-[0.75rem] text-fg-subtle">
          Depois de cadastrar, mostraremos as instruções de DNS pra você configurar no seu
          registrador. Cert SSL é provisionado automaticamente em até 5 minutos.
        </p>
      </div>
    )
  }

  // Estado 3 — verificado e OK
  if (status?.configurationOk) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-bg/30 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-medium text-fg">{domain}</p>
            <p className="text-[0.8125rem] text-fg-muted">Ativo e seguro (HTTPS).</p>
          </div>
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand-primary hover:underline"
          >
            Abrir
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <Button variant="ghost" onClick={handleRemove} loading={pending}>
          <Trash2 className="h-4 w-4" />
          Remover domínio
        </Button>
      </div>
    )
  }

  // Estado 2 — pendente (DNS não validou ainda)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle px-4 py-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium text-fg">{domain}</p>
          <p className="text-[0.8125rem] text-fg-muted">
            Aguardando DNS — verificando automaticamente.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleRecheck} loading={pending}>
          <RefreshCw className="h-3.5 w-3.5" />
          Verificar
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-[0.8125rem] font-medium text-fg">
          Adicione um destes registros no seu provedor de DNS:
        </p>
        <DnsInstructions instructions={status?.instructions ?? []} />
        <p className="text-[0.75rem] text-fg-subtle">
          Propagação leva de minutos a algumas horas. Depois que validar, o cert HTTPS é
          provisionado em até 5 minutos.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Button variant="ghost" onClick={handleRemove} loading={pending}>
        <Trash2 className="h-4 w-4" />
        Cancelar configuração
      </Button>
    </div>
  )
}

function DnsInstructions({
  instructions,
}: {
  instructions: Array<{ type: 'CNAME' | 'A'; value: string }>
}) {
  const [copied, setCopied] = useState<string | null>(null)
  if (instructions.length === 0) {
    return (
      <p className="text-[0.8125rem] text-fg-muted">
        Instruções indisponíveis no momento. Tente verificar de novo em alguns segundos.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {instructions.map((ins) => (
        <li
          key={`${ins.type}-${ins.value}`}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <span className="rounded bg-bg-subtle px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wider text-fg-muted">
            {ins.type}
          </span>
          <code className="flex-1 truncate text-[0.8125rem] text-fg">{ins.value}</code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(ins.value)
              setCopied(ins.value)
              setTimeout(() => setCopied(null), 1500)
            }}
            className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-primary hover:underline"
          >
            <Copy className="h-3 w-3" />
            {copied === ins.value ? 'Copiado!' : 'Copiar'}
          </button>
        </li>
      ))}
    </ul>
  )
}
