import { DeckType, RoomState } from '@planitpoker/shared';
import React, { createContext, use, useEffect, useRef, useState } from 'react';

interface SocketContextValue {
    addStory: (title: string, description?: string) => void;
    bulkAddStories: (stories: { description?: string; title: string }[]) => void;
    changeDeck: (deckType: DeckType, customDeck?: (number | string)[]) => void;
    clearError: () => void;
    clearKickedMessage: () => void;
    createRoom: (
        name: string,
        avatar: string,
        color: string,
        title?: string,
        deckType?: DeckType,
        customDeck?: (number | string)[]
    ) => void;
    currentUserId: null | string;
    deleteStory: (storyId: string) => void;
    endSession: () => void;
    error: null | string;
    isAdmin: boolean;
    isConnected: boolean;
    isHost: boolean;
    joinRoom: (roomId: string, name: string, avatar: string, color: string) => void;
    kickedMessage: null | string;
    kickParticipant: (targetUserId: string) => void;
    leaveRoom: () => void;
    pauseTimer: () => void;
    promoteCoAdmin: (targetUserId: string) => void;
    resetTimer: () => void;
    resetVotes: () => void;
    revealVotes: () => void;
    roomState: null | RoomState;
    setCurrentStory: (index: number) => void;
    startTimer: (duration?: number) => void;
    submitVote: (vote: number | string) => void;
    toggleAutoReveal: () => void;
    toggleLockRoom: () => void;
    toggleSpectator: () => void;
    toggleUserRole: (targetUserId: string) => void;
    transferAdmin: (targetUserId: string) => void;
    updateRoomTitle: (title: string) => void;
    updateStoryEstimate: (storyId: string, estimate: number | string | null) => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [roomState, setRoomState] = useState<null | RoomState>(null);
    const [currentUserId, setCurrentUserId] = useState<null | string>(() =>
        localStorage.getItem('planit_user_id')
    );
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<null | string>(null);
    const [kickedMessage, setKickedMessage] = useState<null | string>(null);
    const socketRef = useRef<null | WebSocket>(null);

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
                            localStorage.setItem('planit_user_id', payload.currentUserId);
                        }
                    } else if (type === 'KICKED') {
                        setRoomState(null);
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
                }, 2000);
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

    const send = (type: string, payload: any) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ payload, type }));
        } else {
            setError('Connection to server lost. Retrying...');
        }
    };

    const createRoom = (
        name: string,
        avatar: string,
        color: string,
        title?: string,
        deckType: DeckType = 'fibonacci',
        customDeck?: (number | string)[]
    ) => {
        send('CREATE_ROOM', { avatar, color, customDeck, deckType, name, title });
    };

    const joinRoom = (roomId: string, name: string, avatar: string, color: string) => {
        send('JOIN_ROOM', {
            avatar,
            color,
            name,
            roomId,
            userId: currentUserId,
        });
    };

    const updateRoomTitle = (title: string) => {
        send('UPDATE_ROOM_TITLE', { title });
    };

    const toggleLockRoom = () => {
        send('TOGGLE_LOCK_ROOM', {});
    };

    const toggleAutoReveal = () => {
        send('TOGGLE_AUTO_REVEAL', {});
    };

    const startTimer = (duration = 60) => {
        send('START_TIMER', { duration });
    };

    const pauseTimer = () => {
        send('PAUSE_TIMER', {});
    };

    const resetTimer = () => {
        send('RESET_TIMER', {});
    };

    const submitVote = (vote: number | string) => {
        send('VOTE', { vote });
    };

    const revealVotes = () => {
        send('REVEAL_VOTES', {});
    };

    const resetVotes = () => {
        send('RESET_VOTES', {});
    };

    const toggleSpectator = () => {
        send('TOGGLE_SPECTATOR', {});
    };

    const toggleUserRole = (targetUserId: string) => {
        send('TOGGLE_USER_ROLE', { targetUserId });
    };

    const kickParticipant = (targetUserId: string) => {
        send('KICK_PARTICIPANT', { targetUserId });
    };

    const promoteCoAdmin = (targetUserId: string) => {
        send('PROMOTE_COADMIN', { targetUserId });
    };

    const transferAdmin = (targetUserId: string) => {
        send('TRANSFER_ADMIN', { targetUserId });
    };

    const addStory = (title: string, description?: string) => {
        send('ADD_STORY', { description, title });
    };

    const bulkAddStories = (stories: { description?: string; title: string }[]) => {
        send('BULK_ADD_STORIES', { stories });
    };

    const setCurrentStory = (storyIndex: number) => {
        send('SET_CURRENT_STORY', { storyIndex });
    };

    const updateStoryEstimate = (storyId: string, estimate: number | string | null) => {
        send('UPDATE_STORY_ESTIMATE', { estimate, storyId });
    };

    const deleteStory = (storyId: string) => {
        send('DELETE_STORY', { storyId });
    };

    const changeDeck = (deckType: DeckType, customDeck?: (number | string)[]) => {
        send('CHANGE_DECK', { customDeck, deckType });
    };

    const endSession = () => {
        send('END_SESSION', {});
    };

    const leaveRoom = () => {
        setRoomState(null);
        window.location.hash = '';
    };

    const clearError = () => setError(null);
    const clearKickedMessage = () => setKickedMessage(null);

    const isHost = roomState?.hostId === currentUserId;
    const currentParticipant = roomState?.participants.find((p) => p.id === currentUserId);
    const isAdmin = isHost || !!currentParticipant?.isAdmin;

    return (
        <SocketContext
            value={{
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
                isAdmin,
                isConnected,
                isHost,
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
            }}
        >
            {children}
        </SocketContext>
    );
};

export const useSocket = () => {
    const context = use(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};
