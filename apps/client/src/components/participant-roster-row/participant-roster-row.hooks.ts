import { Participant } from '@planitpoker/shared';
import { useCallback } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { ParticipantMenuAction } from './participant-roster-row.utils';

/**
 * Binds the roster action menu to the socket commands of the current session.
 *
 * The menu only reports which action was chosen: the server still re-checks that
 * the caller is the host or a co-administrator before applying it.
 *
 * @returns A handler that dispatches one action for one participant.
 */
export const useParticipantMenuAction = (): ((
    action: ParticipantMenuAction,
    participant: Participant
) => void) => {
    const { kickParticipant, promoteCoAdmin, toggleUserRole, transferAdmin } = useSocket();

    return useCallback(
        (action: ParticipantMenuAction, participant: Participant) => {
            if (action === 'kick') {
                kickParticipant(participant.id);
                return;
            }
            if (action === 'toggle-co-admin') {
                promoteCoAdmin(participant.id);
                return;
            }
            if (action === 'toggle-role') {
                toggleUserRole(participant.id);
                return;
            }
            transferAdmin(participant.id);
        },
        [kickParticipant, promoteCoAdmin, toggleUserRole, transferAdmin]
    );
};
