import { describe, expect, it } from 'vitest'
import {
  resolveOnboardingState,
  nextStepPath,
  pathForStep,
  STAGE_1_STEPS,
  STAGE_2_STEPS,
  STAGE_3_STEPS,
  type OnboardingTenantSnapshot,
} from '@/lib/onboarding/derivations'

const NOTHING_DONE: OnboardingTenantSnapshot = {
  onboarding_completed_at: null,
  onboarding_branding_completed_at: null,
  onboarding_communication_completed_at: null,
  onboarding_step: null,
}

const STAGE1_DONE: OnboardingTenantSnapshot = {
  onboarding_completed_at: '2026-04-30T10:00:00Z',
  onboarding_branding_completed_at: null,
  onboarding_communication_completed_at: null,
  onboarding_step: null,
}

const ALL_DONE: OnboardingTenantSnapshot = {
  onboarding_completed_at: '2026-04-30T10:00:00Z',
  onboarding_branding_completed_at: '2026-04-30T11:00:00Z',
  onboarding_communication_completed_at: '2026-04-30T12:00:00Z',
  onboarding_step: null,
}

describe('resolveOnboardingState', () => {
  it('all completed → allCompleted=true, currentStage=null', () => {
    const s = resolveOnboardingState(ALL_DONE)
    expect(s.allCompleted).toBe(true)
    expect(s.currentStage).toBeNull()
    expect(s.currentStep).toBeNull()
  })

  it('nothing done → currentStage=1, currentStep=hours', () => {
    const s = resolveOnboardingState(NOTHING_DONE)
    expect(s.allCompleted).toBe(false)
    expect(s.currentStage).toBe(1)
    expect(s.currentStep).toBe('hours')
    expect(s.stage1.completed).toBe(false)
    expect(s.stage1.completedSteps).toBe(0)
    expect(s.stage1.totalSteps).toBe(4)
  })

  it('mid-services → stage1, currentStep=services, completedSteps=1', () => {
    const s = resolveOnboardingState({
      ...NOTHING_DONE,
      onboarding_step: 'services',
    })
    expect(s.currentStage).toBe(1)
    expect(s.currentStep).toBe('services')
    expect(s.stage1.completedSteps).toBe(1)
  })

  it('stage 1 done, stage 2 in progress (brand) → currentStage=2', () => {
    const s = resolveOnboardingState({
      ...STAGE1_DONE,
      onboarding_step: 'brand',
    })
    expect(s.currentStage).toBe(2)
    expect(s.currentStep).toBe('brand')
    expect(s.stage1.completed).toBe(true)
    expect(s.stage2.completed).toBe(false)
    expect(s.stage2.completedSteps).toBe(0)
    expect(s.stage2.totalSteps).toBe(2)
  })

  it('stage 1 + 2 done, no step set → currentStage=3, currentStep=email (first of stage 3)', () => {
    const s = resolveOnboardingState({
      ...STAGE1_DONE,
      onboarding_branding_completed_at: '2026-05-01T00:00:00Z',
    })
    expect(s.currentStage).toBe(3)
    expect(s.currentStep).toBe('email')
    expect(s.stage3.completedSteps).toBe(0)
    expect(s.stage3.totalSteps).toBe(3)
  })
})

describe('nextStepPath', () => {
  it('all done → /admin/dashboard', () => {
    expect(nextStepPath(resolveOnboardingState(ALL_DONE))).toBe('/admin/dashboard')
  })
  it('nothing done → /admin/setup/horarios', () => {
    expect(nextStepPath(resolveOnboardingState(NOTHING_DONE))).toBe('/admin/setup/horarios')
  })
  it('stage 1 done → /admin/setup/marca', () => {
    expect(nextStepPath(resolveOnboardingState(STAGE1_DONE))).toBe('/admin/setup/marca')
  })
})

describe('pathForStep', () => {
  it('mapeia todos os steps', () => {
    expect(pathForStep('hours')).toBe('/admin/setup/horarios')
    expect(pathForStep('brand')).toBe('/admin/setup/marca')
    expect(pathForStep('email')).toBe('/admin/setup/email')
    expect(pathForStep('whatsapp')).toBe('/admin/setup/whatsapp')
    expect(pathForStep('push')).toBe('/admin/setup/push')
  })
})

describe('STAGE constants', () => {
  it('stage 1 tem 4 steps na ordem certa', () => {
    expect(STAGE_1_STEPS).toEqual(['hours', 'services', 'professionals', 'links'])
  })
  it('stage 2 tem 2 steps', () => {
    expect(STAGE_2_STEPS).toEqual(['brand', 'landing'])
  })
  it('stage 3 tem 3 steps', () => {
    expect(STAGE_3_STEPS).toEqual(['email', 'whatsapp', 'push'])
  })
})
