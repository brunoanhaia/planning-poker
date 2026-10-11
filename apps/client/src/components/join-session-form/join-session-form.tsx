import { Button, Flex, Input } from 'antd';
import React, { useState } from 'react';

import { useTurnstile } from '../../utils/turnstile';

/** Exact length of a room code, and therefore of the join deep link. */
const ROOM_CODE_LENGTH = 8;

export interface JoinSessionFormProps {
    /** Pre-fills the field from a `#ABC123` deep link. */
    initialRoomCode: string;
    /** Called with the uppercase room code, and the solved challenge, once a session is joined. */
    onSubmit: (roomCode: string, turnstileToken: string | null) => void;
}

/**
 * Step 2 of the "join a room" flow: the room code, and the challenge that proves
 * a browser is on the other end of it when the deployment asks for one.
 */
export const JoinSessionForm: React.FC<JoinSessionFormProps> = ({ initialRoomCode, onSubmit }) => {
    const [roomCode, setRoomCode] = useState(initialRoomCode);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const { challenge, reset: resetChallenge } = useTurnstile(setTurnstileToken);

    const isComplete = roomCode.trim().length === ROOM_CODE_LENGTH;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit(roomCode.trim().toUpperCase(), turnstileToken);
        // The token is single-use: the next attempt needs a fresh challenge,
        // whether this one was accepted or refused.
        resetChallenge();
    };

    return (
        <form onSubmit={handleSubmit}>
            <Flex gap={12} vertical>
                <div>
                    <label htmlFor="join-session-room-code">
                        {ROOM_CODE_LENGTH}-Character Room Code
                    </label>
                    <Input
                        autoComplete="off"
                        id="join-session-room-code"
                        maxLength={ROOM_CODE_LENGTH}
                        onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                        placeholder="e.g. ABC123"
                        value={roomCode}
                    />
                </div>

                {challenge}

                <Button
                    block
                    disabled={!isComplete || (Boolean(challenge) && !turnstileToken)}
                    htmlType="submit"
                    size="large"
                    type="primary"
                >
                    Join Room Now
                </Button>
            </Flex>
        </form>
    );
};
