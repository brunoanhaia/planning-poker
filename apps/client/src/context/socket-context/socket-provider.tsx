import {
    DeckType,
    ErrorCode,
    ErrorPayload,
    EstimateValue,
    RoomState,
    RoomStatePayload,
    RoomStatusPayload,
    ROOM_SWITCHED_CLOSE_CODE,
    SESSION_REPLACED_CLOSE_CODE,
    SessionPayload,
    WSMessageType,
} from '@planitpoker/shared';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ERROR_KEYS, TranslationKey } from '../../i18n/dictionary';
import { Translate } from '../../i18n/i18n-context';
import { useTranslation } from '../../i18n/use-translation';
import { forgetActiveRoom, readActiveRoom, rememberActiveRoom } from '../../utils/active-room';
import { chunkStoriesForImport, ImportableStory } from '../../utils/bulk-import';
import { resolveSocketUrl } from '../../utils/socket-url';
import {
    ConnectionStatus,
    SocketContext,
    SocketContextValue,
    StoredRoomStatus,
} from './socket-context';

/** Reconnection delay applied whenever the socket drops. */
const RECONNECT_DELAY_MS = 2000;

/**
 * How long the lobby waits for a stored-room check before falling back to the
 * join path.
 *
 * The check is an optimization, not a source of truth: if the server does not
 * answer, the switch dialog and the room-not-found fallback still work.
 */
const CHECK_ROOM_TIMEOUT_MS = 3000;

/**
 * How long a connection may stay unopened before the UI calls it a cold start.
 *
 * A free-tier backend can take tens of seconds to wake, so the form must say
 * so instead of looking frozen.
 */
const WAKE_GRACE_MS = 4000;

/** Session storage key holding the token that survives a page reload. */
const SESSION_TOKEN_STORAGE_KEY = 'planit_session_token';

/** Prefix of the local storage keys binding a browser to a room's participant. */
const ROOM_TOKEN_STORAGE_PREFIX = 'planit_room_token:';

/**
 * Local storage key holding the participant token for one room.
 *
 * Unlike session storage, this survives a new tab and a re-opened invite link,
 * so the same browser rejoins its existing participant instead of minting one.
 */
const roomTokenKey = (roomId: string): string => `${ROOM_TOKEN_STORAGE_PREFIX}${roomId}`;

/**
 * Stores the token for a room in both storages.
 *
 * The write is idempotent, so it happens unconditionally whenever the token and
 * the room are known. Comparing the stored value first would only add a local
 * string comparison of a credential, which tells an attacker nothing on the
 * client, while leaving the token visible to static analysis as a compared
 * secret; writing straight through keeps it opaque there.
 *
 * @param roomId Room the token belongs to.
 * @param token Participant token to persist.
 */
const persistRoomToken = (roomId: string, token: string): void => {
    sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(roomTokenKey(roomId), token);
};

/**
 * Token of the room this browser still holds, used to end that session when a
 * different room opens. The server verifies it, so switching never relies on a
 * client-supplied identity.
 *
 * @param targetRoomId - Room being opened, excluded because it is not a switch.
 * @returns The stored token of another room, or `null` when there is none.
 */
const previousRoomTokenFor = (targetRoomId: string): string | null => {
    const activeRoom = readActiveRoom();
    if (!activeRoom || activeRoom === targetRoomId) {
        return null;
    }
    return localStorage.getItem(roomTokenKey(activeRoom));
};

/** Errors that mean the room or session the client holds is gone, not merely unreachable. */
const SESSION_LOST_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
    'BANNED',
    'NO_SESSION',
    'ROOM_NOT_FOUND',
]);

/**
 * A server notice as received, kept untranslated.
 *
 * Storing the code instead of the rendered text is what lets an open notice
 * follow a language change; the provider translates it while building the
 * context value.
 */
