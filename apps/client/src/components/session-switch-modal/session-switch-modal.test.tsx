import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SessionSwitchModal, SessionSwitchModalProps } from './session-switch-modal';

/** Renders the modal with a fixed room and returns the callback spies. */
const renderModal = (overrides?: Partial<SessionSwitchModalProps>): SessionSwitchModalProps => {
    const props: SessionSwitchModalProps = {
        activeRoomId: 'ROOM01',
        onDismiss: vi.fn(),
        onProceed: vi.fn(),
        onRejoin: vi.fn(),
        open: true,
        ...overrides,
    };

    render(<SessionSwitchModal {...props} />);

    return props;
};

describe('SessionSwitchModal', () => {
    it('names the active room and explains what continuing does', () => {
        renderModal();

        expect(screen.getByText('Another session is open')).toBeInTheDocument();
        expect(
            screen.getByText(
                'This browser is already in room ROOM01. Continuing here ends that session.'
            )
        ).toBeInTheDocument();
    });

    it('goes to the active room through the rejoin action', () => {
        const props = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Go to room ROOM01' }));

        expect(props.onRejoin).toHaveBeenCalledOnce();
        expect(props.onProceed).not.toHaveBeenCalled();
        expect(props.onDismiss).not.toHaveBeenCalled();
    });

    it('continues with the requested action through the proceed action', () => {
        const props = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'End it and continue' }));

        expect(props.onProceed).toHaveBeenCalledOnce();
        expect(props.onRejoin).not.toHaveBeenCalled();
        expect(props.onDismiss).not.toHaveBeenCalled();
    });

    it('dismisses without taking an action', () => {
        const props = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(props.onDismiss).toHaveBeenCalledOnce();
        expect(props.onRejoin).not.toHaveBeenCalled();
        expect(props.onProceed).not.toHaveBeenCalled();
    });
});
