import { use } from 'react';

import { SocketContext } from './socket-context';

/**
 * Reads the live room session.
 *
 * @throws When called outside of a `SocketProvider`.
 * @returns The socket context value.
 */
export const useSocket = () => {
    const context = use(SocketContext);

    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }

    return context;
};
