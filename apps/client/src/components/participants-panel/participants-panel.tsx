import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Flex, Typography } from 'antd';
import React, { useRef, useState } from 'react';

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

/** Keeps a live announcement audible without occupying visible space. */
const VISUALLY_HIDDEN_STYLE = {
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
} as const;

/**
 * Roster of everybody currently in the room, with their voting state.
 *
 * Online participants come first. Anyone who disconnected is collapsed behind
 * a native disclosure button instead of being rendered exactly like an active
 * participant; an administrator can then remove those stale rows in one
 * action. A native button keeps Enter and Space activation, focus and the
 * expanded state working without a custom keyboard model.
 */
export const ParticipantsPanel: React.FC = () => {
    const { clearOfflineParticipants, currentUserId, isAdmin, isHost, roomState } = useSocket();
    const { t } = useTranslation();
    const [isOfflineOpen, setIsOfflineOpen] = useState(false);
    const titleRef = useRef<HTMLElement>(null);

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

    /**
     * Clears the departed rows and parks focus on the panel title, because the
     * button that submitted the action disappears with them.
     */
    const handleClearOffline = () => {
        clearOfflineParticipants();
        titleRef.current?.focus();
    };

    return (
        <Card
            styles={{ body: { padding: 0 } }}
            title={
                <Typography.Text id="participants-title" ref={titleRef} tabIndex={-1}>
                    {hasLeftParticipants
                        ? t('participants.title.online', {
                              online: onlineParticipants.length,
                              total: participants.length,
                          })
                        : t('participants.title', { total: participants.length })}
                </Typography.Text>
            }
        >
            <span aria-live="polite" role="status" style={VISUALLY_HIDDEN_STYLE}>
                {hasLeftParticipants
                    ? t('participants.leftStatus', { count: offlineParticipants.length })
                    : ''}
            </span>

            {participants.length === 0 ? (
                <div style={{ padding: EMPTY_STATE_PADDING }}>
                    <Empty
                        description={t('participants.empty')}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            ) : (
                <Flex vertical>
                    {onlineParticipants.length > 0 && (
                        <Flex component="ul" style={ROSTER_LIST_STYLE} vertical>
                            {onlineParticipants.map(renderRow)}
                        </Flex>
                    )}

                    {hasLeftParticipants && (
                        <Flex vertical>
                            <Flex
                                align="center"
                                gap={8}
                                justify="space-between"
                                style={{ padding: `0 ${OFFLINE_SECTION_PADDING}px` }}
                                wrap
                            >
                                <Button
                                    aria-expanded={isOfflineOpen}
                                    icon={
                                        isOfflineOpen ? (
                                            <UpOutlined aria-hidden />
                                        ) : (
                                            <DownOutlined aria-hidden />
                                        )
                                    }
                                    onClick={() => setIsOfflineOpen((previous) => !previous)}
                                    type="text"
                                >
                                    {t('participants.left', {
                                        count: offlineParticipants.length,
                                    })}
                                </Button>
                                {isAdmin && isOfflineOpen && (
                                    <Button
                                        danger
                                        onClick={handleClearOffline}
                                        size="small"
                                        type="link"
                                    >
                                        {t('participants.clearOffline')}
                                    </Button>
                                )}
                            </Flex>

                            {isOfflineOpen && (
                                <Flex component="ul" style={ROSTER_LIST_STYLE} vertical>
                                    {offlineParticipants.map(renderRow)}
                                </Flex>
                            )}
                        </Flex>
                    )}
                </Flex>
            )}
        </Card>
    );
};
