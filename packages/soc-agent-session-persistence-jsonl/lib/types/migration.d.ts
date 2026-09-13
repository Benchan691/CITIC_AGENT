/**
 * Fail-closed maintenance tooling for a SOC JSONL session root.
 *
 * This module deliberately lives beside the SOC persistence fork so the
 * migration command uses the same released format catalog, physical framing,
 * ownership-independent path rules, and immutable successor publisher as the
 * running backend. It never edits the upstream vendor snapshot.
 *
 * @module dsh-soc-agent-session-persistence-jsonl/migration
 */
import { type JsonlCompression } from './format.ts';
/** A compact, JSON-safe summary of one validated Session header. */
export interface SessionHeaderSummary {
    readonly storedVersion: number;
    readonly version: number;
    readonly id: string;
    readonly createdAt: number;
    readonly cwd: string | null;
    readonly parentSession: string | null;
    readonly isSeeded: boolean;
    readonly origin: 'subagent' | null;
    readonly delegationDepth: number;
    readonly agentPreset: string | null;
}
/** One generation report included in validation and migration output. */
export interface SessionGenerationReport {
    readonly path: string;
    readonly currentPath: string;
    readonly storedVersion: number;
    readonly selected: boolean;
    readonly header: SessionHeaderSummary;
    readonly eventCount: number;
    readonly inheritedEventCount: number;
    readonly bytes: number;
    readonly sha256: string;
}
/** All generations belonging to one physical Session directory. */
export interface SessionRootReport {
    readonly directory: string;
    readonly id: string;
    readonly cwd: string | null;
    readonly selectedVersion: number;
    readonly generations: readonly SessionGenerationReport[];
}
/** One regular file captured in a backup manifest. */
export interface SessionRootFileManifest {
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
}
/** On-disk ownership/workspace mapping accepted by the cutover tool. */
export interface SessionOwnershipManifest {
    readonly sessions: readonly SessionOwnershipEntry[];
    readonly workspaces: readonly WorkspaceOwnershipEntry[];
}
/** Ownership row for one persisted Session id. */
export interface SessionOwnershipEntry {
    readonly id: string;
    readonly userId: string;
    readonly workspaceId: string;
    readonly cwd?: string;
}
/** Ownership row for one logical workspace. */
export interface WorkspaceOwnershipEntry {
    readonly id: string;
    readonly userId: string;
    readonly path: string;
    readonly title?: string;
    readonly general?: boolean;
}
/** Result of a complete read-only root audit. */
export interface SessionRootAudit {
    readonly root: string;
    readonly compression: JsonlCompression;
    readonly currentVersion: number;
    readonly sessions: readonly SessionRootReport[];
    readonly files: readonly SessionRootFileManifest[];
}
/** Options shared by validation and migration. */
export interface SessionRootAuditOptions {
    readonly root: string;
    readonly compression: JsonlCompression;
    /** A JSON path or already parsed ownership manifest. */
    readonly ownershipManifest?: string | SessionOwnershipManifest;
    /** Explicitly bypass ownership validation; intended only for offline fixtures. */
    readonly skipOwnershipCheck?: boolean;
}
/** Options for publishing verified v3 successors and making backups. */
export interface SessionRootMigrationOptions extends SessionRootAuditOptions {
    readonly backupDir: string;
    readonly postgresUri?: string;
    readonly skipPostgresBackup?: boolean;
}
/** Result of a maintenance migration. */
export interface SessionRootMigrationResult {
    readonly backupDir: string;
    readonly postgresDump: string | null;
    readonly publishedSessionIds: readonly string[];
    readonly before: SessionRootAudit;
    readonly after: SessionRootAudit;
}
/** Result of restoring a previously verified immutable backup. */
export interface SessionRootRollbackResult {
    readonly restoredFrom: string;
    readonly displacedCurrentRoot: string;
}
/**
 * Audit every project/session/generation in a copied or maintenance root.
 * No recovery or truncation is allowed: torn, unknown, unsupported, or
 * structurally unexpected data rejects the complete audit.
 */
export declare function auditSessionRoot(options: SessionRootAuditOptions): Promise<SessionRootAudit>;
/**
 * Back up the exact session root and PostgreSQL ownership/settings data, then
 * publish only verified v3 successors. A partial interruption is resumable:
 * historical generations remain intact and an existing target is accepted
 * only when its bytes verify exactly.
 */
export declare function migrateSessionRoot(options: SessionRootMigrationOptions): Promise<SessionRootMigrationResult>;
/** Restore a verified backup, retaining the current root as a timestamped rollback sibling. */
export declare function rollbackSessionRoot(options: {
    readonly root: string;
    readonly backupDir: string;
    readonly yes: boolean;
}): Promise<SessionRootRollbackResult>;
/** Names used by the CLI and tests without exposing private file names. */
export declare const sessionMigrationFiles: Readonly<{
    backupManifest: "session-root-backup.json";
    migrationManifest: "session-root-migration.json";
}>;
