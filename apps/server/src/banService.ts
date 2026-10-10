/** Identifier of a barred re-entry: a room and the kicked participant. */
export const banKey = (roomId: string, userId: string): string => `${roomId}:${userId}`;

/** Identifier of a bar that follows a revoked token. */
export const tokenBanKey = (token: string): string => `token:${token}`;

/** A bar that lives on a credential rather than on a live session. */
interface TokenBan {
    roomId: string;
    userId: string;
    until: number;
}

/** Identifier of a bar that follows a browser profile rather than a session. */
export const clientBanKey = (roomId: string, clientId: string): string =>
    `client:${roomId}:${clientId}`;

/** A bar that lives on a browser profile. */
interface ClientBan {
    roomId: string;
    until: number;
}

/**
 * Raises friction against a participant who was just removed from a room.
 *
 * Removing a participant from the roster does not keep them out: an open room
 * accepts a fresh `JOIN_ROOM` from the same client, which turns a moderation
 * action into a rename. This bar softens that, and it is **advisory** — it
 * holds the client that comes back with something it was removed with, and
 * nothing more:
 *
 * - the session token itself, because kicking revokes that token — without a
 *   tombstone on the credential, the very next join would present a dead token
 *   and be handed a brand-new participant, and the bar would never fire;
 * - the participant identifier, for a join that still proves it with a live
 *   session token;
 * - the browser profile, carried by a first-party cookie the application never
 *   reads, which survives the token revocation and a reload.
 *
 * A client that rejoins with none of those is simply a new participant: it
 * arrives with an unknown token, a fresh id and a cleared cookie, which no
 * server-side list can tell apart from a genuine newcomer. Preventing *that*
 * needs a credential the client cannot discard, and the only other one
 * available here — the client address — is the proxy's, so it would bar the
 * room instead of the participant. The bar therefore buys the host a quiet
 * moment, not a locked door.
 *
 * Every bar expires on its own, so a removal is a timeout rather than a
 * permanent lockout.
 */
export class BanService {
    private readonly bannedUntil = new Map<string, number>();
    private readonly bannedTokens = new Map<string, TokenBan>();
    private readonly bannedClients = new Map<string, ClientBan>();

    /**
     * Bars a participant from joining a room.
     *
     * @param roomId - The room the participant was removed from.
     * @param userId - The removed participant identifier.
     * @param now - Current timestamp, in milliseconds.
     * @param durationMs - How long the bar lasts, in milliseconds.
     */
    public ban(roomId: string, userId: string, now: number, durationMs: number): void {
        this.bannedUntil.set(banKey(roomId, userId), now + durationMs);
    }

    /**
     * Bars the credentials that a kick revoked, so the removal survives it.
     *
     * @param tokens - The session tokens revoked by the kick.
     * @param roomId - The room the participant was removed from.
     * @param userId - The removed participant identifier.
     * @param now - Current timestamp, in milliseconds.
     * @param durationMs - How long the bar lasts, in milliseconds.
     */
    public banTokens(
        tokens: string[],
        roomId: string,
        userId: string,
        now: number,
        durationMs: number
    ): void {
        tokens.forEach((token) => {
            this.bannedTokens.set(tokenBanKey(token), {
                roomId,
                until: now + durationMs,
                userId,
            });
        });
    }

    /**
     * Reports whether a revoked credential is still barred from rejoining.
     *
     * @param token - The session token presented by the join attempt.
     * @param now - Current timestamp, in milliseconds.
     * @returns True while the bar is in force.
     */
    public isTokenBanned(token: string, now: number): boolean {
        const ban = this.bannedTokens.get(tokenBanKey(token));
        if (!ban) {
            return false;
        }
        if (ban.until <= now) {
            this.bannedTokens.delete(tokenBanKey(token));
            return false;
        }
        return true;
    }

    /**
     * Reports the room and participant a barred credential was bound to.
     *
     * @param token - The session token presented by the join attempt.
     * @param now - Current timestamp, in milliseconds.
     * @returns The binding, or null when the token is not barred.
     */
    public tokenBanFor(token: string, now: number): { roomId: string; userId: string } | null {
        if (!this.isTokenBanned(token, now)) {
            return null;
        }
        const ban = this.bannedTokens.get(tokenBanKey(token));
        return ban ? { roomId: ban.roomId, userId: ban.userId } : null;
    }

    /**
     * Bars a browser profile from rejoining a room.
     *
     * @param roomId - The room the participant was removed from.
     * @param clientId - The identity cookie carried by that participant.
     * @param now - Current timestamp, in milliseconds.
     * @param durationMs - How long the bar lasts, in milliseconds.
     */
    public banClient(roomId: string, clientId: string, now: number, durationMs: number): void {
        this.bannedClients.set(clientBanKey(roomId, clientId), { roomId, until: now + durationMs });
    }

    /**
     * Reports whether a browser profile is barred from a room.
     *
     * @param roomId - The room being joined.
     * @param clientId - The identity cookie of the joining client.
     * @param now - Current timestamp, in milliseconds.
     * @returns True while the bar is in force.
     */
    public isClientBanned(roomId: string, clientId: string, now: number): boolean {
        const ban = this.bannedClients.get(clientBanKey(roomId, clientId));
        if (!ban) {
            return false;
        }
        if (ban.until <= now) {
            this.bannedClients.delete(clientBanKey(roomId, clientId));
            return false;
        }
        return true;
    }

    /**
     * Reports whether a participant is currently barred from a room.
     *
     * Expired bars are dropped on read, so the map cannot outlive its windows.
     *
     * @param roomId - The room being joined.
     * @param userId - The participant attempting to join.
     * @param now - Current timestamp, in milliseconds.
     * @returns True while the bar is in force.
     */
    public isBanned(roomId: string, userId: string, now: number): boolean {
        const until = this.bannedUntil.get(banKey(roomId, userId));
        if (until === undefined) {
            return false;
        }
        if (until <= now) {
            this.bannedUntil.delete(banKey(roomId, userId));
            return false;
        }
        return true;
    }

    /**
     * Drops every expired bar.
     *
     * @param now - Current timestamp, in milliseconds.
     */
    public sweep(now: number): void {
        this.bannedUntil.forEach((until, key) => {
            if (until <= now) {
                this.bannedUntil.delete(key);
            }
        });
        this.bannedTokens.forEach((ban, key) => {
            if (ban.until <= now) {
                this.bannedTokens.delete(key);
            }
        });
        this.bannedClients.forEach((ban, key) => {
            if (ban.until <= now) {
                this.bannedClients.delete(key);
            }
        });
    }
}
