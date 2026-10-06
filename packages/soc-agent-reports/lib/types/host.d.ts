import type { IncomingMessage, ServerResponse } from 'node:http';
export interface ReportAuth {
    requireSession(): {
        id: string;
        userId: string;
    };
}
export type ReportCommand = (command: string, payload: Record<string, unknown>) => Promise<unknown>;
/** The signed-in app session is always supplied by the host, never the browser. */
export declare function reportSettingsEndpoint(auth: ReportAuth, command: ReportCommand, endpoint: string, payload: unknown): Promise<{
    ok: false;
    error: {
        code: string;
        message: string;
        details: {};
    };
} | {
    ok: true;
    value: unknown;
}>;
export interface StoredReportArtifact {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    path: string;
    session_id: string;
}
export declare function validateStoredArtifact(value: unknown, id: string, sessionId: string): StoredReportArtifact;
/** Lookup authorizes user + conversation ownership before the host reads bytes. */
export declare function downloadReportArtifact(request: IncomingMessage, response: ServerResponse, auth: ReportAuth, command: ReportCommand): Promise<void>;
