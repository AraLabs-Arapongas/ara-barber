'use client'

import { useState, type FormEvent } from 'react'
import { Scissors, Clock, Trash2, Power } from 'lucide-react'
import { useTenantSlug } from '@/components/mock/tenant-slug-provider'
import { useMockStore, mockId } from '@/lib/mock/store'
import { ENTITY } from '@/lib/mock/entities'
import type { Service } from '@/lib/mock/schemas'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Fab } from '@/components/nav/fab'
import { parseBrlToCents, formatCentsToBrl } from '@/lib/money'
import { cn } from '@/lib/utils'

export default function ServicesPage() {
  const tenantSlug = useTenantSlug()
  const { data: services, setData } = useMockStore(
    tenantSlug,
    ENTITY.services.key,
    ENTITY.services.schema,
    ENTITY.services.seed,
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) {
      setError('Nome é obrigatório.')
      return
    }
    const priceCents = parseBrlToCents(String(fd.get('price') ?? ''))
    if (priceCents === null) {
      setError('Informe o preço em reais (ex: 45 ou 45,00).')
      return
    }
    const durationRaw = Number(fd.get('durationMinutes') ?? 30)
    if (!Number.isFinite(durationRaw) || durationRaw < 5 || durationRaw > 480) {
      setError('Duração deve ser entre 5 e 480 minutos.')
      return
    }
    const newSvc: Service = {
      id: mockId('s'),
      name,
      description: String(fd.get('description') ?? '').trim() || null,
      durationMinutes: Math.round(durationRaw),
      priceCents,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    setData((prev) => [...prev, newSvc])
    form.reset()
    setError(null)
    setSheetOpen(false)
  }

  function toggleActive(id: string) {
    setData((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)))
  }

  function remove(id: string) {
    if (!window.confirm('Remover este serviço?')) return
    setData((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-10 sm:px-8">
        <header className="mb-6">
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.16em] text-fg-subtle">
            Catálogo
          </p>
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-fg">
            Serviços
          </h1>
          <p className="mt-1 text-[0.875rem] text-fg-muted">
            O que seu salão oferece.
          </p>
        </header>

        {services.length > 0 ? (
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <Card className="shadow-xs">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{s.name}</p>
                      <p className="truncate text-[0.8125rem] text-fg-muted">
                        {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={
                          s.isActive
                            ? 'rounded-full bg-success-bg px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-success'
                            : 'rounded-full bg-bg-subtle px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-wide text-fg-subtle'
                        }
                      >
                        {s.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleActive(s.id)}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg"
                        aria-label={s.isActive ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s.id)}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-error-bg hover:text-error"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="shadow-xs">
            <CardContent className="py-10 text-center">
              <p className="text-[0.9375rem] text-fg-muted">
                Nenhum serviço ainda. Toque no <strong>+</strong> para começar.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <Fab srLabel="Adicionar serviço" onClick={() => setSheetOpen(true)} />

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setError(null)
        }}
        title="Novo serviço"
        description="Adicione um item ao catálogo do salão."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            name="name"
            required
            autoFocus
            maxLength={200}
            placeholder="Ex: Corte masculino"
            leftIcon={<Scissors className="h-4 w-4" />}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Duração"
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              defaultValue={30}
              required
              leftIcon={<Clock className="h-4 w-4" />}
              rightSlot={<span className="text-[0.8125rem] text-fg-muted">min</span>}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="price" className="text-[0.8125rem] font-medium text-fg">
                Preço <span className="text-fg-subtle">*</span>
              </label>
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[0.9375rem] font-medium text-fg-muted"
                  aria-hidden="true"
                >
                  R$
                </span>
                <input
                  id="price"
                  name="price"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="45,00"
                  className={cn(
                    'w-full rounded-lg border border-transparent bg-bg-subtle py-3 pl-11 pr-3.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none',
                  )}
                />
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.8125rem] font-medium text-fg">Descrição</span>
            <textarea
              name="description"
              rows={3}
              maxLength={1000}
              placeholder="Detalhes opcionais exibidos no booking."
              className="w-full rounded-lg border border-transparent bg-bg-subtle px-3 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </label>

          {error ? (
            <Alert variant="error" title="Não foi possível adicionar">
              {error}
            </Alert>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setSheetOpen(false)
                setError(null)
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Adicionar
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  )
}
