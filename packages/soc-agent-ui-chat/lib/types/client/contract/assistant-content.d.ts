import type { AssistantBlock } from 'dsh-soc-agent-ui-conversation/client';
/**
 * Test whether Assistant blocks contain a user-facing reply rather than only
 * reasoning or Tool-call protocol material.
 * @param blocks - Assistant content blocks.
 * @returns whether the blocks contain visible reply content.
 */
export declare function hasAssistantReplyContent(blocks: readonly AssistantBlock[]): boolean;
