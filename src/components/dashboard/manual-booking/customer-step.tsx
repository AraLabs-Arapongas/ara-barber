'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
}

export type CustomerSelection =
  | {
      kind: 'existing'
      id: string
      name: string
      phone: string | null
      email: string | null
    }
  | {
      kind: 'new'
      name: string
      phone?: string
      email?: string
    }

export function CustomerStep({
  customers,
  value,
  onChange,
  onNext,
}: {
  customers: Customer[]
  value: CustomerSelection | null
  onChange: (sel: CustomerSelection | null) => void
  onNext: () => void
}) {
  const [mode, setMode] = useState<'pick' | 'new'>(value?.kind === 'new' ? 'new' : 'pick')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers.slice(0, 30)
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [search, customers])

  const [newName, setNewName] = useState(value?.kind === 'new' ? value.name : '')
  const [newPhone, setNewPhone] = useState(value?.kind === 'new' ? (value.phone ?? '') : '')
  const [newEmail, setNewEmail] = useState(value?.kind === 'new' ? (value.email ?? '') : '')

  const canContinue =
    (mode === 'pick' && value?.kind === 'existing') ||
    (mode === 'new' && newName.trim().length > 0)

  function selectExisting(c: Customer) {
    onChange({
      kind: 'existing',
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
    })
  }

  function commitNew() {
    if (!newName.trim()) {
      onChange(null)
      return
    }
    onChange({
      kind: 'new',
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'pick' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setMode('pick')
            if (value?.kind === 'new') onChange(null)
          }}
        >
          Cliente existente
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setMode('new')
            if (value?.kind === 'existing') onChange(null)
          }}
        >
          Novo cliente
        </Button>
      </div>

      {mode === 'pick' ? (
        <>
          <Input
            type="search"
            placeholder="Buscar por nome, telefone ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="divide-y divide-border rounded-lg border border-border">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-fg-muted">Nenhum cliente encontrado.</li>
            ) : null}
            {filtered.map((c) => {
              const selected = value?.kind === 'existing' && value.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectExisting(c)}
                    className={`flex w-full flex-col px-4 py-3 text-left transition-colors hover:bg-bg-subtle ${
                      selected ? 'bg-brand-primary/10' : ''
                    }`}
                  >
                    <span className="font-medium text-fg">{c.name || '(sem nome)'}</span>
                    <span className="text-sm text-fg-muted">
                      {c.phone ?? c.email ?? '(sem contato)'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <div className="space-y-3">
          <Input
            label="Nome do cliente"
            required
            placeholder="Ex.: Maria Silva"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={commitNew}
          />
          <Input
            label="Telefone"
            type="tel"
            placeholder="(11) 91234-5678"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            onBlur={commitNew}
            hint="Opcional"
          />
          <Input
            label="E-mail"
            type="email"
            placeholder="cliente@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onBlur={commitNew}
            hint="Opcional"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            if (mode === 'new') commitNew()
            onNext()
          }}
          disabled={!canContinue}
        >
          Continuar
        </Button>
      </div>
    </section>
  )
}
