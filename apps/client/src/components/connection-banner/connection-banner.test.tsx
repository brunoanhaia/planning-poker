import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { ConnectionStatus, SocketContext } from '../../context/socket-context/socket-context';
import { I18nProvider } from '../../i18n/i18n-provider';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { ConnectionBanner } from './connection-banner';

const renderBanner = (connectionStatus: ConnectionStatus) =>
    render(
        <SocketContext value={createMockSocketValue({ connectionStatus })}>
            <I18nProvider>
                <ConnectionBanner />
            </I18nProvider>
        </SocketContext>
    );

describe('ConnectionBanner', () => {
    it('keeps the polite live region mounted and announces the connected state', () => {
        const { rerender } = renderBanner('connecting');
        expect(screen.getByRole('status')).toHaveTextContent('Connecting to the server');

        rerender(
            <SocketContext value={createMockSocketValue({ connectionStatus: 'connected' })}>
                <I18nProvider>
                    <ConnectionBanner />
                </I18nProvider>
            </SocketContext>
        );

        // The region survives the visible warning; the connected message is
        // what the screen reader receives when the socket opens.
        expect(screen.getByRole('status')).toHaveTextContent('Connected to the server');
        expect(screen.queryByText('Connecting to the server')).toBeNull();
    });
});
