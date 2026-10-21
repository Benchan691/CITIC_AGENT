type DraftOutcome = 'sent' | 'discarded';
type EmailDraftViewState = {
    outcomes: Record<string, DraftOutcome>;
};
/** Session-scoped presentation outcomes, keyed by the durable tool call ID. */
export declare function createEmailDraftViewStore(): import("@deepseek-ai/dsh-client-runtime/client").EngineStoreHandle<EmailDraftViewState, {
    setOutcome: (state: EmailDraftViewState, callId: string, outcome: DraftOutcome) => void;
    reopen: (state: EmailDraftViewState, callId: string) => void;
}>;
export {};
