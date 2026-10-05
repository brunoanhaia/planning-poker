import { EyeOutlined } from '@ant-design/icons';
import { Avatar, Badge, Card, Divider, Empty, Flex, Space, Tag, Typography } from 'antd';
import React, { Fragment } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';

/** Padding applied to each roster row, in pixels. */
const ROW_PADDING = 12;

/** Width of the participant name before it collapses to an ellipsis. */
const NAME_MAX_WIDTH = '16ch';

/**
 * Foreground used on a participant's avatar.
 *
 * The avatar background is the colour the participant picked in the lobby.
 * Every colour in `AVATAR_COLORS` is light enough that black clears the 4.5:1
 * WCAG AA ratio on it; white would be as low as 2.5:1 on the amber and teal
 * swatches. Ant Design's own default pairing (white on `colorTextPlaceholder`)
 * measures 1.83:1, which is why the background is set explicitly here.
 */
const AVATAR_FOREGROUND = '#000000';

/**
 * Roster of everybody currently in the room, with their voting state.
 *
 * Rows are plain flex containers that wrap, so a long display name can neither
 * push the status tags out of the panel nor overlap them.
 */
export const ParticipantsPanel: React.FC = () => {
    const { currentUserId, roomState } = useSocket();

    if (!roomState) return null;

    const participants = roomState.participants;

    return (
        <Card
            styles={{ body: { padding: 0 } }}
            title={<Typography.Text>Participants ({participants.length})</Typography.Text>}
        >
            {participants.length === 0 ? (
                <div style={{ padding: ROW_PADDING }}>
                    <Empty
                        description="Waiting for participants…"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                </div>
            ) : (
                <Flex component="ul" vertical>
                    {participants.map((participant, index) => {
                        const isSelf = participant.id === currentUserId;
                        const hasVoted = participant.hasVoted;

                        return (
                            <Fragment key={participant.id}>
                                {index > 0 && <Divider style={{ margin: 0 }} />}
                                <Flex
                                    align="center"
                                    component="li"
                                    gap={8}
                                    justify="space-between"
                                    style={{ padding: ROW_PADDING }}
                                    wrap
                                >
                                    <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                                        <Avatar
                                            aria-hidden
                                            style={{
                                                backgroundColor: participant.color,
                                                color: AVATAR_FOREGROUND,
                                            }}
                                        >
                                            {participant.avatar}
                                        </Avatar>
                                        <Typography.Text
                                            ellipsis={{ tooltip: participant.name }}
                                            style={{ maxWidth: NAME_MAX_WIDTH }}
                                        >
                                            {participant.name}
                                        </Typography.Text>
                                        {isSelf && (
                                            <Typography.Text type="secondary">
                                                (you)
                                            </Typography.Text>
                                        )}
                                    </Flex>

                                    <Space size={4}>
                                        {hasVoted && !participant.isSpectator && (
                                            <Badge status="success" text="Voted" />
                                        )}
                                        {participant.isSpectator && (
                                            <Tag icon={<EyeOutlined />}>Spectator</Tag>
                                        )}
                                    </Space>
                                </Flex>
                            </Fragment>
                        );
                    })}
                </Flex>
            )}
        </Card>
    );
};
