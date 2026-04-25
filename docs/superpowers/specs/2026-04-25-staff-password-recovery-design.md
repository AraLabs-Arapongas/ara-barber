# Staff password recovery + Resend SMTP migration

**Status:** Design aprovado em 2026-04-25. Próximo passo: writing-plans skill gera plano de implementação.

**Escopo:** Implementar fluxo self-service de "Esqueci a senha" para staff (`SALON_OWNER`, `RECEPTIONIST`, `PROFESSIONAL`) em `/salon/*`, e migrar todos os emails transacionais do Supabase Auth para Resend (substitui SMTP default `noreply@mail.app.supabase.io`). Inclui customização de 3 templates de email em PT-BR com brand AraLabs **+ nome do tenant no subject/body de emails de staff** via `user_metadata.tenant_name` (cliente final fica genérico AraLabs, sem tenant fixo).

**Não-escopo:** consertar Supabase Site URL global (Dashboard "Send recovery/magic link" continuará apontando pro storefront), templates per-tenant, magic link como login alternativo pro staff, captcha. Tudo registrado como tech debt na seção 9.

---

## 1. Motivação

Estado atual do sistema (2026-04-25):

- `/salon/login` tem link "Esqueci a senha" apontando pra `/salon/forgot-password`, mas a rota **não existe** (404 ao clicar).
- Não há rota `/salon/reset-password` pra processar token de recovery e trocar senha.
- Emails de auth saem via SMTP default do Supabase (`noreply@mail.app.supabase.io`) com templates em inglês.
- Site URL do Supabase Auth tá em `https://aralabs.com.br` → recovery/magic link triggered pelo Dashboard pousam no storefront, que não sabe processar tokens.
- Booking emails transacionais (BT-08) já saem via Resend através de uma edge function própria — convive com SMTP do Supabase Auth, mas duplica infraestrutura de envio.

**Resultado:** staff não consegue recuperar senha sem intervenção manual via SQL. Templates broken/ugly em todos os fluxos de auth (incluindo OTP do customer no `/book/login`).

---

## 2. Arquitetura

### 2.1 Estrutura de arquivos

```
src/app/salon/
├── login/                          (existente — sem mudança)
│   ├── page.tsx
│   ├── login-form.tsx              (link "Esqueci a senha" já aponta pra /salon/forgot-password)
│   └── actions.ts
│
├── forgot-password/                (NOVO)
│   ├── page.tsx                    (server: tenant resolve + render form)
│   ├── forgot-password-form.tsx    (client: useFormState + email input)
│   └── actions.ts                  (server action: resetPasswordForEmail)
│
└── reset-password/                 (NOVO)
    ├── page.tsx                    (server: lê ?code → exchangeCodeForSession → render form)
    ├── reset-password-form.tsx     (client: useFormState + password + confirm inputs)
    └── actions.ts                  (server action: updateUser({ password }))
```

### 2.2 Princípios de design

- **Match com `/salon/login`** — server actions com Zod validation, retorno `{ error?: string }`, cookies via `@/lib/supabase/server::createClient`.
- **Server components renderizam forms** — pra ter acesso a `getCurrentTenantOrNotFound()` (theme injection + logo + nome do tenant na UI, igual `/salon/login`).
- **Sem reuso de `/auth/callback`** — esse handler só processa OAuth/OTP do customer flow. Reset password tem token type (`recovery`) e destino (`/salon/reset-password`) staff-specific. Embedando a lógica em `/salon/reset-password/page.tsx` mantém isolamento.

### 2.3 Sem mudanças em rotas existentes

