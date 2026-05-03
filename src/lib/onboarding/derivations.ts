/**
 * Wizard de onboarding modelado em 3 etapas independentes. Cada etapa
 * tem N sub-steps. Tenant pode pular entre etapas — concluir Etapa 1
 * NÃO obriga começar a 2.
 *
 * Persistência:
 *   - Etapa 1 done: `tenants.onboarding_completed_at` (legacy, mantido)
 *   - Etapa 2 done: `tenants.onboarding_branding_completed_at`
 *   - Etapa 3 done: `tenants.onboarding_communication_completed_at`
 *   - Step atual dentro da etapa em curso: `tenants.onboarding_step` (texto)
 */

export const STAGE_1_STEPS = ['hours', 'services', 'professionals', 'links'] as const
export const STAGE_2_STEPS = ['brand', 'landing'] as const
export const STAGE_3_STEPS = ['email', 'whatsapp', 'push'] as const

export type Stage1Step = (typeof STAGE_1_STEPS)[number]
export type Stage2Step = (typeof STAGE_2_STEPS)[number]
export type Stage3Step = (typeof STAGE_3_STEPS)[number]
export type OnboardingStep = Stage1Step | Stage2Step | Stage3Step

export type StageId = 1 | 2 | 3

export const STAGE_TITLES: Record<StageId, string> = {
  1: 'Configure seu negócio',
  2: 'Personalize a marca',
  3: 'Configurar comunicação',
}

export const STAGE_TOTAL_STEPS: Record<StageId, number> = {
  1: STAGE_1_STEPS.length,
  2: STAGE_2_STEPS.length,
  3: STAGE_3_STEPS.length,
}

const STEP_TO_PATH: Record<OnboardingStep, string> = {
  hours: '/admin/setup/horarios',
  services: '/admin/setup/servicos',
  professionals: '/admin/setup/profissionais',
  links: '/admin/setup/vinculos',
  brand: '/admin/setup/marca',
  landing: '/admin/setup/pagina-publica',
  email: '/admin/setup/email',
  whatsapp: '/admin/setup/whatsapp',
  push: '/admin/setup/push',
}

const STEP_TO_STAGE: Record<OnboardingStep, StageId> = {
  hours: 1,
  services: 1,
  professionals: 1,
  links: 1,
  brand: 2,
  landing: 2,
  email: 3,
  whatsapp: 3,
  push: 3,
}

export type OnboardingTenantSnapshot = {
  onboarding_completed_at: string | null
  onboarding_branding_completed_at: string | null
  onboarding_communication_completed_at: string | null
  onboarding_step: OnboardingStep | string | null
}

export type StageState = {
  stage: StageId
  title: string
  completed: boolean
  /** Step atual dentro da etapa (null se completed). */
  currentStep: OnboardingStep | null
  /** Quantos sub-steps já passaram (0 a totalSteps). */
  completedSteps: number
  totalSteps: number
}

export type OnboardingState = {
  /** True quando TODAS as 3 etapas estão concluídas. */
  allCompleted: boolean
  /** Etapa atual em curso (a primeira não concluída) ou null se all done. */
  currentStage: StageId | null
  /** Step atual da etapa em curso (null se currentStage é null). */
  currentStep: OnboardingStep | null
  stage1: StageState
  stage2: StageState
  stage3: StageState
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return (
    (STAGE_1_STEPS as readonly string[]).includes(value as string) ||
    (STAGE_2_STEPS as readonly string[]).includes(value as string) ||
    (STAGE_3_STEPS as readonly string[]).includes(value as string)
  )
}

function buildStageState(
  stage: StageId,
  steps: readonly OnboardingStep[],
  completedAt: string | null,
  rawStep: string | null,
): StageState {
  const completed = Boolean(completedAt)
  if (completed) {
    return {
      stage,
      title: STAGE_TITLES[stage],
      completed: true,
      currentStep: null,
      completedSteps: steps.length,
      totalSteps: steps.length,
    }
  }
  // Step atual: se onboarding_step pertence a essa etapa, usa; senão
  // assume primeiro step da etapa.
  const stepBelongsHere = isOnboardingStep(rawStep) && STEP_TO_STAGE[rawStep] === stage
  const currentStep: OnboardingStep = stepBelongsHere ? (rawStep as OnboardingStep) : steps[0]
  const idx = steps.indexOf(currentStep)
  return {
    stage,
    title: STAGE_TITLES[stage],
    completed: false,
    currentStep,
    completedSteps: idx >= 0 ? idx : 0,
    totalSteps: steps.length,
  }
}

export function resolveOnboardingState(snapshot: OnboardingTenantSnapshot): OnboardingState {
  const stage1 = buildStageState(
    1,
    STAGE_1_STEPS,
    snapshot.onboarding_completed_at,
    snapshot.onboarding_step,
  )
  const stage2 = buildStageState(
    2,
    STAGE_2_STEPS,
    snapshot.onboarding_branding_completed_at,
    snapshot.onboarding_step,
  )
  const stage3 = buildStageState(
    3,
    STAGE_3_STEPS,
    snapshot.onboarding_communication_completed_at,
    snapshot.onboarding_step,
  )

  // Etapa em curso: primeira não concluída na ordem 1→2→3.
  const currentStage: StageId | null = !stage1.completed
    ? 1
    : !stage2.completed
      ? 2
      : !stage3.completed
        ? 3
        : null
  const currentStep =
    currentStage === 1
      ? stage1.currentStep
      : currentStage === 2
        ? stage2.currentStep
        : currentStage === 3
          ? stage3.currentStep
          : null

  return {
    allCompleted: currentStage === null,
    currentStage,
    currentStep,
    stage1,
    stage2,
    stage3,
  }
}

/**
 * Path da próxima ação. Se há etapa em curso, vai pro step. Se todas
 * concluídas, vai pro dashboard.
 */
export function nextStepPath(state: OnboardingState): string {
  if (!state.currentStep) return '/admin/dashboard'
  return STEP_TO_PATH[state.currentStep]
}

export function pathForStep(step: OnboardingStep): string {
  return STEP_TO_PATH[step]
}

export function stageOfStep(step: OnboardingStep): StageId {
  return STEP_TO_STAGE[step]
}
