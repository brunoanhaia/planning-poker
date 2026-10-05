import { DeckType, RoomState, WSMessageType } from '@planitpoker/shared';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SocketContext, SocketContextValue } from './socket-context';

/** Reconnection delay applied whenever the socket drops. */
const RECONNECT_DELAY_MS = 2000;

/** Session storage key holding the token that survives a page reload. */
const SESSION_TOKEN_STORAGE_KEY = 'planit_session_token';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [roomState, setRoomState] = useState<null | RoomState>(null);
    const [currentUserId, setCurrentUserId] = useState<null | string>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<null | string>(null);
    const [kickedMessage, setKickedMessage] = useState<null | string>(null);
    const socketRef = useRef<null | WebSocket>(null);
    const sessionTokenRef = useRef<null | string>(null);

    useEffect(() => {
        sessionTokenRef.current = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
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

            const defaultProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const defaultProdUrl = `${defaultProtocol}//${window.location.host}`;
            const fallbackUrl = import.meta.env.DEV ? 'ws://localhost:5000' : defaultProdUrl;
            const wsUrl = import.meta.env.VITE_WS_URL || fallbackUrl;

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if (!isMounted) {
                    return;
                }
                setIsConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                if (!isMounted) {
                    return;
                }
                try {
                    const { payload, type } = JSON.parse(event.data);
                    if (type === 'ROOM_STATE') {
                        setRoomState(payload.roomState);
                        if (payload.currentUserId) {
                            setCurrentUserId(payload.currentUserId);
                        }
                    } else if (type === 'SESSION') {
                        sessionTokenRef.current = payload.sessionToken;
                        sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, payload.sessionToken);
                        if (payload.userId) {
                            setCurrentUserId(payload.userId);
                        }
                    } else if (type === 'KICKED') {
                        setRoomState(null);
                        sessionTokenRef.current = null;
                        sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
                        setKickedMessage(
                            payload.message || 'You have been removed from the session.'
                        );
                    } else if (type === 'ERROR') {
                        setError(payload.message || 'An error occurred');
                    }
                } catch (err) {
                    console.error('Failed to parse WS payload:', err);
                }
            };

            ws.onclose = () => {
                if (!isMounted) {
                    return;
                }
                setIsConnected(false);
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

            socketRef.current = ws;
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
    }, []);

    const send = useCallback((type: WSMessageType, payload: unknown) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ payload, type }));
        } else {
            setError('Connection to server lost. Retrying...');
        }
    }, []);

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
                sessionToken: sessionTokenRef.current,
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
        (stories: { description?: string; title: string }[]) => {
            send('BULK_ADD_STORIES', { stories });
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
        setRoomState(null);
        window.location.hash = '';
    }, []);

    const clearError = useCallback(() => setError(null), []);
    const clearKickedMessage = useCallback(() => setKickedMessage(null), []);

    const contextValue = useMemo<SocketContextValue>(() => {
        const host = roomState?.hostId === currentUserId;
        const currentParticipant = roomState?.participants.find((p) => p.id === currentUserId);
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
        error,
        isConnected,
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
    ]);

    return <SocketContext value={contextValue}>{children}</SocketContext>;
};
