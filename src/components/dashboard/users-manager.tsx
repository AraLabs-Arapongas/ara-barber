'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  inviteStaff,
  updateStaffRole,
  deactivateStaff,
} from '@/app/admin/(authenticated)/actions/users'

export type StaffRole = 'BUSINESS_OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL'

export type StaffRow = {
  id: string
  userId: string
  name: string
  email: string
  role: StaffRole
  createdAt: string
  isMe: boolean
}

const ROLE_LABELS: Record<StaffRole, string> = {
  BUSINESS_OWNER: 'Dono',
  RECEPTIONIST: 'Recepção',
  PROFESSIONAL: 'Profissional',
}

const SELECT_CLASSES =
  'w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-fg focus:border-brand-primary focus:outline-none disabled:opacity-50'

type Msg = { kind: 'success' | 'error'; text: string }

export function UsersManager({
  users,
  canManage,
}: {
  users: StaffRow[]
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<StaffRole>('RECEPTIONIST')
  const [msg, setMsg] = useState<Msg | null>(null)

  function showMsg(m: Msg) {
    setMsg(m)
  }

  function invite() {
    setMsg(null)
    startTransition(async () => {
      const result = await inviteStaff({ email: inviteEmail, role: inviteRole })
      if (!result.ok) {
        showMsg({ kind: 'error', text: result.error })
      } else {
        showMsg({ kind: 'success', text: 'Convite enviado!' })
        setInviteEmail('')
        setInviting(false)
      }
    })
  }

  function changeRole(id: string, role: string) {
    setMsg(null)
    startTransition(async () => {
      const result = await updateStaffRole({ userProfileId: id, role: role as StaffRole })
      if (!result.ok) showMsg({ kind: 'error', text: result.error })
    })
  }

  function deactivate(id: string) {
    if (!confirm('Remover este usuário do painel?')) return
    setMsg(null)
    startTransition(async () => {
      const result = await deactivateStaff({ userProfileId: id })
      if (!result.ok) showMsg({ kind: 'error', text: result.error })
    })
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
          }`}
          role={msg.kind === 'error' ? 'alert' : 'status'}
        >
          {msg.text}
        </p>
      ) : null}

      {canManage ? (
        inviting ? (
          <Card>
            <CardContent className="space-y-3 py-4">
              <Input
                type="email"
                label="E-mail do convidado"
                placeholder="email@exemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={pending}
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="invite-role"
                  className="text-[0.8125rem] font-medium text-fg"
                >
                  Permissão
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                  className={SELECT_CLASSES}
                  disabled={pending}
                >
                  <option value="BUSINESS_OWNER">Dono</option>
                  <option value="RECEPTIONIST">Recepção</option>
                  <option value="PROFESSIONAL">Profissional</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setInviting(false)
                    setInviteEmail('')
                    setMsg(null)
                  }}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button onClick={invite} disabled={pending || !inviteEmail} loading={pending}>
                  Enviar convite
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setInviting(true)}>Convidar usuário</Button>
        )
      ) : (
        <p className="rounded-lg bg-bg-subtle px-3 py-2 text-sm text-fg-muted">
          Apenas o dono do negócio pode gerenciar usuários.
        </p>
      )}

      {users.length === 0 ? (
        <p className="rounded-lg bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Nenhum usuário cadastrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-fg">
                      {u.email || u.name || '(sem e-mail)'}
                      {u.isMe ? (
                        <span className="ml-2 rounded bg-bg-subtle px-1.5 py-0.5 text-[0.6875rem] font-normal text-fg-muted">
                          você
                        </span>
                      ) : null}
                    </p>
                    {canManage ? (
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className="mt-1 rounded border border-border bg-bg-subtle px-2 py-0.5 text-sm text-fg disabled:opacity-50"
                        disabled={pending || u.isMe}
                        aria-label={`Permissão de ${u.email || u.name}`}
                      >
                        <option value="BUSINESS_OWNER">{ROLE_LABELS.BUSINESS_OWNER}</option>
                        <option value="RECEPTIONIST">{ROLE_LABELS.RECEPTIONIST}</option>
                        <option value="PROFESSIONAL">{ROLE_LABELS.PROFESSIONAL}</option>
                      </select>
                    ) : (
                      <p className="mt-1 text-sm text-fg-muted">{ROLE_LABELS[u.role]}</p>
                    )}
                  </div>
                  {canManage && !u.isMe ? (
                    <button
                      type="button"
                      onClick={() => deactivate(u.id)}
                      className="rounded-lg p-2 text-fg-muted transition-colors hover:bg-error-bg hover:text-error disabled:opacity-50"
                      disabled={pending}
                      aria-label={`Remover ${u.email || u.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
