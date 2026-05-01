export const STEP_ORDER = ['hours', 'services', 'professionals', 'links'] as const
export type OnboardingStep = (typeof STEP_ORDER)[number]

export type OnboardingTenantSnapshot = {
  onboarding_completed_at: string | null
  onboarding_step: OnboardingStep | string | null
}

export type OnboardingState = {
  completed: boolean
  currentStep: OnboardingStep | null
  completedSteps: number
}

const STEP_TO_PATH: Record<OnboardingStep, string> = {
  hours: '/admin/setup/horarios',
  services: '/admin/setup/servicos',
  professionals: '/admin/setup/profissionais',
  links: '/admin/setup/vinculos',
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return STEP_ORDER.includes(value as OnboardingStep)
}

export function resolveOnboardingState(
  snapshot: OnboardingTenantSnapshot,
): OnboardingState {
  if (snapshot.onboarding_completed_at) {
    return { completed: true, currentStep: null, completedSteps: STEP_ORDER.length }
  }
  const step = isOnboardingStep(snapshot.onboarding_step)
    ? snapshot.onboarding_step
    : 'hours'
  return {
    completed: false,
    currentStep: step,
    completedSteps: STEP_ORDER.indexOf(step),
  }
}

export function nextStepPath(step: OnboardingStep | null): string {
  if (step === null) return '/admin/dashboard'
  return STEP_TO_PATH[step]
}
