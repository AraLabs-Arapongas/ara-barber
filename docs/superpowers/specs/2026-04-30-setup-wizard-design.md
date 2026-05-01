# Setup Wizard — Design

**Status:** Aprovado em 2026-04-30. Pré-requisito do launch do piloto (60d).

**Problema:** dono recebe email, loga em `<slug>.aralabs.com.br/admin/dashboard`, vê dashboard vazio sem nenhuma indicação do que fazer pra agenda começar a funcionar. Sem `business_hours` cadastrado o `computeSlots()` retorna vazio; sem serviços, sem profissionais, sem vínculos `professional_services`, o cliente final abre `<slug>.aralabs.com.br/book` e não consegue agendar nada. Risco real de o piloto morrer no dia 2 por falta de onboarding.

**Solução:** wizard guiado pós-criação cobrindo o **mínimo viável pra agenda funcionar**: horários, serviços, profissionais, vínculos. Bloqueante na primeira sessão (com escape válido), banner persistente nas seguintes até completar.

---

## 1. Escopo

### Dentro do escopo

- 4 steps lineares cobrindo: horários de funcionamento, serviços, profissionais, matriz de vínculos.
- Persistência por step: cada submit salva no DB e avança `onboarding_step`.
- Gate de redirect pra rotas do dashboard enquanto não completar.
- Banner persistente após "saída" do wizard até conclusão.
- Pós-conclusão: redirect com toast "Compartilhe link" + botão copiar.

### Fora do escopo

- **Branding** (cores, logo, favicon) — fica em `Mais → Marca`. Tem defaults sensatos no schema.
- **Regras avançadas** (`min_advance_hours`, `slot_interval_minutes`, `customer_can_cancel`, `cancellation_window_hours`) — defaults do `provision-tenant` cobrem.
- **Convites pra equipe** (RECEPTIONIST, outros profissionais com login próprio) — fica em `Mais → Equipe`.
- **Tutorial in-app, help bubbles, vídeo de boas-vindas, tour das telas** — explicitamente fora.
- **Wizard pra outros roles** — RECEPTIONIST/PROFESSIONAL não passam pelo wizard. Se logarem antes do dono completar, veem o redirect também (aceitável — provavelmente avisam o dono).
- **Reabrir wizard depois de completar** — se quiser refazer algo, usa as telas individuais. Wizard é one-shot.

---

## 2. Schema

Migration nova: `supabase/migrations/00XX_tenant_onboarding.sql`

```sql
alter table tenants
  add column onboarding_completed_at timestamptz null,
  add column onboarding_step text null
    check (
      onboarding_step is null
      or onboarding_step in ('hours','services','professionals','links')
    );

comment on column tenants.onboarding_completed_at is
  'Quando o setup wizard foi concluído. Null = ainda não completou.';
comment on column tenants.onboarding_step is
  'Próximo step pendente do wizard. Null = não iniciado ou já completou.';
```

Tenants existentes: `onboarding_completed_at = null`. Em produção, **backfill manual** pra setar `onboarding_completed_at = created_at` em todos os tenants já operacionais (incluso na migration via `update tenants set onboarding_completed_at = created_at where created_at < now()`). Tenants novos criados via `provision-tenant` ou via admin UI nascem com `onboarding_completed_at = null` (não setar nada — flow normal).

Cookie:
- Nome: `ara_setup_dismissed`
- Path: `/admin`
- Max-age: 30 dias
- HttpOnly: false (lido só pra checagem visual; sem dado sensível)
- Set quando dono clica "Sair do wizard"; lido pelo gate

---

## 3. URL e route layout

```
src/app/admin/setup/                  ← novo, fora de (authenticated)/dashboard
  layout.tsx                          ← full-screen, sem sidebar/header
  page.tsx                            ← server, lê onboarding_step e redirect
  horarios/page.tsx + form.tsx
  servicos/page.tsx + form.tsx
  profissionais/page.tsx + form.tsx
  vinculos/page.tsx + form.tsx
  _components/
    progress-indicator.tsx
    wizard-footer.tsx
    welcome-toast.tsx                 ← consumido em /admin/dashboard?welcome=1
```

**Rota raiz `/admin/setup`** apenas redireciona pro step pendente:
- `onboarding_step = null` E `onboarding_completed_at = null` → `/admin/setup/horarios`
- `onboarding_step = 'hours'` → `/admin/setup/horarios`
- `onboarding_step = 'services'` → `/admin/setup/servicos`
- `onboarding_step = 'professionals'` → `/admin/setup/profissionais`
- `onboarding_step = 'links'` → `/admin/setup/vinculos`
- `onboarding_completed_at != null` → `/admin/dashboard` (wizard já feito; nada a fazer)

