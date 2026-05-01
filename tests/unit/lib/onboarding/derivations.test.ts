import { describe, expect, it } from 'vitest'
import {
  resolveOnboardingState,
  nextStepPath,
  STEP_ORDER,
  type OnboardingTenantSnapshot,
} from '@/lib/onboarding/derivations'

const completed: OnboardingTenantSnapshot = {
  onboarding_completed_at: '2026-04-30T10:00:00Z',
  onboarding_step: null,
}
const fresh: OnboardingTenantSnapshot = {
  onboarding_completed_at: null,
  onboarding_step: null,
}
const midServices: OnboardingTenantSnapshot = {
  onboarding_completed_at: null,
  onboarding_step: 'services',
}

describe('resolveOnboardingState', () => {
  it('completed quando completed_at é não-null', () => {
    expect(resolveOnboardingState(completed)).toEqual({
      completed: true,
      currentStep: null,
      completedSteps: 4,
    })
  })
  it('fresh quando ambos null → currentStep=hours, 0 completos', () => {
    expect(resolveOnboardingState(fresh)).toEqual({
      completed: false,
      currentStep: 'hours',
      completedSteps: 0,
    })
  })
  it('mid-services → currentStep=services, 1 completo', () => {
    expect(resolveOnboardingState(midServices)).toEqual({
      completed: false,
      currentStep: 'services',
      completedSteps: 1,
    })
  })
  it('mid-links → 3 completos', () => {
    expect(
      resolveOnboardingState({ onboarding_completed_at: null, onboarding_step: 'links' }),
    ).toEqual({ completed: false, currentStep: 'links', completedSteps: 3 })
  })
})

describe('nextStepPath', () => {
  it('hours → /admin/setup/horarios', () => {
    expect(nextStepPath('hours')).toBe('/admin/setup/horarios')
  })
  it('services → /admin/setup/servicos', () => {
    expect(nextStepPath('services')).toBe('/admin/setup/servicos')
  })
  it('professionals → /admin/setup/profissionais', () => {
    expect(nextStepPath('professionals')).toBe('/admin/setup/profissionais')
  })
  it('links → /admin/setup/vinculos', () => {
    expect(nextStepPath('links')).toBe('/admin/setup/vinculos')
  })
  it('null → /admin/dashboard (já completou)', () => {
    expect(nextStepPath(null)).toBe('/admin/dashboard')
  })
})

describe('STEP_ORDER', () => {
  it('contém 4 steps na ordem certa', () => {
    expect(STEP_ORDER).toEqual(['hours', 'services', 'professionals', 'links'])
  })
})
