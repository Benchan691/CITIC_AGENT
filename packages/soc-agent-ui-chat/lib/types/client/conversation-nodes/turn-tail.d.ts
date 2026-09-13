import type { Context } from '@deepseek-ai/cordis';
import type { ConversationMatch, ConversationNodeDefinition } from 'dsh-soc-agent-ui-conversation/client';
import type { TurnTailChatData } from '../contract/chat-nodes.ts';
declare module '../contract/chat-nodes.ts' {
    interface ChatNodeDataMap {
        /** Completed-turn actions and extension tail. */
        'turn-tail': TurnTailChatData;
    }
}
declare module 'dsh-soc-agent-ui-conversation/client' {
    interface ConversationTurnDataMap {
        /** Closing Assistant and footer facts derived for this completed Turn. */
        'turn-tail': TurnTailChatData;
    }
}
interface TurnTailState {
    readonly turn: number;
    readonly end?: ConversationMatch;
}
/** Completed-turn footer Definition independent of any Assistant row. */
export declare const turnTailDefinition: ConversationNodeDefinition<TurnTailState>;
/**
 * Register completed-Turn footer data and its Chat node contribution.
 * @param ctx - owning UI Conversation context.
 */
export declare function registerTurnTailConversationNode(ctx: Context): void;
export {};
