import {
    CopyOutlined,
    EditOutlined,
    EyeInvisibleOutlined,
    EyeOutlined,
    LockOutlined,
    LogoutOutlined,
    MoonOutlined,
    SettingOutlined,
    SunOutlined,
} from '@ant-design/icons';
import {
    App as AntApp,
    Avatar,
    Button,
    Flex,
    Input,
    Modal,
    Space,
    Switch,
    Tag,
    theme,
    Tooltip,
    Typography,
} from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { ColorMode } from '../../theme/app-theme';

/** Horizontal rhythm between the header content, in pixels. */
const HEADER_PADDING_INLINE = 16;

/** Vertical rhythm of the header content, in pixels. */
const HEADER_PADDING_BLOCK = 12;

/** Maximum characters accepted for a room title. */
const ROOM_TITLE_MAX_LENGTH = 80;

/** Width of the inline room title before it collapses to an ellipsis. */
const ROOM_TITLE_MAX_WIDTH = '26ch';

/** Builds the deep link another browser can use to join this room. */
const buildInviteLink = (roomId: string): string => `${window.location.origin}/#${roomId}`;

export interface NavbarProps {
    /** Currently rendered colour scheme. */
    colorMode: ColorMode;
    /** Opens the admin room settings modal. */
    onOpenSettings: () => void;
    /** Flips the application between the light and dark design tokens. */
    onToggleColorMode: () => void;
}

/**
 * The persistent application bar.
 *
 * A plain `<header>` element rather than `Layout.Header`, which ships a fixed
 * 64px height and a matching line-height: a bar that is allowed to wrap onto
 * several lines would then overflow on top of the panels below it. Colours come
 * from the active design tokens, so the bar follows the colour scheme.
 *
 * Each cluster is allowed to wrap onto its own line before the next one, so the
 * header degrades from a single row into several rows instead of overlapping.
 */
export const Navbar: React.FC<NavbarProps> = ({ colorMode, onOpenSettings, onToggleColorMode }) => {
    const { currentUserId, isAdmin, leaveRoom, roomState, toggleSpectator, updateRoomTitle } =
        useSocket();
    const { message } = AntApp.useApp();
    const { token } = theme.useToken();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const currentUser = roomState?.participants.find((p) => p.id === currentUserId);

    const handleCopyLink = () => {
        if (!roomState) {
            return;
        }
        navigator.clipboard.writeText(buildInviteLink(roomState.id));
        void message.success('Invite link copied to clipboard! Share it with your team.');
    };

    const openRename = () => {
        if (!isAdmin || !roomState) {
            return;
        }
        setNewTitle(roomState.title);
        setIsEditingTitle(true);
    };

    const closeRename = () => setIsEditingTitle(false);

    const saveRename = () => {
        if (newTitle.trim()) {
            updateRoomTitle(newTitle.trim());
        }
        closeRename();
    };

    return (
        <>
            <Flex
                align="center"
                component="header"
                gap={12}
                justify="space-between"
                style={{
                    background: token.colorBgContainer,
                    borderBlockEnd: `1px solid ${token.colorSplit}`,
                    paddingBlock: HEADER_PADDING_BLOCK,
                    paddingInline: HEADER_PADDING_INLINE,
                }}
                wrap
            >
                <Space align="center" size={8}>
                    <Avatar size={36}>🃏</Avatar>
                    <Flex vertical>
                        <Typography.Text strong>Planit Poker</Typography.Text>
                        {roomState && (
                            <Space align="center" size={4}>
                                <Typography.Text
                                    ellipsis={{ tooltip: roomState.title }}
                                    style={{ maxWidth: ROOM_TITLE_MAX_WIDTH }}
                                    type="secondary"
                                >
                                    {roomState.title}
                                </Typography.Text>
                                {isAdmin && (
                                    <Tooltip title="Rename room">
                                        <Button
                                            aria-label="Rename room"
                                            icon={<EditOutlined />}
                                            onClick={openRename}
                                            size="small"
                                            type="text"
                                        />
                                    </Tooltip>
                                )}
                            </Space>
                        )}
                    </Flex>
                </Space>

                {roomState && (
                    <Flex align="center" gap={8} wrap>
                        {isAdmin && <Tag>👑 Admin</Tag>}

                        {roomState.isLocked && (
                            <Tooltip title="Room is locked by admin (no new members can join)">
                                <Tag icon={<LockOutlined />}>Locked</Tag>
                            </Tooltip>
                        )}

                        <Tooltip title="Click to copy invite link">
                            <Tag
                                color="blue"
                                icon={<CopyOutlined />}
                                onClick={handleCopyLink}
                                role="button"
                                style={{ cursor: 'pointer' }}
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') {
                                        return;
                                    }
                                    event.preventDefault();
                                    handleCopyLink();
                                }}
                            >
                                Room: {roomState.id}
                            </Tag>
                        </Tooltip>

                        {currentUser && (
                            <Tooltip
                                title={
                                    currentUser.isSpectator
                                        ? 'Spectating — your card is not counted'
                                        : 'Voting — your card is counted'
                                }
                            >
                                <Space size={4}>
                                    {currentUser.isSpectator ? (
                                        <EyeInvisibleOutlined />
                                    ) : (
                                        <EyeOutlined />
                                    )}
                                    <Switch
                                        aria-label="Spectator mode"
                                        checked={currentUser.isSpectator}
                                        onChange={toggleSpectator}
                                        size="small"
                                    />
                                </Space>
                            </Tooltip>
                        )}

                        {isAdmin && (
                            <Tooltip title="Room Settings (Admin)">
                                <Button
                                    aria-label="Room settings"
                                    icon={<SettingOutlined />}
                                    onClick={onOpenSettings}
                                    type="text"
                                />
                            </Tooltip>
                        )}

                        <Tooltip title="Leave Room">
                            <Button
                                aria-label="Leave room"
                                danger
                                icon={<LogoutOutlined />}
                                onClick={leaveRoom}
                                type="text"
                            />
                        </Tooltip>
                    </Flex>
                )}

                <Tooltip
                    title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    <Button
                        aria-label="Toggle dark mode"
                        icon={colorMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                        onClick={onToggleColorMode}
                        type="text"
                    />
                </Tooltip>
            </Flex>

            <Modal
                okText="Save"
                onCancel={closeRename}
                onOk={saveRename}
                open={isEditingTitle}
                title="Rename Room"
            >
                <label htmlFor="room-title-input">Room / Sprint Title</label>
                <Input
                    autoFocus
                    id="room-title-input"
                    maxLength={ROOM_TITLE_MAX_LENGTH}
                    onChange={(event) => setNewTitle(event.target.value)}
                    onPressEnter={saveRename}
                    value={newTitle}
                />
            </Modal>
        </>
    );
};
