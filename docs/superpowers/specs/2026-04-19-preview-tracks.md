# Preview Tracks — Spec

**Status:** Proposta · 2026-04-19
**Quem puxou:** Thiago · "ta difícil fazer assim no abstrato, vamos seguir com a ideia de criar todas as telas salvando no async storage"
**Intenção:** desenhar, ver e iterar **todas as telas** do produto (inclusive épicos futuros — agenda, booking público, financeiro) sem atrito de backend/auth/RLS. Quando a tela "grada" visualmente, o código dela vira a base pro épico real depois.

---

## 1. Motivação

Algumas decisões só ficam claras **quando se vê a tela** (layout dos cards, espaçamento do editor de horários, fluxo de confirmação do booking). Hoje cada tela nova exige:
- Migration/schema pronto
- RLS configurado
- Server action + zod
- Seed de dados consistente
- Login funcionando pro role certo

Isso é o caminho **certo pra prod** — e é o que já fizemos no Épico 3. Mas pra **explorar** o resto do produto (Épicos 4, 5, 7+), o overhead mata o flow. Virar o design antes da infra é mais barato.

---

## 2. Escopo

### ✅ Preview
- Telas que ainda **não existem em código real**:
  - **Dashboard home** (overview com cards de hoje/agenda/receita/alertas)
  - **Agenda** (Épico 4): dia, semana, slot click → criar appointment, drag resize, bloqueio
  - **Booking público** (Épico 5): wizard serviço → profissional → data → horário → login → confirm → sucesso
  - **Meus agendamentos** (cliente): lista futura + passada, cancelar, reagendar
  - **Financeiro** (Épico 7 parte tenant): saldo pendente, próximo payout, histórico
  - **Relatórios** básicos: ocupação, top serviços, top clientes
  - **Perfil cliente**: editar nome/telefone
  - **UI `professional_services`**: toggle "Carlinhos faz: Corte / Barba / ..."
  - **Availability editor** do profissional (recorrente + blocks)
  - **Notificações / lembretes** (só UI, trigger mockado)

### ❌ Fora do preview — permanece real
- **Login staff** (/salon/login) + guard `assertStaff`
- **Cadastros** (/salon/dashboard/profissionais, /servicos, /clientes, /configuracoes/horarios) — já funcionam com DB real + RLS
- **Tenant resolution**, ThemeInjector, home pública do tenant (TenantPublicHome), 404 tematizado
- **Migrations, advisors, tipos TS** — DB é fonte de verdade sempre

---

## 3. Arquitetura

### 3.1 Rotas

Tudo mora em **`/preview/*`** (URL prefix, não route group, por convenção do repo — ver memória `project_areas_url_prefix.md`):

```
src/app/preview/
├── layout.tsx                      # banner "MODO PREVIEW — dados não salvam no servidor"
├── page.tsx                        # índice de todas as telas preview
├── reset/page.tsx                  # botão pra limpar localStorage
├── dashboard/page.tsx              # dashboard home
├── agenda/
│   ├── page.tsx                    # visão do dia
│   └── semana/page.tsx             # visão da semana
├── book/                           # cliente final — booking wizard
│   ├── page.tsx                    # step 1: serviço
│   ├── profissional/page.tsx       # step 2
│   ├── data/page.tsx               # step 3
│   ├── horario/page.tsx            # step 4
│   ├── login/page.tsx              # step 5 (mock: digita qualquer email)
│   ├── confirmar/page.tsx          # step 6
│   └── sucesso/page.tsx            # step 7
├── meus-agendamentos/page.tsx
├── financeiro/page.tsx
├── relatorios/page.tsx
├── perfil/page.tsx
├── equipe-servicos/page.tsx        # professional_services UI
├── disponibilidade/page.tsx        # availability + blocks editor
└── notificacoes/page.tsx
```

**Zero auth.** `/preview/*` é totalmente público, sem guard, sem proxy redirect. Cada rota é `'use client'` e consome localStorage.

### 3.2 Storage — `usePreviewStore`

```ts
// src/lib/preview/store.ts
export function usePreviewStore<T>(
  key: string,
  schema: z.ZodSchema<T>,
  seed: () => T,
): [T, (next: T) => void]
```

- Lê `localStorage[`preview:${key}`]`, valida com Zod
- Se inválido/ausente, usa `seed()` e grava
- Retorna `[state, setState]` — `setState` serializa e reescreve
- `undefined` em SSR (só roda em `useEffect` / client)
- Mudanças disparam `storage` event → outras abas sincronizam

### 3.3 Seed de dados

Um único módulo `src/lib/preview/seed.ts` exporta:

