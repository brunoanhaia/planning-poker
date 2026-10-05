import { MAX_NAME_LENGTH } from '@planitpoker/shared';
import { AVATAR_COLORS, AVATARS } from '@planitpoker/shared';
import { Badge, Button, Flex, Input, Typography } from 'antd';
import React from 'react';

export interface ParticipantProfileProps {
    avatar: string;
    color: string;
    displayName: string;
    onAvatarChange: (avatar: string) => void;
    onColorChange: (color: string) => void;
    onDisplayNameChange: (displayName: string) => void;
}

/**
 * Step 1 of both onboarding flows: the identity shown to the rest of the room.
 */
export const ParticipantProfile: React.FC<ParticipantProfileProps> = ({
    avatar,
    color,
    displayName,
    onAvatarChange,
    onColorChange,
    onDisplayNameChange,
}) => (
    <Flex gap={12} vertical>
        <div>
            <label htmlFor="profile-display-name">Your Display Name</label>
            <Input
                id="profile-display-name"
                maxLength={MAX_NAME_LENGTH}
                onChange={(event) => onDisplayNameChange(event.target.value)}
                placeholder="e.g. Alex, Sarah, Dev Lead"
                value={displayName}
            />
        </div>

        <Flex gap={8} vertical>
            <Typography.Text id="profile-avatar-label">Avatar</Typography.Text>
            <Flex aria-labelledby="profile-avatar-label" gap={8} role="group" wrap>
                {AVATARS.map((option) => (
                    <Button
                        aria-label={`Select avatar ${option}`}
                        aria-pressed={avatar === option}
                        key={option}
                        onClick={() => onAvatarChange(option)}
                        shape="circle"
                        type={avatar === option ? 'primary' : 'default'}
                    >
                        {option}
                    </Button>
                ))}
            </Flex>
        </Flex>

        <Flex gap={8} vertical>
            <Typography.Text id="profile-color-label">Theme colour</Typography.Text>
            <Flex aria-labelledby="profile-color-label" gap={8} role="group" wrap>
                {AVATAR_COLORS.map((option) => (
                    <Button
                        aria-label={`Select color ${option}`}
                        aria-pressed={color === option}
                        key={option}
                        onClick={() => onColorChange(option)}
                        shape="circle"
                        type={color === option ? 'primary' : 'default'}
                    >
                        <Badge color={option} />
                    </Button>
                ))}
            </Flex>
        </Flex>
    </Flex>
);
