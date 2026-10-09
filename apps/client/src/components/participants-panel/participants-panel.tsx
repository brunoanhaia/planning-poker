import { Card, Divider, Empty, Flex, Typography } from 'antd';
import React, { Fragment } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { ParticipantRosterRow } from '../participant-roster-row/participant-roster-row';

/** Empty-state padding of the panel, in pixels. */
const EMPTY_STATE_PADDING = 12;

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
                <Flex component="ul" vertical>
                    {participants.map((participant, index) => {
                        const isSelf = participant.id === currentUserId;

                        return (
                            <Fragment key={participant.id}>
                                {index > 0 && <Divider style={{ margin: 0 }} />}
                                <ParticipantRosterRow
                                    canManage={isAdmin && !isSelf}
                                    canTransferHost={isHost}
                                    isSelf={isSelf}
                                    participant={participant}
                                />
                            </Fragment>
                        );
                    })}
                </Flex>
            )}
        </Card>
    );
};