```ts
export const SEED = {
  tenant: { name: 'Barbearia Teste', slug: 'barbearia-teste', ... },
  professionals: [/* 3 profissionais mock */],
  services: [/* 5 serviços: corte, barba, combo, ... */],
  customers: [/* 10 clientes com user_id fake */],
  appointments: [/* 40 appointments espalhados em ±14 dias */],
  availability: [/* jornada semanal de cada profissional */],
  blocks: [/* 2 bloqueios exemplo (férias, médico) */],
  businessHours: [/* seg-sex 9-18, sab 9-14 */],
  currentUser: { email: 'voce@preview.dev', name: 'Você (preview)' },
}
```

A ideia é que o preview já **abre com dados realistas** — não começa vazio. Reset zera pra esse SEED.

### 3.4 Branding

Preview usa o branding visual do tenant `barbearia-teste` fixo (mesmas cores, mesma logo). Se quisermos trocar pra outro tenant, vira um seletor no topo do layout. MVP: fixo.

---

## 4. Contratos de tipos

Preview reaproveita **types dos Zod schemas reais** quando eles existirem. Ex:
- `src/lib/validation/schemas.ts` já define `ProfessionalInput`, `ServiceInput`, etc.
- `appointment` ainda não tem schema (Épico 4) — preview cria em `src/lib/preview/types.ts` e esse schema vira semente do Épico 4 quando chegar.

**Regra:** se o preview inventou um tipo, anotar no arquivo `// TODO(épico-X): promover pra schema real`. Facilita o merge depois.

---

## 5. Diferenças visuais

Pra não confundir com o app real:

- **Banner fixo no topo:** "🧪 MODO PREVIEW · dados locais, não salvam no servidor · [Reset]" em `bg-warning-bg/80 text-warning-fg border-b`.
- **Footer com link pra voltar pro app real** e link pro `/preview/reset`.
- **Storage key namespace:** `preview:*` (nunca colide com chaves reais do Supabase ou próprios do Next).

---

## 6. O que sai do preview quando vira real

Quando o Épico real for começado:
1. Preview copia os componentes visuais pra estrutura definitiva (`/salon/dashboard/agenda/*` ou `/book/*`)
2. Mantém o layout, troca `usePreviewStore` por `useActionState` + server action
3. Adiciona Zod schemas de verdade (se ainda não tem)
4. Adiciona RLS policies + migration
5. Remove a rota `/preview/<tela>` correspondente no commit que entrega o real

Ou seja: **preview é temporário**. Épico real **substitui**, não duplica. Cada tela promovida sai daqui.

---

## 7. Plano de execução

1. **Infra do preview** (Task 1): layout, banner, `usePreviewStore`, seed, índice `/preview`
2. **Dashboard home** (Task 2): cards de overview + próximos agendamentos
3. **Agenda dia** (Task 3): grid de slots, cards de appointment, click → detalhe
4. **Agenda semana** (Task 4): view horizontal 7 colunas
5. **Booking wizard** (Task 5): 7 steps com transições, URL-state pra progresso
6. **Meus agendamentos** (Task 6): lista + ações
7. **Financeiro** (Task 7): cards saldo/payout + tabela histórico mock
8. **Relatórios** (Task 8): 3 gráficos simples (chart.js ou puro SVG)
9. **Perfil / professional_services / availability / notificações** (Tasks 9–12)

Cada task fecha uma entrega visual com commit próprio. Sem interdependência dura — dá pra pular ordem.

---

## 8. Não-decisões (explicitamente)

- **Não** implementar RLS/policies fake no preview. Não há backend.
- **Não** importar `@/lib/supabase/*` no preview. Zero tocar no banco.
- **Não** reusar `/salon/login` — preview é público.
- **Não** fazer i18n — PT-BR hardcoded igual resto do app.
- **Não** preocupar com acessibilidade AAA agora — o foco é UX decisions. Acessibilidade vira pass de polimento depois (já existe débito no Épico 10 task 8).

---

## 9. Aceite

- Acessar `/preview` na home mostra lista de todas as telas preview com thumbnail/ícone
- Cada tela funciona standalone e persiste dados entre reloads
- Reset limpa tudo sem reiniciar servidor
- `/salon/login` + `/salon/dashboard/*` continuam iguais, sem regressão
- Lint, typecheck, tests continuam passando (61 hoje)
- Nenhuma tela preview faz request ao Supabase

---

## 10. Riscos e mitigações

- **Preview vira permanente:** cada tela no preview precisa ter uma tarefa correspondente no Épico relacionado (4/5/7) com check "substituir preview". Se virar 6+ meses de idade, matar sem promover — sinal de que a tela não era essencial.
- **Preview e real divergem:** se o Épico real mudar modelagem (ex: agenda virou grid virtualizado em vez de HTML simples), ignorar o preview — ele serviu pra decidir UX, não arquitetura.
- **Dados mockados mentem:** appointments com horários sempre limpos, clientes sempre preenchidos. Cuidar de casos extremos (nome longo, 0 agendamentos, dia com 50 agendamentos). Adicionar no SEED.

---

**Próximo passo:** alinhar escopo acima → começar Task 1 (infra + índice).
