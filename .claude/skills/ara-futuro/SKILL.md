---
name: ara-futuro
description: Use quando o usuário tocar em planejamento de produto, roadmap, backlog, próximos passos, "e o nosso futuro?", premium features, fase 2, decisões adiadas, ou perguntar o que falta pro MVP/pós-MVP. Carrega o estado atual de docs/futuro.md e mantém ele atualizado quando novas ideias/decisões aparecerem.
---

# ara-futuro

Memória persistente de roadmap e decisões de produto do ara-agenda.
Source of truth: `docs/futuro.md` (versionado em git).

## Como usar

1. **Ao acionar:** leia `docs/futuro.md` ANTES de responder. Use o
   conteúdo como contexto base — não reinvente; complemente.

2. **Quando o usuário adicionar uma ideia nova:** proponha onde
   encaixar (Backlog Tier 1/2/3, Ideias em aberto, ou Não vamos
   fazer) e ofereça atualizar o doc no mesmo turno. Sempre incluir
   data (`YYYY-MM-DD`) no item.

3. **Quando uma decisão for tomada:** mover pra "Decisões tomadas"
   com data + razão curta + link pro commit/PR se aplicável.

4. **Quando algo do Backlog virar plano executável:** criar plano em
   `docs/superpowers/plans/YYYY-MM-DD-nome.md` (padrão do repo) e
   linkar no doc. Não duplicar conteúdo entre o plano executável e o
   `futuro.md` — `futuro.md` deve referenciar e remover do backlog.

## Critérios de tier (pra ajudar a categorizar)

- **Tier 1:** alto valor, esforço baixo-médio (< 1 semana de dev). Coisas
  que destravam algo já presente mas incompleto.
- **Tier 2:** alto valor, esforço alto. Features de Fase 2 que justificam
  mudança de pricing.
- **Tier 3:** marginal / experimental. Faz se sobrar tempo ou se um
  cliente piloto pedir explicitamente.
- **Ideias em aberto:** ainda não dá pra estimar valor ou esforço sem
  mais dado/conversa.
- **Não vamos fazer:** explicitamente descartado, **sempre com razão**.
  Razão importa pra futuras revisões — não apaga silenciosamente.

## Manutenção

- Doc curto > doc completo. Se uma seção crescer demais, dividir
  por tema ou arquivar partes velhas em `docs/futuro/` subfolder.
- Cada commit que mexe em `docs/futuro.md` segue padrão do repo:
  smoke test atualizado se aplicável, mensagem descritiva.
- Não confundir com:
  - `docs/superpowers/plans/` — planos executáveis com checklist por fase.
  - `docs/superpowers/specs/` — design técnico de feature.
  - `docs/smoke-test-pilot.md` — roteiro QA do que JÁ EXISTE.
- `futuro.md` é o nível acima de tudo isso: pensamento de produto,
  forward-looking, o "porquê depois faremos X".