`/admin/setup/*` herdam o layout próprio (sem sidebar). Auth = `assertStaff({ expectedTenantId })` no layout.

---

## 4. Gate / banner

### Implementação

Função utilitária nova: `src/lib/onboarding/queries.ts::getOnboardingState(tenantId)` retorna:

```ts
type OnboardingState = {
  completed: boolean             // onboarding_completed_at != null
  currentStep: 'hours' | 'services' | 'professionals' | 'links' | null
  completedSteps: number         // 0-4 baseado em onboarding_step
}
```

### Gate

No layout `src/app/admin/(authenticated)/dashboard/layout.tsx` (existente — adicionar lógica):

```tsx
// Pseudo-código
const tenant = await getCurrentTenantOrNotFound()
const onboarding = await getOnboardingState(tenant.id)
const dismissed = (await cookies()).get('ara_setup_dismissed')?.value === '1'

if (!onboarding.completed && !dismissed) {
  redirect('/admin/setup')
}

return (
  <DashboardLayout>
    {!onboarding.completed && dismissed ? (
      <OnboardingBanner state={onboarding} />
    ) : null}
    {children}
  </DashboardLayout>
)
```

### Banner

`src/components/dashboard/onboarding-banner.tsx`:

- Sticky no topo do conteúdo (abaixo do header), antes do `{children}`
- Texto: **"Configure seu negócio · {N} de 4 etapas concluídas"**
- Botão: **[Continuar setup →]** linka pra `/admin/setup` (que redireciona pro step pendente)
- Tom: warning suave (`bg-warning-bg/30`), não intrusivo
- Se `onboarding.completed` virar true → some sozinho (sem unmount manual; só não renderiza)

### Botão "Sair do wizard"

No footer de cada step do wizard, link discreto à esquerda do `[Voltar]`:
- Texto: "Sair do wizard"
- Server action: seta cookie `ara_setup_dismissed=1` (max-age 30d) → `redirect('/admin/dashboard')`

---

## 5. Steps detalhados

### Step 1 — Horários (`/admin/setup/horarios`)

**Form:**

```
Etapa 1 de 4 — Horários de funcionamento

Quando seu negócio fica aberto?

[ Domingo  ]  [○ Fechado] [● Aberto]  [09:00 ▾]  [18:00 ▾]
[ Segunda  ]  [○ Fechado] [● Aberto]  [09:00 ▾]  [18:00 ▾]
[ Terça    ]  [○ Fechado] [● Aberto]  [09:00 ▾]  [18:00 ▾]
... (Quarta-Sábado)
[ Sábado   ]  [● Fechado] [○ Aberto]   --:--      --:--
```

**Pré-fill (idêntico ao `provision-tenant`):**
- Seg-Sáb: aberto, 09:00-18:00
- Dom: fechado

**Validação:**
- Se aberto → `start_time < end_time`
- Pelo menos 1 dia aberto (não bloqueia funcionamento, mas avisa "Você marcou todos os dias como fechado. Tem certeza?" — confirm modal)

**Submit:** `saveBusinessHoursStep(formData)`:
1. `assertStaff({ expectedTenantId })`
2. Zod parse: array de 7 objetos `{ weekday, is_open, start_time, end_time }`
3. **Delete-then-insert** (transação): `delete from business_hours where tenant_id = ?; insert into business_hours ...`
4. Update `tenants.onboarding_step = 'services'`
5. `revalidatePath('/admin/setup')`
6. `redirect('/admin/setup/servicos')`

### Step 2 — Serviços (`/admin/setup/servicos`)

**Form:**

```
Etapa 2 de 4 — Serviços

O que seu negócio oferece?

┌──────────────────────────────────────────────────────┐
│ [Corte de cabelo                ]  [30min ▾] R$ [50,00] [×] │
│ [Barba                          ]  [30min ▾] R$ [25,00] [×] │
└──────────────────────────────────────────────────────┘

[+ Adicionar serviço]
```

**Pré-fill:** 1 row vazia (não tenta adivinhar serviços).

**Validação:**
- ≥1 row preenchida
- Cada row: nome ≥1 char, duração ∈ {15,30,45,60,90,120}, preço ≥0

**Submit:** `saveServicesStep(formData)`:
1. `assertStaff(...)`
2. Zod parse
3. **Delete-then-insert** em `services` (escopo: `tenant_id = ?`)
4. Update `onboarding_step = 'professionals'`
5. Revalidate + redirect step 3

### Step 3 — Profissionais (`/admin/setup/profissionais`)

**Form:**

