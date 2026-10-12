import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { JoinSessionForm } from './join-session-form';

/** Submits the join form the way a human does: type a code, press the button. */
const submitJoin = (roomCode: string) => {
    fireEvent.change(screen.getByLabelText(/Room Code/i), { target: { value: roomCode } });
    fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));
};

describe('JoinSessionForm', () => {
    it('submits the room code once it is complete', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

        submitJoin('ABCD1234');

        expect(onSubmit).toHaveBeenCalledWith('ABCD1234');
    });

    it('uppercases the code before handing it over', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

        submitJoin('abcd1234');

        expect(onSubmit).toHaveBeenCalledWith('ABCD1234');
    });

    it('does not submit an incomplete code', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="" onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText(/Room Code/i), { target: { value: 'ABC' } });
        fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('starts from the code a deep link carried', () => {
        const onSubmit = vi.fn();
        render(<JoinSessionForm initialRoomCode="ABCD1234" onSubmit={onSubmit} />);

        fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));

        expect(onSubmit).toHaveBeenCalledWith('ABCD1234');
    });
});
