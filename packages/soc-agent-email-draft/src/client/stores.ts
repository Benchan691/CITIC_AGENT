import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'

type DraftOutcome = 'sent' | 'discarded'
type EmailDraftViewState = { outcomes: Record<string, DraftOutcome> }

/** Session-scoped presentation outcomes, keyed by the durable tool call ID. */
export function createEmailDraftViewStore() {
  return defineStore({
    init: (): EmailDraftViewState => ({ outcomes: {} }),
    persist: 'soc.email-draft.view.v1',
    actions: {
      setOutcome: (state, callId: string, outcome: DraftOutcome) => {
        state.outcomes[callId] = outcome
      },
      reopen: (state, callId: string) => {
        delete state.outcomes[callId]
      },
    },
  })
}