interface ErrorNotice {
    code?: ErrorCode;
    /** Dictionary key for a notice the client raises itself. */
    key?: TranslationKey;
    /** English message the server sent, used when the code is unknown here. */
    message?: string;
}

/** Renders a notice in the active language, or `null` when there is none. */
const translateNotice = (notice: ErrorNotice | null, t: Translate): string | null => {
    if (!notice) {
        return null;
    }
    const key = notice.code
        ? (ERROR_KEYS as Partial<Record<string, TranslationKey>>)[notice.code]
        : notice.key;
    if (key) {
        return t(key);
    }
    // A code this build does not know: the server's own message is more useful
    // than the generic one, so it wins over the fallback.
    return notice.message ?? t('error.generic');
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t } = useTranslation();
    const [roomState, setRoomState] = useState<null | RoomState>(null);
    const [currentUserId, setCurrentUserId] = useState<null | string>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
        typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'connecting'
    );
    const [pendingEntry, setPendingEntry] = useState<null | 'create' | 'join'>(null);
    const [storedRoomStatus, setStoredRoomStatus] = useState<StoredRoomStatus>(() =>
        readActiveRoom() ? 'checking' : 'none'
    );
    const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
    const [isKicked, setIsKicked] = useState(false);
    const socketRef = useRef<null | WebSocket>(null);
    const sessionTokenRef = useRef<null | string>(null);
    const roomStateRef = useRef<null | RoomState>(null);
    const currentUserIdRef = useRef<null | string>(null);
    const pendingEntryRef = useRef<null | {
        kind: 'create' | 'join';
        payload: unknown;
        type: WSMessageType;
    }>(null);
    const entryInFlightRef = useRef<null | 'create' | 'join'>(null);
    const wasConnectedRef = useRef(false);
    const browserOfflineRef = useRef(false);
    const connectRef = useRef<null | (() => void)>(null);
    /**
     * Room of the most recent join attempt.
     *
     * A `ROOM_NOT_FOUND` for the stored active room means that session is
     * gone; the same code for a different room is a mistyped lobby code and
     * must not cost the browser the session it still holds.
     */
    const lastJoinRoomIdRef = useRef<null | string>(null);
    const checkedRoomIdRef = useRef<null | string>(null);
    const checkRoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        sessionTokenRef.current = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    }, []);

    const clearCheckRoomTimeout = useCallback(() => {
        if (checkRoomTimeoutRef.current) {
            clearTimeout(checkRoomTimeoutRef.current);
            checkRoomTimeoutRef.current = null;
        }
    }, []);

    /**
     * Drops the room binding from memory so no reconnect can re-enter it.
     *
     * Storage is left to the caller: whether a token survives depends on why
     * the room is being released.
     */
    const releaseRoom = useCallback(() => {
        roomStateRef.current = null;
        currentUserIdRef.current = null;
        setRoomState(null);
        setCurrentUserId(null);
    }, []);

    /**
     * Drops the token this tab holds for the room it is in, in both storages.
     *
     * Reads the room from the ref, so it must run before `releaseRoom`.
     */
    const forgetStoredToken = useCallback(() => {
        const roomId = roomStateRef.current?.id;
        sessionTokenRef.current = null;
        sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
        if (roomId) {
            localStorage.removeItem(roomTokenKey(roomId));
        }
    }, []);

    const forgetSession = useCallback(() => {
        const roomId = roomStateRef.current?.id;
        forgetStoredToken();
        releaseRoom();
        checkedRoomIdRef.current = null;
        clearCheckRoomTimeout();
        setStoredRoomStatus('none');
        if (roomId) {
            forgetActiveRoom(roomId);
        }
    }, [clearCheckRoomTimeout, forgetStoredToken, releaseRoom]);

    const transmit = useCallback((type: WSMessageType, payload: unknown) => {
        socketRef.current?.send(JSON.stringify({ payload, type }));
    }, []);

    /** Clears the in-flight marker, keeping a still-queued entry for the next open. */
    const resolveEntry = useCallback(() => {
        entryInFlightRef.current = null;
        if (!pendingEntryRef.current) {
            setPendingEntry(null);
        }
    }, []);

    /** Drops both the queued and the in-flight entry once it has been answered. */
    const clearEntry = useCallback(() => {
        pendingEntryRef.current = null;
        entryInFlightRef.current = null;
        setPendingEntry(null);
    }, []);

    /** Sends the queued create/join exactly once, as soon as the socket is open. */
    const flushPendingEntry = useCallback(() => {
        const entry = pendingEntryRef.current;
        if (!entry || socketRef.current?.readyState !== WebSocket.OPEN) {
            return;
        }
        pendingEntryRef.current = null;
        entryInFlightRef.current = entry.kind;
        transmit(entry.type, entry.payload);
    }, [transmit]);

    /** Keeps the wake notice and retry available until the outage ends. */
    const reportDialing = useCallback(() => {
        const dialing = wasConnectedRef.current ? 'reconnecting' : 'connecting';
        setConnectionStatus((current) => (current === 'waking' ? current : dialing));
    }, []);

    /**
     * Queues a create/join until the transport opens.
     *
     * A second click while the first request is queued or in flight is ignored,
     * so a double tap cannot create two rooms or two participants.
     */
    const enqueueEntry = useCallback(
        (
            kind: 'create' | 'join',
            type: WSMessageType,
            payload: unknown,
            attemptedRoomId: null | string
        ) => {
            // Once a request is in flight, any further entry must wait for its
            // answer; a queued request may still be replaced by the latest one.
            if (entryInFlightRef.current !== null) {
                return;
            }
            if (pendingEntryRef.current?.kind === kind) {
                return;
            }
            // Only an accepted request may move the room the next
            // `ROOM_NOT_FOUND` is compared against.
            lastJoinRoomIdRef.current = attemptedRoomId;
            pendingEntryRef.current = { kind, payload, type };
            setPendingEntry(kind);
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                flushPendingEntry();
                return;
            }
            if (browserOfflineRef.current || navigator.onLine === false) {
                setConnectionStatus('offline');
            } else {
                reportDialing();
            }
            connectRef.current?.();
        },
        [flushPendingEntry, reportDialing]
    );

    const send = useCallback(
        (type: WSMessageType, payload: unknown) => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                transmit(type, payload);
            } else {
                setErrorNotice({ key: 'error.offline' });
            }
        },
        [transmit]
    );

    /** Applies the answer to the stored-room preflight. */
    const applyRoomStatus = useCallback(
        (payload: RoomStatusPayload) => {
            if (roomStateRef.current !== null) {
                return;
            }
            if (payload.roomId !== checkedRoomIdRef.current) {
                // A late answer for a room that is no longer being checked.
                return;
            }
            checkedRoomIdRef.current = null;
            clearCheckRoomTimeout();
            if (payload.exists) {
                setStoredRoomStatus('exists');
                return;
            }
            // The stored room is gone: drop the record and every token bound to
            // it, so the lobby no longer offers a session that cannot rejoin.
            forgetActiveRoom(payload.roomId);
            localStorage.removeItem(roomTokenKey(payload.roomId));
            sessionTokenRef.current = null;
            sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
            lastJoinRoomIdRef.current = null;
            setStoredRoomStatus('gone');
        },
        [clearCheckRoomTimeout]
    );

    /**
     * Asks the server whether the room the browser remembers still exists.
     *
     * The check is a preflight, not a source of truth: if it times out the
     * client keeps the session and falls back to the normal switch/join path,
     * whose `ROOM_NOT_FOUND` handling clears a room that disappeared meanwhile.
     */
    const requestRoomStatus = useCallback(() => {
        const activeRoomId = readActiveRoom();
        if (!activeRoomId || roomStateRef.current !== null) {
            setStoredRoomStatus('none');
            return;
        }
        setStoredRoomStatus('checking');
        checkedRoomIdRef.current = activeRoomId;
        clearCheckRoomTimeout();
        checkRoomTimeoutRef.current = setTimeout(() => {
            if (checkedRoomIdRef.current !== activeRoomId) {
                return;
            }
            checkedRoomIdRef.current = null;
            setStoredRoomStatus('exists');
        }, CHECK_ROOM_TIMEOUT_MS);
        send('CHECK_ROOM', { roomId: activeRoomId });
    }, [clearCheckRoomTimeout, send]);

    /** Applies a `ROOM_STATE` broadcast: refs, rendered state, token, entry notice and self id. */
    const applyRoomState = useCallback(
        (payload: RoomStatePayload) => {
            const isEnteringRoom = roomStateRef.current === null;
            roomStateRef.current = payload.roomState;
            setRoomState(payload.roomState);
            if (sessionTokenRef.current) {
                persistRoomToken(payload.roomState.id, sessionTokenRef.current);
            }
            rememberActiveRoom(payload.roomState.id);
            if (isEnteringRoom) {
                // A notice raised on the lobby (a stale room code, a
                // rate limit) must not follow the user into the room
                // they just entered; notices raised inside a room stay.
                setErrorNotice(null);
            }
            if (payload.currentUserId) {
                currentUserIdRef.current = payload.currentUserId;
                setCurrentUserId(payload.currentUserId);
            }
            // A room state means the queued create/join was accepted.
            lastJoinRoomIdRef.current = null;
            checkedRoomIdRef.current = null;
            clearCheckRoomTimeout();
            setStoredRoomStatus('none');
            clearEntry();
        },
        [clearCheckRoomTimeout, clearEntry]
    );

    /** Applies a `SESSION` message: the issued token and the participant it was bound to. */
    const applySession = useCallback((payload: SessionPayload) => {
        sessionTokenRef.current = payload.sessionToken;
        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, payload.sessionToken);
        if (roomStateRef.current) {
            persistRoomToken(roomStateRef.current.id, payload.sessionToken);
        }
        if (payload.userId) {
            currentUserIdRef.current = payload.userId;
            setCurrentUserId(payload.userId);
        }
    }, []);

    /** Surfaces an `ERROR` notice and drops the session when its code means the session is gone. */
    const applyServerError = useCallback(
        (payload: ErrorPayload) => {
            // The server answered the entry request, so its spinner must stop
            // even when the answer is a rejection the user has to correct.
            clearEntry();
            setErrorNotice({
                code: payload.code,
                message: payload.message,
            });
            const { code } = payload;
            const attemptedRoomId = lastJoinRoomIdRef.current;
            // The stored active room is only a convenience, not a claim. When
            // the server says that exact room is gone, drop the record and its
            // token so the lobby stops offering a session that cannot rejoin.
            // A `ROOM_NOT_FOUND` for a different code is a mistyped lobby code
            // and must keep the session the browser still holds.
            const isStaleActiveRoom =
                code === 'ROOM_NOT_FOUND' &&
                roomStateRef.current === null &&
                attemptedRoomId !== null &&
                attemptedRoomId === readActiveRoom();
            if (isStaleActiveRoom) {
                forgetActiveRoom(attemptedRoomId);
                localStorage.removeItem(roomTokenKey(attemptedRoomId));
                sessionTokenRef.current = null;
                sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
                lastJoinRoomIdRef.current = null;
                checkedRoomIdRef.current = null;
                clearCheckRoomTimeout();
                setStoredRoomStatus('gone');
                setErrorNotice({ key: 'session.stale' });
            }
            // `ROOM_NOT_FOUND` only means the session is gone when the client still holds
            // that room: a mistyped lobby code must not drop the token of the room the
            // user left. `BANNED` and `NO_SESSION` always end the session.
            const isSessionLost =
                code !== undefined &&
                SESSION_LOST_CODES.has(code) &&
                (code !== 'ROOM_NOT_FOUND' || roomStateRef.current !== null);
            if (isSessionLost) {
                forgetSession();
            }
        },
        [clearCheckRoomTimeout, clearEntry, forgetSession]
    );

    useEffect(() => {
        let isMounted = true;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let wakingTimeout: ReturnType<typeof setTimeout> | 'elapsed' | null = null;

        const clearWakingTimeout = () => {
            if (wakingTimeout !== null && wakingTimeout !== 'elapsed') {
                clearTimeout(wakingTimeout);
            }
            wakingTimeout = null;
        };

        const scheduleWaking = () => {
            // The deadline belongs to the outage, not to an individual dial:
            // resetting it on every failed reconnect would keep the banner in
            // `connecting` forever when dials fail faster than the grace period.
            if (wakingTimeout !== null) {
                return;
            }
            wakingTimeout = setTimeout(() => {
                wakingTimeout = 'elapsed';
                if (!isMounted) {
                    return;
                }
                setConnectionStatus((current) =>
                    current === 'connected' || current === 'offline' ? current : 'waking'
                );
            }, WAKE_GRACE_MS);
        };

        const connect = () => {
            if (!isMounted) {
                return;
            }
            if (browserOfflineRef.current || navigator.onLine === false) {
                return;
            }
            if (
                socketRef.current &&
                (socketRef.current.readyState === WebSocket.OPEN ||
                    socketRef.current.readyState === WebSocket.CONNECTING)
            ) {
                return;
            }

            const wsUrl = resolveSocketUrl({
                configuredUrl: import.meta.env.VITE_WS_URL,
                isDev: import.meta.env.DEV,
                location: window.location,
            });

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;
            scheduleWaking();

            ws.onopen = () => {
                if (!isMounted || socketRef.current !== ws) {
                    return;
                }
                clearWakingTimeout();
                wasConnectedRef.current = true;
                setConnectionStatus('connected');
                setErrorNotice(null);

                // The action the user took while the socket was opening runs
                // now, exactly once.
                flushPendingEntry();

                const room = roomStateRef.current;
                const userId = currentUserIdRef.current;
                const token = sessionTokenRef.current;
                const self = room?.participants.find((participant) => participant.id === userId);
                if (room && token && userId && self) {
                    lastJoinRoomIdRef.current = room.id;
                    send('JOIN_ROOM', {
                        avatar: self.avatar,
                        color: self.color,
                        name: self.name,
                        roomId: room.id,
                        sessionToken: token,
                        userId,
                    });
                    return;
                }
                // A fresh lobby page asks whether the room it remembers still
                // exists before offering to re-enter it.
                requestRoomStatus();
            };

            ws.onmessage = (event) => {
                if (!isMounted || socketRef.current !== ws) {
                    return;
                }
                try {
                    const { payload, type } = JSON.parse(event.data);
                    if (type === 'ROOM_STATE') {
                        applyRoomState(payload);
                    } else if (type === 'SESSION') {
                        applySession(payload);
                    } else if (type === 'ROOM_STATUS') {
                        applyRoomStatus(payload);
                    } else if (type === 'KICKED') {
                        forgetSession();
                        setIsKicked(true);
                    } else if (type === 'ERROR') {
                        applyServerError(payload);
                    }
                } catch (err) {
                    console.error('Failed to parse WS payload:', err);
                }
            };

            ws.onclose = (event) => {
                if (!isMounted || socketRef.current !== ws) {
                    return;
                }
                resolveEntry();
                clearCheckRoomTimeout();
                checkedRoomIdRef.current = null;
                if (event.code === SESSION_REPLACED_CLOSE_CODE) {
                    // Another tab of this browser took the participant over. Hand
                    // the room over, keep the stored token for the tab that owns
                    // it, and stay put instead of fighting for the socket.
                    clearWakingTimeout();
                    setConnectionStatus('offline');
                    releaseRoom();
                    setStoredRoomStatus('none');
                    setErrorNotice({ key: 'session.replaced' });
                    return;
                }
                if (event.code === ROOM_SWITCHED_CLOSE_CODE) {
                    // The same browser confirmed a switch to another room, so the
                    // server removed this participant: the token this tab holds is
                    // dead and must not be replayed. The room that took over owns
                    // `planit_active_room`, so that record stays untouched.
                    clearWakingTimeout();
                    setConnectionStatus('offline');
                    forgetStoredToken();
                    releaseRoom();
                    setStoredRoomStatus('none');
                    setErrorNotice({ key: 'session.moved' });
                    return;
                }
                if (browserOfflineRef.current) {
                    // The online event owns the next dial; reconnecting in the
                    // background while the browser is offline only spins. The
                    // terminal close codes above still ran their cleanup first.
                    clearWakingTimeout();
                    setConnectionStatus('offline');
                    return;
                }
                reportDialing();
                // Re-check the remembered room after the reconnect, so a room
                // that disappeared while the socket was down is not offered.
                setStoredRoomStatus(
                    roomStateRef.current === null && readActiveRoom() ? 'checking' : 'none'
                );
                // Keep the deadline from the first failed dial: a reconnect
                // attempt that fails quickly must not push `waking` out again.
                scheduleWaking();
                reconnectTimeout = setTimeout(() => {
                    if (isMounted) {
                        connect();
                    }
                }, RECONNECT_DELAY_MS);
            };

            ws.onerror = (err) => {
                if (!isMounted || socketRef.current !== ws) {
                    return;
                }
                console.error('WebSocket connection error:', err);
                if (browserOfflineRef.current) {
                    setConnectionStatus('offline');
                    return;
                }
                reportDialing();
                scheduleWaking();
            };
        };

        connectRef.current = connect;

        const handleOffline = () => {
            browserOfflineRef.current = true;
            clearWakingTimeout();
            if (isMounted) {
                setConnectionStatus('offline');
            }
        };

        const handleOnline = () => {
            browserOfflineRef.current = false;
            if (!isMounted) {
                return;
            }
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                setConnectionStatus('connected');
                return;
            }
            reportDialing();
            scheduleWaking();
            connect();
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        connect();

        return () => {
            isMounted = false;
            connectRef.current = null;
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            clearWakingTimeout();
            clearCheckRoomTimeout();
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [
        applyRoomState,
        applyRoomStatus,
        applyServerError,
        applySession,
        clearCheckRoomTimeout,
        flushPendingEntry,
        forgetSession,
        forgetStoredToken,
        releaseRoom,
        reportDialing,
        requestRoomStatus,
        resolveEntry,
        send,
    ]);

    const createRoom = useCallback(
        (
            name: string,
            avatar: string,
            color: string,
            title?: string,
            deckType: DeckType = 'fibonacci',
            customDeck?: (number | string)[]
        ) => {
            enqueueEntry(
                'create',
                'CREATE_ROOM',
                {
                    avatar,
                    color,
                    customDeck,
                    deckType,
                    name,
                    previousRoomToken: previousRoomTokenFor(''),
                    title,
                },
                null
            );
        },
        [enqueueEntry]
    );

    const joinRoom = useCallback(
        (roomId: string, name: string, avatar: string, color: string) => {
            // Room codes are case-insensitive for the user but canonical on the
            // server. Normalizing once keeps the stored-token lookup aligned with
            // the key written when the room was entered; otherwise a lowercase
            // code misses the token and mints a second participant.
            const normalizedRoomId = roomId.trim().toUpperCase();

            enqueueEntry(
                'join',
                'JOIN_ROOM',
                {
                    avatar,
                    color,
                    name,
                    previousRoomToken: previousRoomTokenFor(normalizedRoomId),
                    roomId: normalizedRoomId,
                    sessionToken:
                        sessionTokenRef.current ??
                        localStorage.getItem(roomTokenKey(normalizedRoomId)),
                    userId: currentUserId,
                },
                normalizedRoomId
            );
        },
        [currentUserId, enqueueEntry]
    );

    const updateRoomTitle = useCallback(
        (title: string) => {
            send('UPDATE_ROOM_TITLE', { title });
        },
        [send]
    );

    const toggleLockRoom = useCallback(() => {
        send('TOGGLE_LOCK_ROOM', {});
    }, [send]);

    const toggleAutoReveal = useCallback(() => {
        send('TOGGLE_AUTO_REVEAL', {});
    }, [send]);

    const startTimer = useCallback(
        (duration = 60) => {
            send('START_TIMER', { duration });
        },
        [send]
    );

    const pauseTimer = useCallback(() => {
        send('PAUSE_TIMER', {});
    }, [send]);

    const resetTimer = useCallback(() => {
        send('RESET_TIMER', {});
    }, [send]);

    const submitVote = useCallback(
        (vote: number | string) => {
            send('VOTE', { vote });
        },
        [send]
    );

    const revealVotes = useCallback(() => {
        send('REVEAL_VOTES', {});
    }, [send]);

    const resetVotes = useCallback(() => {
        send('RESET_VOTES', {});
    }, [send]);

    const toggleSpectator = useCallback(() => {
        send('TOGGLE_SPECTATOR', {});
    }, [send]);

    const toggleUserRole = useCallback(
        (targetUserId: string) => {
            send('TOGGLE_USER_ROLE', { targetUserId });
        },
        [send]
    );

    const kickParticipant = useCallback(
        (targetUserId: string) => {
            send('KICK_PARTICIPANT', { targetUserId });
        },
        [send]
    );

    const promoteCoAdmin = useCallback(
        (targetUserId: string) => {
            send('PROMOTE_COADMIN', { targetUserId });
        },
        [send]
    );

    const transferAdmin = useCallback(
        (targetUserId: string) => {
            send('TRANSFER_ADMIN', { targetUserId });
        },
        [send]
    );

    const addStory = useCallback(
        (title: string, description?: string) => {
            send('ADD_STORY', { description, title });
        },
        [send]
    );

    const bulkAddStories = useCallback(
        (stories: ImportableStory[]) => {
            // A full import is several times larger than one WebSocket frame
            // accepts, so it travels as a sequence of frame-sized messages.
            chunkStoriesForImport(stories).forEach((batch) => {
                send('BULK_ADD_STORIES', { stories: batch });
            });
        },
        [send]
    );

    const setCurrentStory = useCallback(
        (storyIndex: number) => {
            send('SET_CURRENT_STORY', { storyIndex });
        },
        [send]
    );

    const updateStoryEstimate = useCallback(
        (storyId: string, estimate: EstimateValue) => {
            send('UPDATE_STORY_ESTIMATE', { estimate, storyId });
        },
        [send]
    );

    const deleteStory = useCallback(
        (storyId: string) => {
            send('DELETE_STORY', { storyId });
        },
        [send]
    );

    const changeDeck = useCallback(
        (deckType: DeckType, customDeck?: (number | string)[]) => {
            send('CHANGE_DECK', { customDeck, deckType });
        },
        [send]
    );

    const endSession = useCallback(() => {
        send('END_SESSION', {});
    }, [send]);

    const leaveRoom = useCallback(() => {
        // Leaving is client-side only: no LEAVE message exists, so the server
        // keeps this participant bound to the socket and only the session token
        // can rebind it. The token therefore survives, while the room refs are
        // cleared so `onopen` cannot re-enter the room on its own. The browser
        // itself is free again, so the active-room record is dropped.
        const roomId = roomStateRef.current?.id;
        if (roomId) {
            forgetActiveRoom(roomId);
        }
        releaseRoom();
        checkedRoomIdRef.current = null;
        clearCheckRoomTimeout();
        setStoredRoomStatus('none');
        window.location.hash = '';
    }, [clearCheckRoomTimeout, releaseRoom]);

    const clearError = useCallback(() => setErrorNotice(null), []);
    const clearKickedMessage = useCallback(() => setIsKicked(false), []);

    /**
     * Abandons the current dial and starts a fresh one.
     *
     * A WebSocket that stays in `CONNECTING` on a sleeping backend can sit
     * there for a long time; the retry gives the user a way out without a
     * reload. The stale socket's handlers are ignored by the identity guard in
     * the connection effect.
     */
    const retryConnection = useCallback(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setConnectionStatus('offline');
            return;
        }
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
            return;
        }
        // A request already handed to this socket may have reached the server.
        // Re-sending it automatically could create a second room, so the retry
        // only releases the abandoned marker and spinner; the user can submit
        // a fresh request once the replacement socket is connected.
        resolveEntry();
        clearCheckRoomTimeout();
        checkedRoomIdRef.current = null;
        socketRef.current = null;
        try {
            socket?.close();
        } catch {
            // Closing a socket that is still connecting can throw; the fresh
            // dial below is what matters.
        }
        reportDialing();
        connectRef.current?.();
    }, [clearCheckRoomTimeout, reportDialing, resolveEntry]);

    /** Asks the server to drop every participant who is no longer connected. */
    const clearOfflineParticipants = useCallback(() => {
        send('CLEAR_OFFLINE_PARTICIPANTS', {});
    }, [send]);

    // Translation happens while the context value is built, not in the socket
    // handler: a notice already on screen follows a language change instead of
    // freezing in the language it arrived in.
    const contextValue = useMemo<SocketContextValue>(() => {
        const host = roomState?.hostId === currentUserId;
        const currentParticipant = roomState?.participants.find((p) => p.id === currentUserId);
        const error = translateNotice(errorNotice, t);
        const isConnected = connectionStatus === 'connected';
        const kickedMessage = isKicked ? t('notice.kicked') : null;

        return {
            addStory,
            bulkAddStories,
            changeDeck,
            clearError,
            clearKickedMessage,
            clearOfflineParticipants,
            connectionStatus,
            createRoom,
            currentUserId,
            deleteStory,
            endSession,
            error,
            isAdmin: host || !!currentParticipant?.isAdmin,
            isConnected,
            isHost: host,
            joinRoom,
            kickedMessage,
            kickParticipant,
            leaveRoom,
            pauseTimer,
            pendingEntry,
            promoteCoAdmin,
            resetTimer,
            resetVotes,
            retryConnection,
            revealVotes,
            roomState,
            setCurrentStory,
            startTimer,
            storedRoomStatus,
            submitVote,
            toggleAutoReveal,
            toggleLockRoom,
            toggleSpectator,
            toggleUserRole,
            transferAdmin,
            updateRoomTitle,
            updateStoryEstimate,
        };
    }, [
        addStory,
        bulkAddStories,
        changeDeck,
        clearError,
        clearKickedMessage,
        clearOfflineParticipants,
        connectionStatus,
        createRoom,
        currentUserId,
        deleteStory,
        endSession,
        errorNotice,
        isKicked,
        joinRoom,
        kickParticipant,
        leaveRoom,
        pauseTimer,
        pendingEntry,
        promoteCoAdmin,
        resetTimer,
        resetVotes,
        retryConnection,
        revealVotes,
        roomState,
        setCurrentStory,
        startTimer,
        storedRoomStatus,
        submitVote,
        t,
        toggleAutoReveal,
        toggleLockRoom,
        toggleSpectator,
        toggleUserRole,
        transferAdmin,
        updateRoomTitle,
        updateStoryEstimate,
    ]);

    return <SocketContext value={contextValue}>{children}</SocketContext>;
};
