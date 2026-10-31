import {
    DeckType,
    ErrorCode,
    ErrorPayload,
    RoomState,
    SESSION_REPLACED_CLOSE_CODE,
    WSMessageType,
} from '@planitpoker/shared';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ERROR_KEYS, TranslationKey } from '../../i18n/dictionary';
import { Translate } from '../../i18n/i18n-context';
import { useTranslation } from '../../i18n/use-translation';
import { chunkStoriesForImport, ImportableStory } from '../../utils/bulk-import';
import { resolveSocketUrl } from '../../utils/socket-url';
import { SocketContext, SocketContextValue } from './socket-context';

/** Reconnection delay applied whenever the socket drops. */
const RECONNECT_DELAY_MS = 2000;

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
 * @param roomId Room the token belongs to.
 * @param token Participant token to persist.
 */
const persistRoomToken = (roomId: string, token: string): void => {
    if (sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY) !== token) {
        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    }
    const key = roomTokenKey(roomId);
    // Room state broadcasts on every vote and timer tick, so the write only
    // happens when the stored value is actually stale.
    if (localStorage.getItem(key) !== token) {
        localStorage.setItem(key, token);
    }
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
    const [isConnected, setIsConnected] = useState(false);
    const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
    const [isKicked, setIsKicked] = useState(false);
    const socketRef = useRef<null | WebSocket>(null);
    const sessionTokenRef = useRef<null | string>(null);
    const roomStateRef = useRef<null | RoomState>(null);
    const currentUserIdRef = useRef<null | string>(null);

    useEffect(() => {
        sessionTokenRef.current = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
    }, []);

    const forgetSession = useCallback(() => {
        const roomId = roomStateRef.current?.id;
        roomStateRef.current = null;
        currentUserIdRef.current = null;
        sessionTokenRef.current = null;
        sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
        if (roomId) {
            localStorage.removeItem(roomTokenKey(roomId));
        }
        setRoomState(null);
        setCurrentUserId(null);
    }, []);

    const send = useCallback((type: WSMessageType, payload: unknown) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ payload, type }));
        } else {
            setErrorNotice({ key: 'error.offline' });
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
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

            ws.onopen = () => {
                if (!isMounted) {
                    return;
                }
                setIsConnected(true);
                setErrorNotice(null);

                const room = roomStateRef.current;
                const userId = currentUserIdRef.current;
                const token = sessionTokenRef.current;
                const self = room?.participants.find((participant) => participant.id === userId);
                if (room && token && userId && self) {
                    send('JOIN_ROOM', {
                        avatar: self.avatar,
                        color: self.color,
                        name: self.name,
                        roomId: room.id,
                        sessionToken: token,
                        userId,
                    });
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted) {
                    return;
                }
                try {
                    const { payload, type } = JSON.parse(event.data);
                    if (type === 'ROOM_STATE') {
                        const isEnteringRoom = roomStateRef.current === null;
                        roomStateRef.current = payload.roomState;
                        setRoomState(payload.roomState);
                        if (sessionTokenRef.current) {
                            persistRoomToken(payload.roomState.id, sessionTokenRef.current);
                        }
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
                    } else if (type === 'SESSION') {
                        sessionTokenRef.current = payload.sessionToken;
                        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, payload.sessionToken);
                        if (roomStateRef.current) {
                            persistRoomToken(roomStateRef.current.id, payload.sessionToken);
                        }
                        if (payload.userId) {
                            currentUserIdRef.current = payload.userId;
                            setCurrentUserId(payload.userId);
                        }
                    } else if (type === 'KICKED') {
                        forgetSession();
                        setIsKicked(true);
                    } else if (type === 'ERROR') {
                        const errorPayload = payload as ErrorPayload;
                        setErrorNotice({
                            code: errorPayload.code,
                            message: errorPayload.message,
                        });
                        const { code } = errorPayload;
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
                    }
                } catch (err) {
                    console.error('Failed to parse WS payload:', err);
                }
            };

            ws.onclose = (event) => {
                if (!isMounted) {
                    return;
                }
                setIsConnected(false);
                if (event.code === SESSION_REPLACED_CLOSE_CODE) {
                    // Another tab of this browser took the participant over. Hand
                    // the room over, keep the stored token for the tab that owns
                    // it, and stay put instead of fighting for the socket.
                    roomStateRef.current = null;
                    setRoomState(null);
                    setErrorNotice({ key: 'session.replaced' });
                    return;
                }
                reconnectTimeout = setTimeout(() => {
                    if (isMounted) {
                        connect();
                    }
                }, RECONNECT_DELAY_MS);
            };

            ws.onerror = (err) => {
                console.error('WebSocket connection error:', err);
                if (isMounted) {
                    setIsConnected(false);
                }
            };
        };

        connect();

        return () => {
            isMounted = false;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [forgetSession, send]);

    const createRoom = useCallback(
        (
            name: string,
            avatar: string,
            color: string,
            title?: string,
            deckType: DeckType = 'fibonacci',
            customDeck?: (number | string)[]
        ) => {
            send('CREATE_ROOM', { avatar, color, customDeck, deckType, name, title });
        },
        [send]
    );

    const joinRoom = useCallback(
        (roomId: string, name: string, avatar: string, color: string) => {
            send('JOIN_ROOM', {
                avatar,
                color,
                name,
                roomId,
                sessionToken: sessionTokenRef.current ?? localStorage.getItem(roomTokenKey(roomId)),
                userId: currentUserId,
            });
        },
        [currentUserId, send]
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
        (storyId: string, estimate: number | string | null) => {
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
        // cleared so `onopen` cannot re-enter the room on its own.
        roomStateRef.current = null;
        currentUserIdRef.current = null;
        setRoomState(null);
        setCurrentUserId(null);
        window.location.hash = '';
    }, []);

    const clearError = useCallback(() => setErrorNotice(null), []);
    const clearKickedMessage = useCallback(() => setIsKicked(false), []);

    // Translation happens while the context value is built, not in the socket
    // handler: a notice already on screen follows a language change instead of
    // freezing in the language it arrived in.
    const contextValue = useMemo<SocketContextValue>(() => {
        const host = roomState?.hostId === currentUserId;
        const currentParticipant = roomState?.participants.find((p) => p.id === currentUserId);
        const error = translateNotice(errorNotice, t);
        const kickedMessage = isKicked ? t('notice.kicked') : null;

        return {
            addStory,
            bulkAddStories,
            changeDeck,
            clearError,
            clearKickedMessage,
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
            promoteCoAdmin,
            resetTimer,
            resetVotes,
            revealVotes,
            roomState,
            setCurrentStory,
            startTimer,
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
        createRoom,
        currentUserId,
        deleteStory,
        endSession,
        errorNotice,
        isConnected,
        isKicked,
        joinRoom,
        kickParticipant,
        leaveRoom,
        pauseTimer,
        promoteCoAdmin,
        resetTimer,
        resetVotes,
        revealVotes,
        roomState,
        setCurrentStory,
        startTimer,
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
