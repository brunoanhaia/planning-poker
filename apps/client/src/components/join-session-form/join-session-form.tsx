import { Button, Flex, Input } from 'antd';
import React, { useState } from 'react';

/** Exact length of a room code, and therefore of the join deep link. */
const ROOM_CODE_LENGTH = 6;

export interface JoinSessionFormProps {
    /** Pre-fills the field from a `#ABC123` deep link. */
    initialRoomCode: string;
    /** Called with the uppercase room code once a session is joined. */
    onSubmit: (roomCode: string) => void;
}

/**
 * Step 2 of the "join a room" flow: nothing but the six character room code.
 */
export const JoinSessionForm: React.FC<JoinSessionFormProps> = ({ initialRoomCode, onSubmit }) => {
    const [roomCode, setRoomCode] = useState(initialRoomCode);

    const isComplete = roomCode.trim().length === ROOM_CODE_LENGTH;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit(roomCode.trim().toUpperCase());
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

                <Button block htmlType="submit" size="large" type="primary" disabled={!isComplete}>
                    Join Room Now
                </Button>
            </Flex>
        </form>
    );
};
