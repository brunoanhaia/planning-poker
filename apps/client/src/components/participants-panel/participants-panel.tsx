import { Button, Card, Collapse, Empty, Flex, Typography } from 'antd';
import React from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { useTranslation } from '../../i18n/use-translation';
import { ParticipantRosterRow } from '../participant-roster-row/participant-roster-row';

/** Empty-state padding of the panel, in pixels. */
const EMPTY_STATE_PADDING = 12;

/** Padding around the disclosure header and its cleanup action, in pixels. */
const OFFLINE_SECTION_PADDING = 12;

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
 * Online participants come first. Anyone who disconnected is collapsed behind
 * a "left the session" disclosure instead of being rendered exactly like an
 * active participant; an administrator can then remove those stale rows in one
 * action. Rows are plain flex containers that wrap, so a long display name can
 * neither push the status tags out of the panel nor overlap them.
 */
export const ParticipantsPanel: React.FC = () => {
    const { clearOfflineParticipants, currentUserId, isAdmin, isHost, roomState } = useSocket();
    const { t } = useTranslation();

    if (!roomState) {
        return null;
    }

    const participants = roomState.participants;
    const onlineParticipants = participants.filter((participant) => participant.isOnline);
    const offlineParticipants = participants.filter((participant) => !participant.isOnline);
    const hasLeftParticipants = offlineParticipants.length > 0;

    const renderRow = (participant: (typeof participants)[number], index: number) => {
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
    };

    return (
        <Card
            styles={{ body: { padding: 0 } }}
            title={
                <Typography.Text>
                    {hasLeftParticipants
                        ? t('participants.title.online', {
                              online: onlineParticipants.length,
                              total: participants.length,
                          })
                        : t('participants.title', { total: participants.length })}
                </Typography.Text>
            }
        >
            {participants.length === 0 ? (
                <div style={{ padding: EMPTY_STATE_PADDING }}>
                    <Empty
                        description={t('participants.empty')}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            ) : (
                <Flex vertical>
                    <Flex component="ul" style={ROSTER_LIST_STYLE} vertical>
                        {onlineParticipants.map(renderRow)}
                    </Flex>

                    {hasLeftParticipants && (
                        <Collapse
                            ghost
                            items={[
                                {
                                    children: (
                                        <>
                                            {isAdmin && (
                                                <Flex
                                                    justify="flex-end"
                                                    style={{
                                                        padding: `0 ${OFFLINE_SECTION_PADDING}px`,
                                                    }}
                                                >
                                                    <Button
                                                        danger
                                                        onClick={clearOfflineParticipants}
                                                        size="small"
                                                        type="link"
                                                    >
                                                        {t('participants.clearOffline')}
                                                    </Button>
                                                </Flex>
                                            )}
                                            <Flex component="ul" style={ROSTER_LIST_STYLE} vertical>
                                                {offlineParticipants.map(renderRow)}
                                            </Flex>
                                        </>
                                    ),
                                    key: 'left',
                                    label: t('participants.left', {
                                        count: offlineParticipants.length,
                                    }),
                                },
                            ]}
                            style={{ paddingInline: OFFLINE_SECTION_PADDING }}
                        />
                    )}
                </Flex>
            )}
        </Card>
    );
};
