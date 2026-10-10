import { Card, Empty, Flex, Typography } from 'antd';
import React from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { ParticipantRosterRow } from '../participant-roster-row/participant-roster-row';

/** Empty-state padding of the panel, in pixels. */
const EMPTY_STATE_PADDING = 12;

/**
 * Resets the browser's default list geometry.
 *
 * A `<ul>` may only contain `<li>` children, so the separator lives on the row
 * itself as a top border rather than as a sibling element.
 */
const ROSTER_LIST_STYLE = { listStyle: 'none', margin: 0, padding: 0 } as const;

/**
 * Roster of everybody currently in the room, with their voting state.
 *
 * Rows are plain flex containers that wrap, so a long display name can neither
 * push the status tags out of the panel nor overlap them. Administrators also
 * get the management menu of each row, which only surfaces when the current
 * user is entitled to act on that participant.
 */
export const ParticipantsPanel: React.FC = () => {
    const { currentUserId, isAdmin, isHost, roomState } = useSocket();

    if (!roomState) return null;

    const participants = roomState.participants;

    return (
        <Card
            styles={{ body: { padding: 0 } }}
            title={<Typography.Text>Participants ({participants.length})</Typography.Text>}
        >
            {participants.length === 0 ? (
                <div style={{ padding: EMPTY_STATE_PADDING }}>
                    <Empty
                        description="Waiting for participants…"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            ) : (
                <Flex component="ul" style={ROSTER_LIST_STYLE} vertical>
                    {participants.map((participant, index) => {
                        const isSelf = participant.id === currentUserId;

                        return (
                            <ParticipantRosterRow
                                canManage={isAdmin && !isSelf}
                                canTransferHost={isHost}
                                isSelf={isSelf}
                                key={participant.id}
                                participant={participant}
                                showSeparator={index > 0}
                            />
                        );
                    })}
                </Flex>
            )}
        </Card>
    );
};