- `/auth/callback`, `/auth/logout` — preservados.
- `/salon/login`, `/salon/login-form.tsx` — preservados (link "Esqueci a senha" já aponta pra rota nova).
- `/book/*` — preservado, customer OTP já passa `emailRedirectTo` dinâmico em [customer-client.ts:16](../../src/lib/auth/customer-client.ts#L16).

---

## 3. Data flow

### 3.1 Flow A — Solicitar reset

```
1. User em qa-aralabs.aralabs.com.br/salon/login → click "Esqueci a senha"
2. → /salon/forgot-password (server component)
   - getCurrentArea() === 'tenant' senão redirect('/')
   - getCurrentTenantOrNotFound() → tenant pra theme + logo
   - render <ForgotPasswordForm />
3. User digita email → forgotPasswordAction(prev, formData)
   a. Zod parse: z.object({ email: z.string().email() })
   b. Lê x-ara-host header (proxy seta) pra montar origin dinâmico:
      const host = headers().get('x-ara-host') ?? 'localhost'
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const origin = `${protocol}://${host}`
   c. supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/salon/reset-password`
      })
   d. Sempre retorna { ok: true } — anti-enumeration
4. UI mostra confirmação: "Se essa conta existe, enviamos um link pra <email>. Confira sua caixa..."
```

### 3.2 Flow B — Trocar senha após receber email

```
5. User clica link no email →
   qa-aralabs.aralabs.com.br/salon/reset-password?code=<one-time-code>
6. /salon/reset-password (server component)
   a. Se !searchParams.code → render <InvalidLinkMessage />
   b. const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
   c. Se error → render <ExpiredLinkMessage /> com CTA "Solicitar novo email" → /salon/forgot-password
   d. Se ok → cookies de sessão (recovery type) já setados → render <ResetPasswordForm />
7. User digita senha + confirmação → resetPasswordAction(prev, formData)
   a. Zod schema:
      z.object({
        password: z.string().min(8, 'Mínimo 8 caracteres'),
        confirm: z.string()
      }).refine(d => d.password === d.confirm, {
        message: 'Senhas não conferem',
        path: ['confirm']
      })
   b. supabase.auth.updateUser({ password: parsed.password })
      (sessão recovery setada na etapa 6 → updateUser autorizado)
   c. Sucesso → redirect('/salon/dashboard')
   d. Erro → return { error: 'Erro ao atualizar senha. Tente novamente.' }
```

### 3.3 Pontos críticos

- **`emailRedirectTo` dinâmico** é o que faz o email apontar pro subdomain certo, contornando a Site URL global broken. Sem isso, link cai no storefront.
- **Cookie domain:** `@/lib/supabase/server::createClient` usa cookies do Next, escopados ao subdomain `qa-aralabs.aralabs.com.br`. Isolamento cross-tenant preservado.
- **Code é one-time use** — Supabase invalida após primeiro `exchangeCodeForSession`. Segunda tentativa do user (refresh/click) cai no `<ExpiredLinkMessage />`.
- **PKCE flow** — Supabase já usa por default (mesmo padrão do existing `/auth/callback`).

---

## 4. SMTP migration: Supabase → Resend

### 4.1 Configuração no Dashboard (manual, uma vez)

Supabase Dashboard → Project Settings → **Auth** → **SMTP Settings** → toggle **"Enable Custom SMTP"** → preencher:

| Campo | Valor |
|---|---|
| Sender email | `no-reply@aralabs.com.br` |
| Sender name | `AraLabs` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<Resend API key — rotacionada no BT-04, password manager>` |
| Minimum interval | `60` (default — 1 email por minuto por endereço) |

→ Save.

### 4.2 Após migração

Todos os emails do Supabase Auth saem via Resend:
- Reset password (que estamos construindo)
- Magic link (já consumido pelo `/book/login` OTP)
- Confirm signup (criação inicial de customer no `/book`)
- Invite, Change email, Reauth (default templates, fora de escopo)

### 4.3 Pré-requisitos validados

- Domínio `aralabs.com.br` verificado no Resend (DKIM/SPF) — confirmado em BT-08 (booking emails).
- Resend API key rotacionada e armazenada (BT-04).

### 4.4 Compatibilidade com edge function existente

A edge function `on-appointment-event` continua usando Resend via API HTTP (não SMTP) pra enviar booking confirmations. Coexistem sem conflito — mesma key Resend, dois canais (SMTP pro auth, HTTP pra app emails).

---

## 5. Email templates

### 5.1 Quais templates customizar

| Template | Customizar | Motivo |
|---|---|---|
| Confirm signup | ✓ | Customer cria conta no `/book/login` |
| Reset password | ✓ | Feature deste spec |
| Magic link | ✓ | OTP do `/book/login` (cliente final) |
| Invite | ✗ | Quase não usado no piloto |
| Change email | ✗ | Quase não usado no piloto |
| Reauth | ✗ | Quase não usado no piloto |

### 5.2 Diretrizes de design

- **HTML inline-styled, table-based** — compatível Gmail/Outlook/Apple Mail.
- **Cor accent:** `#b9945a` (gold AraLabs).
- **Font-stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Sem imagens externas** — logo em SVG inline ou texto only. Evita "imagens bloqueadas" cortando layout.
- **Tenant-aware (parcial) via `user_metadata`** — staff emails mostram nome do salão (ex: "Barbearia Teste") no subject e body via `{{ .Data.tenant_name }}`. Customer emails (que não têm tenant fixo) caem em fallback genérico "AraLabs". Detalhe em §5.4.
- **Variáveis Supabase usadas:** `{{ .ConfirmationURL }}` (URL completa com token), `{{ .Email }}` (destinatário), `{{ .Data.tenant_name }}` (do `user_metadata`). **Não usar** `{{ .SiteURL }}` (aponta pro storefront, broken).
- **PT-BR voice:** direto, sem firula. "Recebemos um pedido pra...", "Click no botão abaixo".

### 5.3 Conteúdo (resumo — HTML completo no plan)

Templates usam Go template conditionals do Supabase (`{{ if }}...{{ else }}...{{ end }}`) pra ramificar staff (com `tenant_name`) vs customer (sem):

**Reset password:**
- Subject (staff): `Redefinir senha — {{ .Data.tenant_name }}`
- Subject (customer fallback): `Redefinir senha — AraLabs`
- Heading: `Redefinir senha`
- Body (staff): "Recebemos um pedido pra redefinir a senha do seu acesso à **{{ .Data.tenant_name }}**. Click no botão abaixo. O link expira em 1 hora."
- Body (customer fallback): "Recebemos um pedido pra redefinir a senha da sua conta AraLabs. Click no botão abaixo. O link expira em 1 hora."
- CTA: "Redefinir senha" → `{{ .ConfirmationURL }}`
- Fallback: "Se o botão não funcionar, copie este link: `{{ .ConfirmationURL }}`"
- Footer: "Se não foi você, ignore este email."

**Magic link:**
- Subject (staff): `Seu link de acesso — {{ .Data.tenant_name }}`
- Subject (customer fallback): `Seu link de acesso — AraLabs`
- Heading: `Acessar`
- Body (staff): "Click no botão abaixo pra entrar no portal da **{{ .Data.tenant_name }}**. O link expira em 1 hora."
- Body (customer fallback): "Click no botão abaixo pra entrar. O link expira em 1 hora."
- CTA: "Entrar agora" → `{{ .ConfirmationURL }}`
- Fallback + footer iguais.

**Confirm signup:**
- Subject (sempre customer no piloto): `Confirme seu email — AraLabs`
- Heading: `Bem-vindo`
- Body: "Confirme seu email pra continuar agendando."
- CTA: "Confirmar email" → `{{ .ConfirmationURL }}`
- Fallback + footer iguais.

### 5.4 `user_metadata` setup (precondição)

Pra `{{ .Data.tenant_name }}` funcionar nos templates, o staff user precisa ter `tenant_name` em `auth.users.raw_user_meta_data`. Customer users **não** têm essa key (fallback do template trata).

**Quando popular:**

1. **Backfill imediato** (parte deste plan) — atualizar `thiago@aralabs.com.br` que já existe sem metadata.
2. **Toda criação futura de staff** — qualquer caminho (Dashboard manual, `pnpm create-staff` script futuro, edge function admin) deve setar `user_metadata.tenant_name = <tenant.name>` no momento da criação. Documentar em runbook + spec do script futuro.

**Como popular:**

```sql
-- Backfill thiago@aralabs.com.br (executado uma vez na implementação)
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('tenant_name', 'QA AraLabs')
where email = 'thiago@aralabs.com.br';
```

**Risco conhecido:** `user_metadata` é editável pelo próprio usuário via `supabase.auth.updateUser({ data: ... })`. Staff poderia tecnicamente alterar próprio `tenant_name` — afeta só display em emails, não auth/RLS. Aceitável piloto. Mitigação futura: migrar pra `app_metadata` (só service_role escreve) — mas exige outro nome de variável no template (`{{ .AppData }}` se Supabase suportar; checar na implementação).

**Drift de nome:** se admin renomear o tenant em `tenants.name` (ex: `Barbearia Teste` → `BT Premium`), `user_metadata.tenant_name` fica desatualizado. Não corrige automaticamente. Mitigação: trigger SQL que sincroniza on update (out of scope deste spec, registrar tech debt §9).

---

## 6. Error handling + edge cases

### 6.1 `/salon/forgot-password`

| Caso | Tratamento |
|---|---|
| Acesso fora de subdomain de tenant (`area !== 'tenant'`) | `redirect('/')` |
| Email com formato inválido | Zod error → form mostra "E-mail inválido" |
| Email não existe em `auth.users` | **Sempre retorna sucesso** (anti-enumeration). UI mostra "Se essa conta existe, enviamos um link" |
| Supabase down / network error | Server action loga, retorna msg genérica "Tente novamente em alguns segundos" |
| Rate limit (>1 request/60s pro mesmo email) | Supabase rate limita silenciosamente. UI mostra mesma msg de sucesso |

### 6.2 `/salon/reset-password`

| Caso | Tratamento |
|---|---|
| URL sem `?code=...` | Render `<InvalidLinkMessage />` com CTA "Solicitar novo email" |
| `exchangeCodeForSession` falha | Render `<ExpiredLinkMessage />` (link expirado/já usado/inválido) |
| Code válido + user é staff de outro tenant | Não bloqueia o reset (Supabase não sabe de tenant). Próximo login `/salon/login` rejeita com "Esta conta é de outro negócio" — comportamento existing |
| Code válido + user `is_active=false` | Reset funciona. Próximo login rejeita com "não tem acesso" — comportamento existing |
| Password < 8 chars | Zod error inline |
| Confirmação não bate | Zod `.refine()` error inline |
| `updateUser` falha | Server action retorna `{ error }`, form mostra |
| Sucesso | Sessão recovery já setada via cookies → `redirect('/salon/dashboard')` direto. Sem segundo login. |

### 6.3 Decisão UX: pós-reset

`redirect('/salon/dashboard')` (já logado). Razão: usuário já provou identidade clicando no link único + setou senha que ele lembra. Forçar re-login é fricção desnecessária.

Alternativa rejeitada: `redirect('/salon/login?reset=success')`. Mais paranoico mas adiciona um login a mais que não acrescenta segurança real (token recovery one-time já é prova).

---

## 7. Segurança

Garantias herdadas do Supabase Auth (sem código nosso):

- **PKCE flow** com CSRF protection no code exchange.
- **One-time-use code** — invalidação automática após primeiro `exchangeCodeForSession`.
- **Expiração de 1h** — default Supabase, configurável no template (não vamos mudar).
- **Rate limiting** por email (60s default) e por IP (Supabase global).
- **Cookie HttpOnly + SameSite=Lax** via Supabase SSR client.

Mitigações nossas:

- **Anti-enumeration** em `/salon/forgot-password` — sempre retorna "se existe, enviamos link" mesmo pra email não cadastrado.
- **`emailRedirectTo` server-controlled** — derivado de `x-ara-host` que vem do proxy (não do client). User não consegue manipular pra redirecionar pra domínio attacker.
- **Tenant boundary preservada** — usar nova senha em outro subdomain de tenant cai no guard existente em `/salon/login` que rejeita por `tenant_id` mismatch.

Riscos conhecidos não mitigados (aceitos no piloto):

- Sem captcha em `/salon/forgot-password` — ataque de envio em massa de emails fica limitado pelo rate limit do Supabase. Aceitável até 100+ tenants.
- Site URL aponta pro storefront — Dashboard "Send recovery/magic link" continua quebrada. Support interno usa SQL direto via MCP por ora.

---

## 8. Testing

| Camada | Estratégia | Status |
|---|---|---|
| **Manual smoke (prod)** | Após deploy: pedir reset pra `thiago@aralabs.com.br`, abrir email, redefinir, logar com nova senha em `qa-aralabs.aralabs.com.br/salon/login`. Atualizar `docs/smoke-test-pilot.md`. | Obrigatório |
| **Unit (Vitest)** | Server actions testáveis com mock `createClient`. Cobrir: Zod validation, anti-enumeration, error mapping, redirect path. | Recomendado |
| **E2E (Playwright)** | Adiado conforme `project_e2e_deferred` (CI desligado). Quando reativar, full flow. | Adiado |
| **Manual edge cases** | (1) Link expirado: esperar 1h ou expirar via SQL `update auth.users set updated_at = now() - interval '2 hours' where ...`. (2) Link já usado: clicar 2x. (3) Email inexistente: deve retornar mesma msg de sucesso. | Obrigatório no smoke |

### 8.1 Smoke test checklist (adicionar ao `docs/smoke-test-pilot.md`)

```
[ ] /salon/login mostra link "Esqueci a senha"
[ ] Click no link → /salon/forgot-password renderiza com logo do tenant
[ ] Submeter email não cadastrado → mostra "Se essa conta existe..."
[ ] Submeter email cadastrado → mostra "Se essa conta existe..." (msg igual, anti-enumeration)
[ ] Email chega via no-reply@aralabs.com.br (NÃO mail.app.supabase.io)
[ ] Email tem subject "Redefinir senha — QA AraLabs" (nome do tenant do user) e link clickable
[ ] Body do email menciona o nome do tenant ("...da QA AraLabs...")
[ ] Click no link → /salon/reset-password renderiza form
[ ] Senha < 8 chars rejeita
[ ] Senhas diferentes rejeitam
[ ] Submeter válido → redirect /salon/dashboard, sessão ativa
[ ] Login subsequente em /salon/login funciona com nova senha
[ ] Click no mesmo link 2ª vez → ExpiredLinkMessage
```

---

## 9. Out of scope + tech debt

| Item | Razão | Tech debt |
|---|---|---|
| Consertar Supabase Site URL | Multi-tenant + 1 valor global é problema arquitetural; Dashboard actions são support interno (raro) | Épico 10: criar `auth.aralabs.com.br` ou redirect handler no storefront |
| Templates per-tenant **completos** (logo, cores, fonts customizadas) | `{{ .Data.tenant_name }}` cobre nome no subject/body, mas brand visual continua AraLabs único. Per-tenant visual exige custom email sender via Auth Hook + edge function | Fase 2 |
| Sync automático de `tenant_name` quando admin renomeia o tenant | Trigger SQL `on update tenants.name → update auth.users.raw_user_meta_data` cross-schema; complexo. Workaround: re-popular manualmente ou via script de admin | Fase 2 |
| Migrar `tenant_name` de `user_metadata` (user-writable) pra `app_metadata` (service_role only) | Aceitável no piloto; impacto limitado a display em email | Fase 2 |
| Magic link como login alternativo em `/salon/login` | Confirmado fora de escopo (usuário escolheu Z—X) | Backlog (se demanda surgir) |
| Captcha em `/salon/forgot-password` | Supabase rate limit cobre piloto | Antes de scale (>100 tenants) |
| Rotacionar senha `#H3lpD3sk05` exposta no chat | Higiene pós-debug | Imediato após smoke test passar |
| "Change email" + "Reauth" templates customizados | Quase não usados | Backlog |

---

## 10. Rollback plan

- **App-side:** `git revert` do commit. 6 arquivos novos, 0 modificados — rollback limpo.
- **SMTP:** Supabase Dashboard → SMTP Settings → toggle "Enable Custom SMTP" → desabilitar. Volta automático pro `noreply@mail.app.supabase.io`.
- **Templates:** Supabase preserva versão anterior. Defaults documentados como fallback (incluir snapshot no plan de implementação).
- **`user_metadata` backfill:** reverter via `update auth.users set raw_user_meta_data = raw_user_meta_data - 'tenant_name' where email = 'thiago@aralabs.com.br'`. Não destrutivo.
- **Sem migration / DDL** — nada pra reverter no DB.

---

## 11. Referências

- [actions.ts](../../src/app/salon/login/actions.ts) — pattern de server action + Zod usado como referência.
- [callback/route.ts](../../src/app/auth/callback/route.ts) — handler OAuth/OTP existente (não modificado, mas mostra pattern de code exchange).
- [customer-client.ts](../../src/lib/auth/customer-client.ts) — `emailRedirectTo` dinâmico já usado pelo customer flow.
- BT-04 (rotação de credenciais), BT-08 (Resend domain verified), BT-09 (smoke prod HTTPS) — checklist `/mvp` em prod.
- Memory: `feedback_supabase_keys`, `project_supabase_direct_user_insert_pitfall`.

---

## 12. Critério de sucesso

- Staff `thiago@aralabs.com.br` em prod consegue: clicar "Esqueci a senha" → receber email via `no-reply@aralabs.com.br` com **subject "Redefinir senha — QA AraLabs"** (nome do tenant) → redefinir → logar com nova senha. Sem suporte humano.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit) verdes.
- `docs/smoke-test-pilot.md` atualizado com novo fluxo + checklist da §8.1.
- Templates dos 3 emails (reset/magic/confirm) saem em PT-BR via Resend, com nome do tenant em emails de staff (via `{{ .Data.tenant_name }}`) e fallback "AraLabs" em emails de customer.
- `auth.users.raw_user_meta_data.tenant_name` populado pra todos staff existentes (`thiago@aralabs.com.br` no piloto).
- Tech debts da §9 registrados no Épico 10 (`docs/superpowers/plans/2026-04-19-epic-10-tech-debt.md`).
