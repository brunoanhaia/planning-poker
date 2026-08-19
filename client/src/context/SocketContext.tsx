import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { RoomState, DeckType } from '../types';

interface SocketContextValue {
  roomState: RoomState | null;
  currentUserId: string | null;
  isConnected: boolean;
  error: string | null;
  createRoom: (name: string, avatar: string, color: string, title?: string, deckType?: DeckType, customDeck?: (string | number)[]) => void;
  joinRoom: (roomId: string, name: string, avatar: string, color: string) => void;
  submitVote: (vote: string | number) => void;
  revealVotes: () => void;
  resetVotes: () => void;
  toggleSpectator: () => void;
  addStory: (title: string, description?: string) => void;
  setCurrentStory: (index: number) => void;
  updateStoryEstimate: (storyId: string, estimate: string | number) => void;
  deleteStory: (storyId: string) => void;
  changeDeck: (deckType: DeckType, customDeck?: (string | number)[]) => void;
  leaveRoom: () => void;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem('planit_user_id'));
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.DEV ? 'localhost:5000' : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        if (type === 'ROOM_STATE') {
          setRoomState(payload.roomState);
          if (payload.currentUserId) {
            setCurrentUserId(payload.currentUserId);
            localStorage.setItem('planit_user_id', payload.currentUserId);
          }
        } else if (type === 'ERROR') {
          setError(payload.message || 'An error occurred');
        }
      } catch (err) {
        console.error('Failed to parse WS payload:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
    };

    socketRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const send = (type: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
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
    customDeck?: (string | number)[]
  ) => {
    send('CREATE_ROOM', { name, avatar, color, title, deckType, customDeck });
  };

  const joinRoom = (roomId: string, name: string, avatar: string, color: string) => {
    send('JOIN_ROOM', {
      roomId,
      name,
      avatar,
      color,
      userId: currentUserId,
    });
  };

  const submitVote = (vote: string | number) => {
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

  const addStory = (title: string, description?: string) => {
    send('ADD_STORY', { title, description });
  };

  const setCurrentStory = (storyIndex: number) => {
    send('SET_CURRENT_STORY', { storyIndex });
  };

  const updateStoryEstimate = (storyId: string, estimate: string | number) => {
    send('UPDATE_STORY_ESTIMATE', { storyId, estimate });
  };

  const deleteStory = (storyId: string) => {
    send('DELETE_STORY', { storyId });
  };

  const changeDeck = (deckType: DeckType, customDeck?: (string | number)[]) => {
    send('CHANGE_DECK', { deckType, customDeck });
  };

  const leaveRoom = () => {
    setRoomState(null);
    window.location.hash = '';
  };

  const clearError = () => setError(null);

  return (
    <SocketContext.Provider
      value={{
        roomState,
        currentUserId,
        isConnected,
        error,
        createRoom,
        joinRoom,
        submitVote,
        revealVotes,
        resetVotes,
        toggleSpectator,
        addStory,
        setCurrentStory,
        updateStoryEstimate,
        deleteStory,
        changeDeck,
        leaveRoom,
        clearError,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
