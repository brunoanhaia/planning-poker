import { RoomState } from '@planitpoker/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { RoomSettingsModal } from './room-settings-modal';

const buildRoomState = (overrides?: Partial<RoomState>): RoomState => ({
    activeDeck: [1, 2, 3, 5, 8, 13, 21],
    autoReveal: false,
    createdAt: Date.now(),
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    hostId: 'user_1',
    id: 'ROOM01',
    isEnded: false,
    isLocked: false,
    participants: [],
    stories: [],
    timer: null,
    title: 'Sprint 42',
    votesRevealed: false,
    ...overrides,
});

describe('RoomSettingsModal', () => {
    it('resyncs its fields from the room when it reopens', async () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: buildRoomState() })
        );

        const { rerender } = render(<RoomSettingsModal onClose={vi.fn()} open />);

        const titleField = screen.getByLabelText('Room / Sprint Title') as HTMLInputElement;
        expect(titleField.value).toBe('Sprint 42');

        // The room is renamed from elsewhere while the modal is closed.
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                roomState: buildRoomState({ customDeck: [0, 1, '?'], deckType: 'custom' }),
            })
        );
        rerender(<RoomSettingsModal onClose={vi.fn()} open={false} />);
        rerender(<RoomSettingsModal onClose={vi.fn()} open />);

        await waitFor(() => {
            expect((screen.getByLabelText('Room / Sprint Title') as HTMLInputElement).value).toBe(
                'Sprint 42'
            );
        });
        expect(
            (screen.getByLabelText('Comma-Separated Custom Cards') as HTMLInputElement).value
        ).toBe('0, 1, ?');
    });

    it('falls back to the live room deck after applying a change', async () => {
        const socket = createMockSocketValue({ roomState: buildRoomState() });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const { rerender } = render(<RoomSettingsModal onClose={vi.fn()} open />);

        const selectedDeck = () =>
            document.querySelector('.ant-select-content')?.textContent ?? null;
        expect(selectedDeck()).toBe('Fibonacci');

        fireEvent.mouseDown(screen.getByLabelText('Estimation Deck Type'));
        fireEvent.click(
            await screen.findByText('T-Shirt Sizes', {
                selector: '.ant-select-item-option-content',
            })
        );
        expect(selectedDeck()).toBe('T-Shirt Sizes');

        fireEvent.click(screen.getByRole('button', { name: 'Apply Settings' }));
        expect(socket.changeDeck).toHaveBeenCalledWith('tshirt');

        // The room still reports the deck it had before the change: a lingering
        // draft would keep showing the applied value instead of the room's own.
        rerender(<RoomSettingsModal onClose={vi.fn()} open={false} />);
        rerender(<RoomSettingsModal onClose={vi.fn()} open />);

        await waitFor(() => {
            expect(selectedDeck()).toBe('Fibonacci');
        });
    });

    it('keeps a draft alive while the modal is closed without applying', async () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: buildRoomState() })
        );
        const onClose = vi.fn();
        const { rerender } = render(<RoomSettingsModal onClose={onClose} open />);

        fireEvent.change(screen.getByLabelText('Room / Sprint Title'), {
            target: { value: 'Draft kept on cancel' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();

        rerender(<RoomSettingsModal onClose={vi.fn()} open={false} />);
        rerender(<RoomSettingsModal onClose={vi.fn()} open />);

        await waitFor(() => {
            expect((screen.getByLabelText('Room / Sprint Title') as HTMLInputElement).value).toBe(
                'Draft kept on cancel'
            );
        });
    });

    it('confirms ending the session with an Ant Design Popconfirm', async () => {
        const socket = createMockSocketValue({ roomState: buildRoomState() });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const onClose = vi.fn();
        render(<RoomSettingsModal onClose={onClose} open />);

        fireEvent.click(screen.getByRole('button', { name: 'End Planning Session' }));

        // The native confirmation must never reach for the browser dialog.
        const confirmSpy = vi.spyOn(window, 'confirm');
        fireEvent.click(await screen.findByRole('button', { name: 'End Session' }));

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(socket.endSession).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});