```
Etapa 3 de 4 — Profissionais

Quem atende no seu negócio?

┌──────────────────────────────────┐
│ [João da Silva           ] [×]   │
│ [Maria Pereira           ] [×]   │
└──────────────────────────────────┘

[+ Adicionar profissional]
```

**Pré-fill:** 1 row vazia.

**Validação:**
- ≥1 row preenchida
- Cada row: nome ≥1 char, ≤80 char

**Submit:** `saveProfessionalsStep(formData)`:
1. `assertStaff(...)`
2. Zod parse: array de `{ name }`
3. **Delete-then-insert** em `professionals` (com `is_active=true`, `tenant_id=?`)
4. Update `onboarding_step = 'links'`
5. Revalidate + redirect step 4

**Nota:** este step NÃO cria `auth.users` pra cada profissional. Profissionais aqui são apenas "recursos da agenda" (alguém que ocupa slots), não usuários do sistema. Se dono quiser que profissional X faça login, vai depois em `Mais → Equipe` e convida com email — fora do escopo do wizard.

### Step 4 — Vínculos (`/admin/setup/vinculos`)

**Form:**

```
Etapa 4 de 4 — Quem faz o quê?

Marque os serviços que cada profissional atende.

                    Corte    Barba
João da Silva       [✓]      [✓]
Maria Pereira       [✓]      [✓]
```

**Pré-fill:** **todos checkboxes marcados** (caso comum: SMB pequeno onde todo mundo faz tudo).

**Validação:** ≥1 vínculo marcado no total.

**Submit:** `saveLinksStep(formData)`:
1. `assertStaff(...)`
2. Zod parse: array de `{ service_id, professional_id }`
3. **Delete-then-insert** em `professional_services`
4. Update `onboarding_completed_at = now()`, `onboarding_step = null`
5. Revalidate `/admin/dashboard` + `redirect('/admin/dashboard?welcome=1')`

---

## 6. Pós-conclusão

`/admin/dashboard?welcome=1` renderiza um Card adicional no topo (acima do "Próximos") por uma única visita:

```
🎉 Pronto! Sua agenda tá no ar.
Compartilhe seu link com clientes:
[ <slug>.aralabs.com.br ]   [Copiar]
```

Implementação:
- Server component lê `searchParams`. Se `welcome=1` E `tenant.onboarding_completed_at` existe (defesa contra acesso direto à URL) → renderiza o card.
- Card tem botão `[Copiar]` client-side (`navigator.clipboard.writeText`).
- Não persiste "já viu" — basta o usuário navegar pra outra rota e voltar pro dashboard pra sumir (query param consumido).

---

## 7. Server actions

`src/lib/onboarding/actions.ts`:

```ts
'use server'

export async function saveBusinessHoursStep(_prev, formData): Promise<{ error?: string }>
export async function saveServicesStep(_prev, formData): Promise<{ error?: string }>
export async function saveProfessionalsStep(_prev, formData): Promise<{ error?: string }>
export async function saveLinksStep(_prev, formData): Promise<{ error?: string }>
export async function dismissWizardAction(): Promise<void>  // seta cookie + redirect
```

Padrão de cada save:
1. `await assertStaff({ expectedTenantId: tenant.id })`
2. Zod safeParse — return `{ error: ... }` se falhar
3. Transaction (idealmente RPC; fallback: 2 queries em sequência sem transaction explícita — ok em Fase 1):
   - Delete-then-insert na tabela target
   - Update `tenants` (step ou completed_at)
4. `await recordAudit({ action: 'onboarding.step.<name>', ... })`
5. `revalidatePath('/admin/setup')` (ou `/admin/dashboard` no step final)
6. `redirect(pathProximoStep)`

**Por que delete-then-insert vs upsert:** simplifica MUITO o caso de "dono adicionou 3 serviços, voltou no step, removeu 1 e mudou nome de outro". Upsert exigiria diff client-vs-server. Delete-then-insert é trivial e seguro porque toda a operação tá dentro do escopo `tenant_id = ?`. Trade-off: IDs de `services`/`professionals` mudam se dono editar, mas como ainda não tem `appointments` referenciando (é o setup inicial), não tem FK quebrada. Validar no test.

---

## 8. Edge cases

