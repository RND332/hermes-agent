/** The ordinary primary-window draft before a session or transcript exists. */
interface FreshDraftInput {
  activeSessionId: null | string
  auxiliaryWindow: boolean
  freshDraftReady: boolean
  messagesEmpty: boolean
  primary: boolean
  routedSessionView: boolean
  selectedSessionId: null | string
}

export function isFreshPrimaryDraft(input: FreshDraftInput): boolean {
  return (
    input.primary &&
    !input.auxiliaryWindow &&
    input.freshDraftReady &&
    !input.routedSessionView &&
    !input.selectedSessionId &&
    !input.activeSessionId &&
    input.messagesEmpty
  )
}

/** The intro is user-toggleable, but layout eligibility is not. */
export function shouldShowIntro(input: FreshDraftInput & { enabled: boolean }): boolean {
  return input.enabled && isFreshPrimaryDraft(input)
}
