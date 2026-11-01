import { ErrorCode, JoinRoomPayload } from '@planitpoker/shared';

import { auditLog } from './auditLogger.js';
import { BanService } from './banService.js';
import { JoinFailureLimiter } from './joinFailureLimiter.js';
import { ExtendedWebSocket } from './sessionRegistry.js';
import { sessionService } from './sessionService.js';

/** What a join presented, once its room code and proven identity are resolved. */
export interface JoinAttempt {
    /** Peer address of the connection, for the failed-join budget. */
    address: string;
    /** Room code exactly as the client typed it, for the refusal message. */
    roomId: string;
    /** Room code normalized for the bar lookups. */
    normalizedRoomId: string;
    /** Time of the attempt, shared by every bar it is checked against. */
    now: number;
    /** Participant the join proved with a session token bound to this room. */
    provenUserId?: string;
    /** Session token the client presented, if any. */
    sessionToken?: string | null;
}

/**
 * Resolves what a join asks for before the room is even consulted.
 *
 * The identity a join claims is only proof when the presented token binds that
 * participant to the room being entered, so it is resolved here and never taken
 * from the request as-is.
 *
 * @param payload - The join request.
 * @param remoteAddress - The peer address, when the handshake carried one.
 * @returns The normalized attempt the bars and the room lookup use.
 */
export const resolveJoinAttempt = (
    payload: JoinRoomPayload,
    remoteAddress?: string
): JoinAttempt => {
    const normalizedRoomId = payload.roomId.toUpperCase();
    const binding = sessionService.resolve(payload.sessionToken);
    const isRoomBound = binding?.roomId === normalizedRoomId;
    const isUserBound = !payload.userId || binding?.userId === payload.userId;
    const provenUserId = isRoomBound && isUserBound ? binding?.userId : undefined;

    return {
        address: remoteAddress ?? 'unknown',
        normalizedRoomId,
        now: Date.now(),
        provenUserId,
        roomId: payload.roomId,
        sessionToken: payload.sessionToken,
    };
};

/** Sends a machine-readable refusal to a client. */
type SendError = (ws: ExtendedWebSocket, message: string, code: ErrorCode) => void;

/** Dependencies the admission checks need, all of them state the handler owns. */
export interface JoinAdmissionOptions {
    /** Bars a kicked participant from re-entering the room immediately. */
    bans: BanService;
    /** Budget of failed room joins granted to one address. */
    joinFailures: JoinFailureLimiter;
    /** Sends the refusal to the socket that asked to join. */
    sendError: SendError;
}

/**
 * Decides which joins get past the door, and answers the ones that do not.
 *
 * Every bar here stands in front of the room rather than inside it: the kick
 * bans, the requirement that a non-browser client proves who it is, and the ban
 * that survives a discarded token. A join that reaches the room is past all of
 * them.
 */
export class JoinAdmission {
    private readonly bans: BanService;
    private readonly joinFailures: JoinFailureLimiter;
    private readonly sendError: SendError;

    /**
     * @param options - The bar state, and the way a refusal reaches its sender.
     */
    constructor(options: JoinAdmissionOptions) {
        this.bans = options.bans;
        this.joinFailures = options.joinFailures;
        this.sendError = options.sendError;
    }

    /**
     * Turns away a join that the room has not even been asked about yet.
     *
     * @param ws - The sender's WebSocket connection.
     * @param attempt - What the join presented, and where it came from.
     * @returns True when the join was turned away and must go no further.
     */
    public refuse(ws: ExtendedWebSocket, attempt: JoinAttempt): boolean {
        const { normalizedRoomId, now, provenUserId, sessionToken } = attempt;

        // A kick revokes the token the client is holding, so the bar has to be
        // checked on the presented credential: without this the client would
        // come back with a dead token, have no identity to match, and be
        // handed a brand-new participant.
        const tokenBan = sessionToken ? this.bans.tokenBanFor(sessionToken, now) : null;
        if (tokenBan) {
            this.reportBanned(ws, tokenBan.roomId, tokenBan.userId);
            return true;
        }

        // The bar that survives the revoked token: a browser that was just
        // kicked can reconnect with a new tab, no token and a fresh name, and
        // would otherwise be admitted as a brand-new participant.
        if (ws.clientId && this.bans.isClientBanned(normalizedRoomId, ws.clientId, now)) {
            this.reportBanned(ws, normalizedRoomId);
            return true;
        }

        // A browser with no identity cookie cannot be named by a kick ban —
        // in development the page is served from the Vite origin while the
        // socket reaches this server directly, so the cookie is not shared.
        // Refusing the join would break that setup, and the ban is advisory
        // anyway: the identity makes the bar hold, its absence makes it lapse.
        // Non-browser clients (no Origin) must still prove identity with a
        // valid session token bound to this room.
        if (!ws.hasOrigin && !provenUserId) {
            auditLog({ action: 'join.rejected.token-missing', outcome: 'denied' });
            this.sendError(
                ws,
                'A valid session token is required to join from a non-browser client.',
                'NO_SESSION'
            );
            return true;
        }

        // Same bar, reached when the join still proves its identity with a live
        // token — for instance a ban issued without the token being revoked.
        if (provenUserId && this.bans.isBanned(normalizedRoomId, provenUserId, now)) {
            this.reportBanned(ws, normalizedRoomId, provenUserId);
            return true;
        }

        return false;
    }

    /**
     * Reports a room code that matched no room.
     *
     * A code that matches no room is a guess, and it is the one signal a
     * brute-force attempt cannot avoid producing. The room was looked up first,
     * so a code that exists never consults this budget: the bar is for guessing,
     * not for joining, and a NAT'd team cannot be locked out of the room it is
     * actually entering.
     *
     * @param ws - The sender's WebSocket connection.
     * @param attempt - The join that matched no room.
     */
    public reportUnknownRoom(ws: ExtendedWebSocket, attempt: JoinAttempt): void {
        if (!this.joinFailures.allows(attempt.address, attempt.now)) {
            auditLog({ action: 'join.rejected.rate-limited', outcome: 'denied' });
            this.sendError(
                ws,
                'Too many wrong room codes from this network. Try again in a minute.',
                'RATE_LIMITED'
            );
            return;
        }
        this.joinFailures.recordFailure(attempt.address, attempt.normalizedRoomId, attempt.now);
        auditLog({
            action: 'join.rejected.room-not-found',
            outcome: 'denied',
            roomId: attempt.normalizedRoomId,
        });
        this.sendError(
            ws,
            `Room "${attempt.roomId}" not found. Please check room code.`,
            'ROOM_NOT_FOUND'
        );
    }

    /**
     * Audits and answers a join from a participant a kick barred.
     *
     * @param ws - The sender's WebSocket connection.
     * @param roomId - The room the bar was issued in.
     * @param userId - The participant the bar names, when the join proved one.
     */
    private reportBanned(ws: ExtendedWebSocket, roomId: string, userId?: string): void {
        auditLog({
            action: 'join.rejected.banned',
            outcome: 'denied',
            roomId,
            userId,
        });
        this.sendError(
            ws,
            'You were removed from this session. Try again in a few minutes.',
            'BANNED'
        );
    }
}
