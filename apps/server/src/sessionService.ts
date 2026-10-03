import { randomUUID } from 'node:crypto';

/**
 * A server-issued session binding a connection to a room participant.
 */
export interface SessionBinding {
    roomId: string;
    userId: string;
}

/**
 * Issues and resolves opaque session tokens that prove ownership of a participant.
 *
 * Tokens are the only accepted proof of identity for reconnection; a client-supplied
 * `userId` alone is never trusted. Tokens live in memory alongside the rooms they
 * belong to and are revoked on kick or explicit invalidation.
 */
export class SessionService {
    private readonly sessions: Map<string, SessionBinding> = new Map();

    /**
     * Issues a new opaque token bound to a room participant.
     *
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     * @returns The generated session token.
     */
    public issue(roomId: string, userId: string): string {
        const token = randomUUID();
        this.sessions.set(token, { roomId, userId });
        return token;
    }

    /**
     * Resolves the binding for a token, if it is valid.
     *
     * @param token - The opaque session token.
     * @returns The bound room/user identifiers, or null when unknown.
     */
    public resolve(token: string | null | undefined): SessionBinding | null {
        if (!token) {
            return null;
        }
        return this.sessions.get(token) ?? null;
    }

    /**
     * Revokes a single token.
     *
     * @param token - The token to invalidate.
     */
    public revoke(token: string | null | undefined): void {
        if (token) {
            this.sessions.delete(token);
        }
    }

    /**
     * Revokes every token bound to a participant (e.g. after a kick).
     *
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     */
    public revokeByUser(roomId: string, userId: string): void {
        for (const [token, binding] of this.sessions) {
            if (binding.roomId === roomId && binding.userId === userId) {
                this.sessions.delete(token);
            }
        }
    }
}

/** Shared singleton session registry. */
export const sessionService = new SessionService();
