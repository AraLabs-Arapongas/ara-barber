'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { CalendarX, Plus, Trash2, Building2, User } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/confirm/provider'
import { createBlock, deleteBlock } from '@/app/admin/(authenticated)/actions/blocks'

export type BlockRow = {
  id: string
  professionalId: string | null
  startAt: string
  endAt: string
  reason: string | null
}

export type ProfessionalRow = { id: string; name: string }

type Props = {
  blocks: BlockRow[]
  professionals: ProfessionalRow[]
  tenantTimezone: string
  initialNew: boolean
  initialProfessional: string | null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BlocksManager({
  blocks,
  professionals,
  tenantTimezone,
  initialNew,
  initialProfessional,
}: Props) {
  const router = useRouter()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(initialNew)
  const [scope, setScope] = useState<'TENANT' | 'PROFESSIONAL'>(
    initialProfessional ? 'PROFESSIONAL' : 'TENANT',
  )
  const [professionalId, setProfessionalId] = useState<string>(
    initialProfessional ?? '',
  )
  const [defaultStart] = useState(() => toLocalInput(new Date()))
  const [defaultEnd] = useState(() =>
    toLocalInput(new Date(Date.now() + 2 * 86400000)),
  )
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const startStr = String(fd.get('startAt') ?? '')
    const endStr = String(fd.get('endAt') ?? '')
    const reason = String(fd.get('reason') ?? '').trim() || undefined

    if (!startStr || !endStr) {
      setError('Preencha início e fim.')
      return
    }
    if (new Date(startStr) >= new Date(endStr)) {
      setError('Início deve ser antes do fim.')
      return
    }
    if (scope === 'PROFESSIONAL' && !professionalId) {
      setError('Selecione um profissional.')
      return
    }

    startTransition(async () => {
      const result = await createBlock({
        scope,
        professionalId: scope === 'PROFESSIONAL' ? professionalId : undefined,
        startAtISO: new Date(startStr).toISOString(),
        endAtISO: new Date(endStr).toISOString(),
        reason,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setShowForm(false)
      form.reset()
      router.refresh()
    })
  }

  async function handleRemove(id: string) {
    const ok = await confirm({
      title: 'Excluir este bloqueio?',
      description:
        'Os horários voltam a aceitar reservas no período bloqueado.',
      confirmLabel: 'Excluir',
      destructive: true,
    })
    if (!ok) return
    startTransition(async () => {
      const result = await deleteBlock({ id })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function fmtRange(b: BlockRow): string {
    const fmt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tenantTimezone,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${fmt.format(new Date(b.startAt))} → ${fmt.format(new Date(b.endAt))}`
  }

  function profLabel(id: string | null): string {
    if (id === null) return 'Negócio inteiro'
    return professionals.find((p) => p.id === id)?.name ?? 'Profissional removido'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {showForm ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowForm(false)
              setError(null)
            }}
          >
            Cancelar
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setError(null)
              setShowForm(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo bloqueio
          </Button>
        )}
      </div>

      {showForm ? (
        <Card className="shadow-xs">
          <CardContent className="py-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <span className="mb-1.5 block text-[0.8125rem] font-medium text-fg">
                  Aplicar a
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('TENANT')}
                    aria-pressed={scope === 'TENANT'}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[0.875rem] transition-colors ${
                      scope === 'TENANT'
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-border bg-bg-subtle text-fg-muted hover:bg-surface-raised'
                    }`}
                  >
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Negócio inteiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('PROFESSIONAL')}
                    aria-pressed={scope === 'PROFESSIONAL'}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[0.875rem] transition-colors ${
                      scope === 'PROFESSIONAL'
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-border bg-bg-subtle text-fg-muted hover:bg-surface-raised'
                    }`}
                  >
                    <User className="h-4 w-4" aria-hidden="true" />
                    Um profissional
                  </button>
                </div>
              </div>

              {scope === 'PROFESSIONAL' ? (
                <div>
                  <label
                    htmlFor="block-professional"
                    className="mb-1.5 block text-[0.8125rem] font-medium text-fg"
                  >
                    Profissional
                  </label>
                  <select
                    id="block-professional"
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                    className="h-11 w-full rounded-lg border border-transparent bg-bg-subtle px-3 text-[0.9375rem] text-fg focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
                  >
                    <option value="">Selecione…</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Início"
                  name="startAt"
                  type="datetime-local"
                  defaultValue={defaultStart}
                  required
                />
                <Input
                  label="Fim"
                  name="endAt"
                  type="datetime-local"
                  defaultValue={defaultEnd}
                  required
                />
              </div>

              <Input
                label="Motivo (opcional)"
                name="reason"
                placeholder="Feriado, férias, evento..."
                maxLength={200}
              />

              {error ? <Alert variant="error">{error}</Alert> : null}

              <div className="flex justify-end pt-1">
                <Button type="submit" loading={pending}>
                  Criar bloqueio
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!showForm && error ? <Alert variant="error">{error}</Alert> : null}

      {blocks.length === 0 ? (
        <Card className="shadow-xs">
          <CardContent className="py-10 text-center">
            <p className="text-[0.9375rem] text-fg-muted">
              Nenhum bloqueio futuro. Use o botão acima pra criar um.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.id}>
              <Card className="shadow-xs">
                <CardContent className="flex items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-bg text-warning">
                      {b.professionalId === null ? (
                        <Building2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CalendarX className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">
                        {profLabel(b.professionalId)}
                      </p>
                      <p className="text-[0.8125rem] text-fg-muted">
                        {fmtRange(b)}
                      </p>
                      {b.reason ? (
                        <p className="text-[0.8125rem] italic text-fg-muted">
                          {b.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(b.id)}
                    disabled={pending}
                    className="shrink-0 rounded-md p-2 text-fg-subtle transition-colors hover:bg-error-bg hover:text-error disabled:opacity-50"
                    aria-label="Excluir bloqueio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
