'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { changeMyPassword, signOutAllSessions } from '@/app/admin/(authenticated)/actions/security'

type Msg = { kind: 'success' | 'error'; text: string }

export function SecurityPanel() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pwd, setPwd] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdMsg, setPwdMsg] = useState<Msg | null>(null)
  const [sessionMsg, setSessionMsg] = useState<Msg | null>(null)

  function changePassword() {
    setPwdMsg(null)
    if (pwd.length < 8) {
      setPwdMsg({ kind: 'error', text: 'A senha precisa ter no mínimo 8 caracteres.' })
      return
    }
    if (pwd !== pwdConfirm) {
      setPwdMsg({ kind: 'error', text: 'As senhas não conferem.' })
      return
    }
    startTransition(async () => {
      const result = await changeMyPassword({ newPassword: pwd })
      if (!result.ok) {
        setPwdMsg({ kind: 'error', text: result.error })
      } else {
        setPwdMsg({ kind: 'success', text: 'Senha alterada com sucesso.' })
        setPwd('')
        setPwdConfirm('')
      }
    })
  }

  function signOutAll() {
    if (
      !confirm(
        'Encerrar todas as sessões? Você precisará fazer login novamente em todos os dispositivos.',
      )
    )
      return
    setSessionMsg(null)
    startTransition(async () => {
      const result = await signOutAllSessions()
      if (!result.ok) {
        setSessionMsg({ kind: 'error', text: result.error })
      } else {
        router.push('/admin/login')
      }
    })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="font-medium text-fg">Alterar senha</h2>
          <Input
            type="password"
            label="Nova senha"
            placeholder="Mínimo 8 caracteres"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            disabled={pending}
            autoComplete="new-password"
          />
          <Input
            type="password"
            label="Confirmar nova senha"
            placeholder="Repita a senha"
            value={pwdConfirm}
            onChange={(e) => setPwdConfirm(e.target.value)}
            disabled={pending}
            autoComplete="new-password"
          />
          {pwdMsg ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                pwdMsg.kind === 'success' ? 'bg-success-bg text-success' : 'bg-error-bg text-error'
              }`}
              role={pwdMsg.kind === 'error' ? 'alert' : 'status'}
            >
              {pwdMsg.text}
            </p>
          ) : null}
          <Button
            onClick={changePassword}
            disabled={pending || !pwd || !pwdConfirm}
            loading={pending}
          >
            Salvar nova senha
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="font-medium text-fg">Sessões</h2>
          <p className="text-sm text-fg-muted">
            Encerre todas as sessões ativas (em todos os dispositivos onde você está logado). Útil
            se perdeu acesso a algum aparelho.
          </p>
          {sessionMsg ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                sessionMsg.kind === 'success'
                  ? 'bg-success-bg text-success'
                  : 'bg-error-bg text-error'
              }`}
              role="alert"
            >
              {sessionMsg.text}
            </p>
          ) : null}
          <Button variant="secondary" onClick={signOutAll} disabled={pending}>
            Encerrar todas as sessões
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
