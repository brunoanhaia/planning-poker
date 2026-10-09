import { EyeOutlined, MoreOutlined } from '@ant-design/icons';
import { Participant } from '@planitpoker/shared';
import {
    Avatar,
    Badge,
    Button,
    Dropdown,
    Flex,
    MenuProps,
    Space,
    Tag,
    theme,
    Tooltip,
    Typography,
} from 'antd';
import React from 'react';

import { useParticipantMenuAction } from './participant-roster-row.hooks';
import { buildParticipantMenuItems, isParticipantMenuAction } from './participant-roster-row.utils';

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

/** Props of {@link ParticipantRosterRow}. */
export interface ParticipantRosterRowProps {
    /** `true` when the current user may manage this participant. */
    canManage: boolean;
    /** `true` when the current user may hand over the primary host role. */
    canTransferHost: boolean;
    /** `true` when a rule must be drawn above the row to separate it from the previous one. */
    showSeparator: boolean;
    /** `true` when the row shows the current user. */
    isSelf: boolean;
    /** Participant to display. */
    participant: Participant;
}

/**
 * One entry of the participant roster: identity, voting state and — for
 * administrators — the actions they may take on that participant.
 *
 * The row is a plain flex container that wraps, so a long display name can
 * neither push the status tags out of the panel nor overlap them.
 */
export const ParticipantRosterRow: React.FC<ParticipantRosterRowProps> = ({
    canManage,
    canTransferHost,
    isSelf,
    participant,
    showSeparator,
}) => {
    const runAction = useParticipantMenuAction();
    const { token } = theme.useToken();

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (isParticipantMenuAction(key)) {
            runAction(key, participant);
        }
    };

    return (
        <Flex
            align="center"
            component="li"
            gap={8}
            justify="space-between"
            style={{
                borderTop: showSeparator ? `1px solid ${token.colorSplit}` : undefined,
                padding: ROW_PADDING,
            }}
            wrap
        >
            <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <Avatar
                    aria-hidden
                    style={{ backgroundColor: participant.color, color: AVATAR_FOREGROUND }}
                >
                    {participant.avatar}
                </Avatar>
                <Typography.Text
                    ellipsis={{ tooltip: participant.name }}
                    style={{ maxWidth: NAME_MAX_WIDTH }}
                >
                    {participant.name}
                </Typography.Text>
                {isSelf && <Typography.Text type="secondary">(you)</Typography.Text>}
            </Flex>

            <Space size={4}>
                {participant.hasVoted && !participant.isSpectator && (
                    <Badge status="success" text="Voted" />
                )}
                {participant.isSpectator && <Tag icon={<EyeOutlined />}>Spectator</Tag>}

                {canManage && (
                    <Dropdown
                        menu={{
                            items: buildParticipantMenuItems({ canTransferHost, participant }),
                            onClick: handleMenuClick,
                        }}
                        trigger={['click']}
                    >
                        <Tooltip title="Manage participant">
                            <Button
                                aria-label={`Manage ${participant.name}`}
                                icon={<MoreOutlined aria-hidden />}
                                size="small"
                                type="text"
                            />
                        </Tooltip>
                    </Dropdown>
                )}
            </Space>
        </Flex>
    );
};
