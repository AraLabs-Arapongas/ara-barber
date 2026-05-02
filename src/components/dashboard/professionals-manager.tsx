'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { ChevronRight, Plus, User, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { formatBrPhone } from '@/lib/format'
import { formatCentsToBrl } from '@/lib/money'
import { createProfessional } from '@/app/admin/(authenticated)/actions/professionals'
import {
  QuotaConfirmModal,
  QuotaInline,
  type QuotaConfirmation,
  type QuotaUsage,
} from './professional-quota'

export type ProfessionalListItem = {
  id: string
  name: string
  displayName: string | null
  phone: string | null
  isActive: boolean
  worksToday: { startTime: string; endTime: string } | null
  hasNoSchedule: boolean
  appointmentsToday: number
  revenueTodayCents: number
  servicesCount: number
  hasUserAccess: boolean
}

function trimSeconds(time: string): string {
  // "08:00:00" → "08:00"
  return time.length >= 5 ? time.slice(0, 5) : time
}

type Props = {
  professionals: ProfessionalListItem[]
  usage: QuotaUsage
}

type PendingForm = {
  name: string
  displayName?: string
  phone?: string
}

export function ProfessionalsManager({ professionals, usage }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmData, setConfirmData] = useState<QuotaConfirmation | null>(null)
  const [pendingForm, setPendingForm] = useState<PendingForm | null>(null)

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre sheet vinda do FAB global
      setSheetOpen(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  function openCreate() {
    setPhone('')
    setError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setError(null)
  }

  function submitCreate(payload: PendingForm, acknowledgeExtraCharge = false) {
    startTransition(async () => {
      const result = await createProfessional({
        name: payload.name,
        displayName: payload.displayName,
        phone: payload.phone,
        acknowledgeExtraCharge,
      })
      if (result.ok) {
        setPhone('')
        setPendingForm(null)
        setConfirmData(null)
        closeSheet()
        router.refresh()
        return
      }
      if ('requiresExtraChargeConfirmation' in result) {
        // Mantém o sheet aberto por baixo; abre modal de confirmação
        setPendingForm(payload)
        setConfirmData({
          extraUnitPriceCents: result.extraUnitPriceCents,
          currentExtraMonthlyCents: result.currentExtraMonthlyCents,
          newExtraMonthlyCents: result.newExtraMonthlyCents,
          activeCount: result.activeCount,
          included: result.included,
        })
        return
      }
      setError(result.error)
    })
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) {
      setError('Nome é obrigatório.')
      return
    }
    const displayName = String(fd.get('displayName') ?? '').trim() || undefined
    setError(null)
    submitCreate({ name, displayName, phone: phone || undefined })
  }

  function handleConfirmExtra() {
    if (!pendingForm) return
    submitCreate(pendingForm, true)
  }

  function handleCancelExtra() {
    setConfirmData(null)
    setPendingForm(null)
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
        <header className="mb-6">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Equipe
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Profissionais
          </h1>
          <Button type="button" size="sm" onClick={openCreate} className="mt-3">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar profissional
          </Button>
          <QuotaInline usage={usage} className="mt-2" />
        </header>

        {professionals.length > 0 ? (
          <ul className="space-y-2">
            {professionals.map((p) => {
              const scheduleLine = p.worksToday
                ? `Trabalha hoje ${trimSeconds(p.worksToday.startTime)}–${trimSeconds(p.worksToday.endTime)}`
                : p.hasNoSchedule
                  ? 'Sem horário configurado'
                  : 'De folga hoje'
              return (
                <li key={p.id}>
                  <Link href={`/admin/dashboard/profissionais/${p.id}`} className="block">
                    <Card className="shadow-xs transition-colors hover:bg-bg-subtle">
                      <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        <InitialsAvatar name={p.displayName || p.name} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-medium text-fg">
                              {p.displayName || p.name}
                            </p>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={
                                  p.isActive
                                    ? 'rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success'
                                    : 'rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle'
                                }
                              >
                                {p.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                              <ChevronRight className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                            </div>
                          </div>
                          <p
                            className={`mt-0.5 truncate text-[0.8125rem] ${
                              p.hasNoSchedule ? 'text-warning' : 'text-fg-muted'
                            }`}
                          >
                            {scheduleLine}
                          </p>
                          <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">
                            {p.appointmentsToday}{' '}
                            {p.appointmentsToday === 1 ? 'agendamento hoje' : 'agendamentos hoje'} ·{' '}
                            {formatCentsToBrl(p.revenueTodayCents)} previsto
                          </p>
                          <p className="mt-0.5 truncate text-[0.8125rem] text-fg-subtle">
                            {p.servicesCount}{' '}
                            {p.servicesCount === 1 ? 'serviço vinculado' : 'serviços vinculados'} ·{' '}
                            {p.hasUserAccess ? 'Acesso ao painel' : 'Sem acesso ao painel'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <Card className="shadow-xs">
            <CardContent className="py-10 text-center">
              <p className="text-[0.9375rem] text-fg-muted">Nenhum profissional ainda.</p>
              <Button className="mt-4" onClick={openCreate}>
                Adicionar profissional
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Novo profissional"
        description="Adicione alguém da equipe."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            name="name"
            required
            autoFocus
            maxLength={200}
            placeholder="Ex: Carlos Silva"
            leftIcon={<User className="h-4 w-4" />}
          />
          <Input
            label="Nome curto"
            name="displayName"
            maxLength={100}
            placeholder="Ex: Carlinhos (opcional)"
            hint="Exibido no booking, se preenchido."
          />
          <Input
            label="Telefone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={16}
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(formatBrPhone(e.target.value))}
            leftIcon={<Phone className="h-4 w-4" />}
          />

          {error ? (
            <Alert variant="error" title="Não foi possível adicionar">
              {error}
            </Alert>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={closeSheet}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={pending}>
              Adicionar
            </Button>
          </div>
        </form>
      </BottomSheet>

      <QuotaConfirmModal
        open={confirmData !== null}
        data={confirmData}
        pending={pending}
        confirmLabel="Confirmar e adicionar"
        actionVerb="adicionar"
        onCancel={handleCancelExtra}
        onConfirm={handleConfirmExtra}
      />
    </>
  )
}
