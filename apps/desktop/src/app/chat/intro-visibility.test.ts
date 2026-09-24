import { describe, expect, it } from 'vitest'

import { isFreshPrimaryDraft, shouldShowIntro } from './intro-visibility'

const showing = {
  activeSessionId: null,
  auxiliaryWindow: false,
  enabled: true,
  freshDraftReady: true,
  messagesEmpty: true,
  primary: true,
  routedSessionView: false,
  selectedSessionId: null
} as const

describe('isFreshPrimaryDraft', () => {
  it('identifies an ordinary new chat even when the intro preference is off', () => {
    const introOff = { ...showing, enabled: false }
    expect(isFreshPrimaryDraft(introOff)).toBe(true)
    expect(shouldShowIntro(introOff)).toBe(false)
  })

  it('excludes sessions, nonprimary windows, and drafts that are not ready', () => {
    for (const input of [
      { ...showing, primary: false },
      { ...showing, auxiliaryWindow: true },
      { ...showing, freshDraftReady: false },
      { ...showing, routedSessionView: true },
      { ...showing, selectedSessionId: 'session-1' },
      { ...showing, activeSessionId: 'session-1' },
      { ...showing, messagesEmpty: false }
    ]) {
      expect(isFreshPrimaryDraft(input)).toBe(false)
    }
  })
})

describe('shouldShowIntro', () => {
  it('shows on a fresh draft in the primary window', () => {
    expect(shouldShowIntro(showing)).toBe(true)
  })

  it('hides when the Appearance toggle is off', () => {
    expect(shouldShowIntro({ ...showing, enabled: false })).toBe(false)
  })

  it('keeps the toggle authoritative over every other clause', () => {
    // Off means off: no window, session, or draft state re-enables the splash.
    const inputs = [
      { ...showing, auxiliaryWindow: true, enabled: false },
      { ...showing, enabled: false, freshDraftReady: false },
      { ...showing, enabled: false, primary: false },
      { ...showing, enabled: false, messagesEmpty: false }
    ]

    for (const input of inputs) {
      expect(shouldShowIntro(input)).toBe(false)
    }
  })

  it('hides on surfaces that are not an empty primary draft', () => {
    expect(shouldShowIntro({ ...showing, primary: false })).toBe(false)
    expect(shouldShowIntro({ ...showing, auxiliaryWindow: true })).toBe(false)
    expect(shouldShowIntro({ ...showing, freshDraftReady: false })).toBe(false)
    expect(shouldShowIntro({ ...showing, routedSessionView: true })).toBe(false)
    expect(shouldShowIntro({ ...showing, selectedSessionId: 'session-1' })).toBe(false)
    expect(shouldShowIntro({ ...showing, activeSessionId: 'session-1' })).toBe(false)
    expect(shouldShowIntro({ ...showing, messagesEmpty: false })).toBe(false)
  })
})
