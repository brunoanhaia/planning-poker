import { MAX_CUSTOM_DECK_SIZE, MAX_NAME_LENGTH } from '@planitpoker/shared';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { Home } from './home';

describe('Home room creation', () => {
    it('validates custom cards and forwards them to room creation', async () => {
        const socket = createMockSocketValue();
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const screen = render(<Home />);
        fireEvent.change(screen.getByLabelText(/Your Display Name/), {
            target: { value: ' Host ' },
        });
        fireEvent.change(screen.getByLabelText(/Session \/ Project Title/), {
            target: { value: ' Sprint ' },
        });
        fireEvent.mouseDown(screen.getByLabelText('Estimation Deck Type'));
        fireEvent.click(
            await screen.findByText('Custom Deck', { selector: '.ant-select-item-option-content' })
        );
        const cards = screen.getByLabelText('Comma-Separated Custom Cards');
        const submit = screen.getByRole('button', { name: /Start Session/ });
        for (const value of [
            '',
            '1',
            '1, 01',
            '1, Infinity',
            `1, ${'x'.repeat(MAX_NAME_LENGTH + 1)}`,
            Array.from({ length: MAX_CUSTOM_DECK_SIZE + 1 }, (_, index) => index).join(','),
        ]) {
            fireEvent.change(cards, { target: { value } });
            fireEvent.click(submit);
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(socket.createRoom).not.toHaveBeenCalled();
        }
        fireEvent.change(cards, { target: { value: ' 0, 1, ?, ☕ ' } });
        fireEvent.click(submit);
        expect(socket.createRoom).toHaveBeenCalledWith(
            'Host',
            expect.any(String),
            expect.any(String),
            'Sprint',
            'custom',
            [0, 1, '?', '☕']
        );
    });
});
