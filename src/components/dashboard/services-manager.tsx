'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react'
import { Pencil, Plus, Search, Tag, Clock, Power, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { parseBrlToCents, formatCentsToBrl } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  createService,
  toggleServiceActive,
  updateService,
} from '@/app/salon/(authenticated)/actions/services'

export type ServiceListItem = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceCents: number
  isActive: boolean
}

type Props = {
  services: ServiceListItem[]
}

function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function ServicesManager({ services }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceListItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim())
    if (!q) return services
    return services.filter((s) => {
      const haystack = normalizeForSearch(`${s.name} ${s.description ?? ''}`)
      return haystack.includes(q)
    })
  }, [services, query])

  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- abre sheet vinda de URL ?new=1
      setEditing(null)
      setSheetOpen(true)
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  function openCreate() {
    setEditing(null)
    setError(null)
    setSheetOpen(true)
  }

  function openEdit(item: ServiceListItem) {
    setEditing(item)
    setError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setError(null)
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
    const description = String(fd.get('description') ?? '').trim() || undefined

    startTransition(async () => {
      const payload = {
        name,
        description,
        durationMinutes: Math.round(durationRaw),
        priceCents,
      }
      const result = editing
        ? await updateService({ id: editing.id, ...payload })
        : await createService(payload)
      if (!result.ok) {
        setError(result.error)
        return
      }
      form.reset()
      closeSheet()
      router.refresh()
    })
  }

  function toggle(id: string, current: boolean) {
    startTransition(async () => {
      await toggleServiceActive({ id, isActive: !current })
      router.refresh()
    })
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
          <p className="mt-1 text-[0.875rem] text-fg-muted">O que seu negócio oferece.</p>
          <Button type="button" size="sm" onClick={openCreate} className="mt-3">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar serviço
          </Button>
        </header>

        {services.length > 0 ? (
          <div className="relative mb-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serviço..."
              className="w-full rounded-lg border border-transparent bg-bg-subtle py-2.5 pl-10 pr-10 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
              aria-label="Buscar serviço"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle hover:bg-border hover:text-fg"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        {services.length > 0 && filtered.length === 0 ? (
          <Card className="shadow-xs">
            <CardContent className="py-8 text-center">
              <p className="text-[0.9375rem] text-fg-muted">
                Nada encontrado para <strong>{query}</strong>.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {filtered.length > 0 ? (
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li key={s.id}>
                <Card className="shadow-xs">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium text-fg">{s.name}</p>
                      <p className="truncate text-[0.8125rem] text-fg-muted">
                        {s.durationMinutes} min · {formatCentsToBrl(s.priceCents)}
                      </p>
                    </button>
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
                        onClick={() => openEdit(s)}
                        disabled={pending}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg disabled:opacity-50"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(s.id, s.isActive)}
                        disabled={pending}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg disabled:opacity-50"
                        aria-label={s.isActive ? 'Desativar' : 'Ativar'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : services.length === 0 ? (
          <Card className="shadow-xs">
            <CardContent className="py-10 text-center">
              <p className="text-[0.9375rem] text-fg-muted">
                Nenhum serviço ainda. Toque em <strong>+</strong> para começar ou use o botão abaixo.
              </p>
              <Button className="mt-4" onClick={openCreate}>
                Adicionar serviço
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editing ? 'Editar serviço' : 'Novo serviço'}
        description={
          editing
            ? 'Ajuste nome, duração, preço ou descrição.'
            : 'Adicione um item ao catálogo.'
        }
      >
        <form
          key={editing?.id ?? 'new'}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <Input
            label="Nome"
            name="name"
            required
            autoFocus
            maxLength={200}
            defaultValue={editing?.name ?? ''}
            placeholder="Ex: Consulta 30min"
            leftIcon={<Tag className="h-4 w-4" />}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Duração"
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              defaultValue={editing?.durationMinutes ?? 30}
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
                  defaultValue={editing ? centsToInputValue(editing.priceCents) : ''}
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
              defaultValue={editing?.description ?? ''}
              placeholder="Detalhes opcionais exibidos no booking."
              className="w-full rounded-lg border border-transparent bg-bg-subtle px-3 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:border-brand-primary focus:bg-surface-raised focus:outline-none"
            />
          </label>

          {error ? (
            <Alert variant="error" title="Não foi possível salvar">
              {error}
            </Alert>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={closeSheet}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth loading={pending}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </>
  )
}
