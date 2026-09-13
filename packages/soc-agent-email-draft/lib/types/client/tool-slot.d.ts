import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallBlock } from 'dsh-soc-agent-ui-conversation/client';
/** Structural owner currency supplied by the generic rc.2 tool renderer. */
export interface SocToolCallOwnerProps {
    callId: string;
    toolName: string;
    block: ToolCallBlock;
    cwd?: string;
    home?: string;
    openFile(path: string, options?: {
        line?: number;
    }): void;
    loadImage: (...args: any[]) => any;
    inspect?: () => void;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'tool.call.toolview': {
            kind: 'keyed';
            scope: 'session';
            owner: SocToolCallOwnerProps;
        };
    }
}
export type ToolCallViewProps = PropsRuntime<'tool.call.toolview'>;
