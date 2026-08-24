import { Service } from '@deepseek-ai/cordis';
import { realpath } from 'node:fs/promises';
import { isAbsolute, normalize, resolve } from 'node:path';
export class WorkspaceSessionCleanupError extends Error {
    details;
    constructor(message, details = {}, options) {
        super(message, options);
        this.details = details;
        this.name = 'WorkspaceSessionCleanupError';
    }
}
function isMissingPath(error) {
    const code = error?.code;
    return code === 'ENOENT' || code === 'ENOTDIR';
}
async function canonicalWorkspacePath(input) {
    if (typeof input !== 'string' || input.length === 0 || input.trim().length === 0) {
        throw new WorkspaceSessionCleanupError('workspace path must be a non-empty string');
    }
    const absolute = resolve(input);
    try {
        return await realpath(absolute);
    }
    catch (error) {
        throw new WorkspaceSessionCleanupError(`cannot canonicalize workspace path '${input}': ${String(error)}`, {}, { cause: error });
    }
}
async function canonicalSessionPath(input) {
    if (typeof input !== 'string' || input.length === 0 || !isAbsolute(input))
        return undefined;
    const absolute = resolve(input);
    try {
        return await realpath(absolute);
    }
    catch (error) {
        if (!isMissingPath(error))
            throw error;
        // Historical headers may point at a directory that no longer exists. Keep
        // matching useful for syntactically equivalent paths without treating a
        // failed realpath as permission to follow a different symlink.
        return normalize(absolute);
    }
}
function sessionHeader(session) {
    return session.header;
}
export class WorkspaceSessionCleanupService extends Service {
    static inject = ['sessionPersistence', 'sessions'];
    constructor(ctx) {
        super(ctx, 'workspaceSessionCleanup');
    }
    async previewWorkspaceSessionCleanup(workspacePath) {
        const normalizedWorkspacePath = await canonicalWorkspacePath(workspacePath);
        const candidates = await this.findCandidates(normalizedWorkspacePath);
        const matchingSessions = candidates.map(({ header }) => ({
            sessionId: header.id,
            createdAt: header.createdAt,
            cwd: header.cwd,
        }));
        return {
            normalizedWorkspacePath,
            matchingSessionCount: matchingSessions.length,
            matchingSessionIds: matchingSessions.map(session => session.sessionId),
            matchingSessions,
        };
    }
    async deleteWorkspaceSessions(workspacePath) {
        const normalizedWorkspacePath = await canonicalWorkspacePath(workspacePath);
        const candidates = await this.findCandidates(normalizedWorkspacePath);
        let deletedSessionCount = 0;
        const failedSessionIds = [];
        const failures = [];
        for (const candidate of candidates) {
            try {
                if (await this.deleteSession(candidate.header.id, candidate.durable))
                    deletedSessionCount += 1;
            }
            catch (error) {
                failedSessionIds.push(candidate.header.id);
                failures.push(error);
            }
        }
        if (failures.length > 0) {
            throw new WorkspaceSessionCleanupError(`workspace session cleanup deleted ${deletedSessionCount} of ${candidates.length} sessions`, { normalizedWorkspacePath, deletedSessionCount, failedSessionIds }, { cause: new AggregateError(failures, 'one or more session deletions failed') });
        }
        return deletedSessionCount;
    }
    async findCandidates(normalizedWorkspacePath) {
        let persisted;
        let live;
        try {
            ;
            [persisted, live] = await Promise.all([
                this.ctx.sessionPersistence.list(),
                Promise.resolve(this.ctx.sessions.list()),
            ]);
        }
        catch (error) {
            throw new WorkspaceSessionCleanupError(`cannot list Harness sessions for workspace cleanup: ${String(error)}`, { normalizedWorkspacePath }, { cause: error });
        }
        const byId = new Map();
        for (const header of persisted)
            byId.set(header.id, { header, durable: true });
        for (const session of live)
            byId.set(session.id, { header: sessionHeader(session), durable: byId.get(session.id)?.durable ?? false });
        const matching = [];
        for (const candidate of byId.values()) {
            if (candidate.header.cwd === undefined)
                continue;
            const normalizedCwd = await canonicalSessionPath(candidate.header.cwd);
            if (normalizedCwd === normalizedWorkspacePath)
                matching.push(candidate);
        }
        return matching;
    }
    async deleteSession(sessionId, durable) {
        let deleted = false;
        const live = this.ctx.sessions.get(sessionId);
        if (live !== undefined) {
            const agent = this.ctx.get('agents')?.get(sessionId);
            if (agent !== undefined)
                await agent.ctx.fiber.dispose();
            const remaining = this.ctx.sessions.get(sessionId);
            if (remaining !== undefined) {
                await this.ctx.sessions.flush(remaining);
                deleted = this.ctx.sessions.deleteSession(sessionId) || deleted;
            }
            else {
                deleted = true;
            }
        }
        if (durable)
            deleted = (await this.ctx.sessionPersistence.deleteSession(sessionId)) || deleted;
        return deleted;
    }
}
//# sourceMappingURL=service.js.map