import type { Context } from '@deepseek-ai/cordis';
import type { CompactionSummaryNode, ConversationMatch, ConversationNodeDefinition } from 'dsh-soc-agent-ui-conversation/client';
declare module '../contract/chat-nodes.ts' {
    interface ChatNodeDataMap {
        /** Automatic compaction checkpoint marker. */
        compaction: CompactionSummaryNode;
    }
}
interface CompactionState {
    readonly summary?: ConversationMatch;
    readonly checkpoint?: ConversationMatch;
}
/** Automatic compaction lifecycle and landed checkpoint Definition. */
export declare const compactionDefinition: ConversationNodeDefinition<CompactionState>;
/**
 * Register the automatic-compaction business contribution.
 * @param ctx - owning UI Conversation context.
 */
export declare function registerCompactionConversationNode(ctx: Context): void;
export {};