| Caso | Comportamento |
|---|---|
| Dono troca de browser/dispositivo após "Sair do wizard" | Cookie some → cai no setup de novo. **Aceitável** — força conclusão. |
| RECEPTIONIST loga antes do dono completar | Vê o mesmo redirect/banner. Aceitável — provavelmente fala com o dono. |
| Step 4 sem profissionais ativos (alguém desativou no meio) | Matriz vazia → server detecta e redirect pra step 3 (`onboarding_step = 'professionals'`). |
| Step 4 sem serviços | Idem, redirect pra step 2. |
| Dono volta no step anterior (botão `[Voltar]`) e muda dados | Submit do step anterior re-roda delete-then-insert. Step seguinte não é invalidado (dados já tão lá), mas se usuário tirou um profissional, step 4 mostra matriz nova ao chegar lá. |
| Dois profissionais com mesmo nome | Permitido (FK é por id, não nome). |
| Dois serviços com mesmo nome | Permitido. |
| Dono fecha browser no meio do step 2 | Volta no `/admin/setup` → redireciona pra `/admin/setup/servicos` (step não foi submetido, então `onboarding_step` ainda = `'services'`). Form vem vazio (1 row em branco) — dados não foram salvos. |
| Tenant criado por admin platform mas owner ainda não logou | `onboarding_completed_at = null` → primeira vez que o owner logar, cai no wizard. |

---

## 9. Componentes UI reutilizáveis

`src/app/admin/setup/_components/`:

- **`<ProgressIndicator current={1} total={4} />`** — barra horizontal, "Etapa 1 de 4" + progress bar
- **`<WizardFooter onBack={...} canSubmit={...} pending={...} dismissHref="/admin/setup/sair" />`** — footer fixo com botões
- **`<WelcomeToast slug={tenant.slug} />`** — card pós-conclusão consumido em dashboard

`src/components/dashboard/onboarding-banner.tsx` — banner persistente.

Todos usam tokens existentes (`@/components/ui/*`, `text-fg`, `bg-warning-bg`, etc).

---

## 10. Testing

Unit tests (vitest):
- `tests/unit/lib/onboarding/derivations.test.ts` — funções puras (`getOnboardingState` mock-friendly, calcula `completedSteps` a partir de `onboarding_step`)
- `tests/unit/lib/onboarding/actions.test.ts` — schemas Zod de cada step (testa validação sem hit no DB)

Integration tests (smoke manual no `docs/smoke-test-pilot.md`):
- Cenário "Tenant novo": criar tenant via admin → logar com owner → confirmar redirect pra `/admin/setup/horarios` → preencher 4 steps → confirmar landing em `/admin/dashboard?welcome=1` com toast
- Cenário "Sair e voltar": no step 2, clicar "Sair do wizard" → cair no dashboard com banner "1 de 4" → clicar [Continuar setup] → cair em `/admin/setup/servicos` (step 2)

E2E (Playwright): **não fazer** nesta entrega — wizard é fluxo crítico mas Playwright tá desativado no CI; smoke manual cobre.

---

## 11. Migração de tenants existentes

Tenants já operacionais (`barbearia-teste`, `casa-do-corte`, `qa-aralabs`, `bela-imagem`) precisam de `onboarding_completed_at = created_at` no momento da migration — caso contrário, próximo login dos owners cai no wizard, sobrescrevendo dados de produção via delete-then-insert.

Migration inclui:
```sql
update tenants
set onboarding_completed_at = created_at
where created_at < now();  -- todos os existentes
```

---

## 12. Critério de sucesso

- Owner novo do `qa-aralabs-2` (criar pra teste) loga e cai em `/admin/setup`
- Em ≤ 10min completa os 4 steps
- Pós-conclusão acessa `<slug>.aralabs.com.br/book` e consegue agendar
- "Sair do wizard" funciona e mostra banner
- Banner some quando completa todos os 4
- Tenants antigos NÃO veem o wizard (migration backfill funcionou)

---

## 13. Riscos

- **Delete-then-insert apaga IDs:** se algum FK externo apontar pra `services.id` ou `professionals.id` (ex: `appointments`), quebra. **Mitigação:** wizard só roda quando `onboarding_completed_at = null` E não tem `appointments` ainda (validar no submit do step 4 — se tiver appointment, abortar com erro "Setup já em uso, edite individualmente em Mais"). Ou simplesmente confiar que a migration backfill cobre todos os tenants existentes e que tenants novos não criam appointments antes de completar o setup.
- **Cookie de 30d:** se dono limpar cookies ou se passarem 30d, cai no setup de novo. **Aceitável** — banner provavelmente ainda existe (porque `onboarding_completed_at` tá null), e setup tá em `/admin/setup` linkado pelo banner.
- **Owner abandona meio do wizard durante 60 dias do piloto:** banner persiste; você (operador) consegue ver via admin platform que `onboarding_completed_at = null` e proativamente liga.

---

## 14. Próximo passo

Invocar `superpowers:writing-plans` pra gerar plano executável fase-a-fase.
