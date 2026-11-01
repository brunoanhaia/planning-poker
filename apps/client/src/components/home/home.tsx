import { AVATAR_COLORS, AVATARS, DeckType } from '@planitpoker/shared';
import { Alert, Card, Col, Flex, Row, Space, Tabs, theme, Typography } from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { useTranslation } from '../../i18n/use-translation';
import { readActiveRoom } from '../../utils/active-room';
import { CreateSessionForm } from '../create-session-form/create-session-form';
import { JoinSessionForm } from '../join-session-form/join-session-form';
import { ParticipantProfile } from '../participant-profile/participant-profile';
import { SessionSwitchModal } from '../session-switch-modal/session-switch-modal';

/** Keys used to remember the participant profile between visits. */
const NAME_STORAGE_KEY = 'planit_name';
const AVATAR_STORAGE_KEY = 'planit_avatar';
const COLOR_STORAGE_KEY = 'planit_color';

/** Exact length of a room code, and therefore of the join deep link. */
const ROOM_CODE_LENGTH = 8;

/** Reads the room code from a `#ABC123` deep link, when one is present. */
const readRoomCodeFromHash = (): string => {
    const hash = window.location.hash.replace('#', '').toUpperCase();
    return hash.length === ROOM_CODE_LENGTH ? hash : '';
};

/**
 * The signed-out landing screen.
 *
 * A single column that stays readable from 320px upwards: the profile picker is
 * shared by both flows, and only the second step changes with the active tab.
 */
export const Home: React.FC = () => {
    const { createRoom, joinRoom, error, clearError } = useSocket();
    const { t } = useTranslation();
    const { token } = theme.useToken();

    const roomCodeFromHash = readRoomCodeFromHash();
    const [activeTab, setActiveTab] = useState(roomCodeFromHash ? 'join' : 'create');
    const [displayName, setDisplayName] = useState(
        () => localStorage.getItem(NAME_STORAGE_KEY) || ''
    );
    const [avatar, setAvatar] = useState(
        () => localStorage.getItem(AVATAR_STORAGE_KEY) || AVATARS[0]
    );
    const [color, setColor] = useState(
        () => localStorage.getItem(COLOR_STORAGE_KEY) || AVATAR_COLORS[0]
    );

    const [pendingSwitch, setPendingSwitch] = useState<null | {
        activeRoomId: string;
        run: () => void;
    }>(null);

    const hasDisplayName = displayName.trim().length > 0;

    const persistProfile = () => {
        localStorage.setItem(NAME_STORAGE_KEY, displayName);
        localStorage.setItem(AVATAR_STORAGE_KEY, avatar);
        localStorage.setItem(COLOR_STORAGE_KEY, color);
    };

    /**
     * Runs the requested action unless this browser is already in a different
     * room, in which case the switch confirmation is opened first. The stored
     * room is read here rather than during render so a session opened in
     * another tab is seen at the moment of the click.
     */
    const guard = (targetRoomId: string, run: () => void) => {
        const activeRoomId = readActiveRoom();

        if (!activeRoomId || activeRoomId === targetRoomId) {
            run();
            return;
        }

        setPendingSwitch({ activeRoomId, run });
    };

    const handleCreate = (title: string, deckType: DeckType, customDeck?: (number | string)[]) => {
        if (!hasDisplayName) {
            return;
        }
        persistProfile();
        guard('', () => {
            createRoom(displayName.trim(), avatar, color, title || undefined, deckType, customDeck);
        });
    };

    const handleJoin = (roomCode: string) => {
        if (!hasDisplayName) {
            return;
        }
        persistProfile();
        guard(roomCode, () => joinRoom(roomCode, displayName.trim(), avatar, color));
    };

    /** Continues with the action that was pending when the modal opened. */
    const handleProceed = () => {
        pendingSwitch?.run();
        setPendingSwitch(null);
    };

    /** Opens the room this browser is still bound to, instead of the requested one. */
    const handleRejoin = () => {
        if (pendingSwitch) {
            joinRoom(pendingSwitch.activeRoomId, displayName.trim(), avatar, color);
        }
        setPendingSwitch(null);
    };

    return (
        <Row justify="center">
            <Col xs={24} md={14} lg={10}>
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                    <Flex gap={8} vertical>
                        <Typography.Title level={1}>{t('app.title')}</Typography.Title>
                        <Typography.Paragraph type="secondary">
                            {t('app.subtitle')}
                        </Typography.Paragraph>
                    </Flex>

                    {error && <Alert closable onClose={clearError} title={error} type="error" />}

                    <Card>
                        <Flex gap={16} vertical>
                            {/* Level 2 keeps the outline descending under the page h1
                                (Lighthouse heading-order); the size stays the compact
                                heading-5 token so the step label is unchanged. */}
                            <Typography.Title
                                level={2}
                                style={{
                                    fontSize: token.fontSizeHeading5,
                                    lineHeight: token.lineHeightHeading5,
                                    marginBlock: 0,
                                }}
                            >
                                {t('home.profile')}
                            </Typography.Title>

                            <ParticipantProfile
                                avatar={avatar}
                                color={color}
                                displayName={displayName}
                                onAvatarChange={setAvatar}
                                onColorChange={setColor}
                                onDisplayNameChange={setDisplayName}
                            />

                            <Tabs
                                activeKey={activeTab}
                                items={[
                                    {
                                        children: (
                                            <CreateSessionForm
                                                disabled={!hasDisplayName}
                                                onSubmit={handleCreate}
                                            />
                                        ),
                                        key: 'create',
                                        label: t('home.tab.create'),
                                    },
                                    {
                                        children: (
                                            <JoinSessionForm
                                                initialRoomCode={roomCodeFromHash}
                                                onSubmit={handleJoin}
                                            />
                                        ),
                                        key: 'join',
                                        label: t('home.tab.join'),
                                    },
                                ]}
                                onChange={setActiveTab}
                            />
                        </Flex>
                    </Card>
                </Space>
            </Col>
            <SessionSwitchModal
                activeRoomId={pendingSwitch?.activeRoomId ?? ''}
                onDismiss={() => setPendingSwitch(null)}
                onProceed={handleProceed}
                onRejoin={handleRejoin}
                open={pendingSwitch !== null}
            />
        </Row>
    );
};
