export declare const REPORT_CHANNEL = "/soc-agent-reports";
export declare const REPORT_TOOL_NAME = "mcp__soc_agent__generate_customer_report";
export declare const REPORT_DOWNLOAD_PREFIX = "/soc-agent-reports/download/";
export declare const PDF_MIME = "application/pdf";
export declare const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export declare const ARTIFACT_ID: RegExp;
export declare const SESSION_ID: RegExp;
export interface CustomerReportProfile {
    customer_id: string;
    display_name: string;
    report_id: string;
    company_name: string;
    email: {
        account: string;
        scope_type: 'folder' | 'label';
        scope: string;
        include_subfolders: boolean;
    };
    customer_senders: string[];
    report: {
        template: {
            owner: string;
            app: string;
            view: string;
        };
        output_stem: string;
        executive_summary_html?: string;
        security_analysis_html?: string;
    };
    news: {
        scope_type: 'folder' | 'label';
        scope: string;
        source_labels: string[];
        source_terms: string[];
        scan_limit: number;
    };
    extensions: Record<string, unknown>;
}
export interface CustomerReportSettings {
    account: string;
    customers: CustomerReportProfile[];
}
export interface ReportArtifact {
    id: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    download_url: string;
}
export type ReportPanelResult = {
    kind: 'working';
} | {
    kind: 'error';
    message: string;
} | {
    kind: 'success';
    artifacts: ReportArtifact[];
};
export declare function emptyCustomerProfile(account: string): CustomerReportProfile;
/** Browser validation is explanatory; the backend remains authoritative. */
export declare function validateCustomerProfiles(customers: readonly CustomerReportProfile[], account: string): string | null;
export declare function validArtifactType(filename: unknown, mime: unknown): boolean;
/** Admit only authenticated local report URLs, never URLs supplied by email. */
export declare function validReportArtifact(value: unknown): value is ReportArtifact;
/** MCP text is an envelope; artifacts must form one complete PDF/Excel pair. */
export declare function reportPanelResult(block: unknown): ReportPanelResult;
