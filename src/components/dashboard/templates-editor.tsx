'use client'

import { Fragment, useState, useTransition } from 'react'

import { upsertTemplate, type UpsertTemplateInput } from '@/app/admin/(authenticated)/actions/templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type TemplateRow = {
  channel: 'EMAIL' | 'WHATSAPP'
  event: UpsertTemplateInput['event']
  enabled: boolean
  subject: string | null
  body: string
}

const EVENT_LABELS: Record<UpsertTemplateInput['event'], string> = {
  BOOKING_CONFIRMATION: 'Confirmação de agendamento',
  BOOKING_CANCELLATION: 'Cancelamento de agendamento',
  BOOKING_REMINDER: 'Lembrete antes do horário',
  BOOKING_THANKS: 'Agradecimento pós-atendimento',
  SHARE_LINK: 'Compartilhar link de agendamento',
  CUSTOM: 'Mensagem personalizada',
}

/**
 * Placeholders aceitos pelos templates. `applyTemplate` (ver
 * src/lib/contact/whatsapp.ts) substitui `{chave}` pelos valores
 * fornecidos em runtime; placeholders sem valor permanecem literais.
 */
const PLACEHOLDERS = ['{nome}', '{servico}', '{horario}', '{profissional}', '{link}'] as const

export function TemplatesEditor({
  channel,
  templates,
}: {
  channel: 'EMAIL' | 'WHATSAPP'
  templates: TemplateRow[]
}) {
  return (
    <div className="space-y-4">
      <p className="text-[0.8125rem] text-fg-muted">
        Placeholders disponíveis:{' '}
        {PLACEHOLDERS.map((p, idx) => (
          <Fragment key={p}>
            {idx > 0 ? ' ' : null}
            <code className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[0.75rem]">
              {p}
            </code>
          </Fragment>
        ))}
      </p>
      {templates.map((t) => (
        <TemplateCard key={`${t.channel}-${t.event}`} channel={channel} initial={t} />
      ))}
    </div>
  )
}

function TemplateCard({
  channel,
  initial,
}: {
  channel: 'EMAIL' | 'WHATSAPP'
  initial: TemplateRow
}) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [body, setBody] = useState(initial.body)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function save() {
    setMsg(null)
    startTransition(async () => {
      const result = await upsertTemplate({
        channel,
        event: initial.event,
        enabled,
        subject: channel === 'EMAIL' ? subject : '',
        body,
      })
      if (result.ok) {
        setMsg({ kind: 'ok', text: 'Salvo!' })
      } else {
        setMsg({ kind: 'error', text: result.error })
      }
    })
  }

  return (
    <Card className="shadow-xs">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-fg">
            {EVENT_LABELS[initial.event] ?? initial.event}
          </h3>
          <label className="flex shrink-0 items-center gap-2 text-[0.8125rem] text-fg-muted">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-brand-primary"
            />
            <span>{enabled ? 'Ativo' : 'Desativado'}</span>
          </label>
        </div>

        {channel === 'EMAIL' ? (
          <Input
            placeholder="Assunto do e-mail"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
        ) : null}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === 'EMAIL' ? 6 : 4}
          maxLength={2000}
          placeholder="Mensagem"
          className={cn(
            'w-full rounded-lg border border-transparent bg-bg-subtle px-3 py-2 text-[0.875rem] font-mono text-fg',
            'placeholder:text-fg-subtle',
            'focus:outline-none focus:border-brand-primary focus:bg-surface-raised',
            'focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--brand-accent)_22%,transparent)]',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-out',
          )}
        />

        <div className="flex items-center justify-between gap-3">
          {msg ? (
            <span
              className={cn(
                'text-[0.8125rem]',
                msg.kind === 'error' ? 'text-error' : 'text-fg-muted',
              )}
            >
              {msg.text}
            </span>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={save} loading={pending} loadingText="Salvando…">
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
