import { EyeInvisibleOutlined, EyeOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Participant, RoomState } from '@planitpoker/shared';
import { App as AntApp } from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { Translate } from '../../i18n/i18n-context';
import { useTranslation } from '../../i18n/use-translation';
import { ColorMode } from '../../theme/app-theme';
import { copyText } from '../../utils/clipboard';

/** Builds the deep link another browser can use to join this room. */
const buildInviteLink = (roomId: string): string => `${window.location.origin}/#${roomId}`;

/** An icon paired with the wording it announces. */
interface NavbarIconLabel {
    icon: React.ReactNode;
    label: string;
}

/** Toggle that flips the application to the opposite colour scheme. */
const getColorModeToggle = (colorMode: ColorMode, t: Translate): NavbarIconLabel =>
    colorMode === 'dark'
        ? { icon: React.createElement(SunOutlined), label: t('nav.light') }
        : { icon: React.createElement(MoonOutlined), label: t('nav.dark') };

/** Icon and wording that describe the current spectator role. */
const getSpectatorHint = (user: Participant | undefined, t: Translate): NavbarIconLabel | null => {
    if (!user) {
        return null;
    }
    return user.isSpectator
        ? { icon: React.createElement(EyeInvisibleOutlined), label: t('nav.spectating') }
        : { icon: React.createElement(EyeOutlined), label: t('nav.voting') };
};

/** Everything the bar renders, plus the actions it dispatches. */
export interface NavbarModel {
    closeRename: () => void;
    colorModeToggle: NavbarIconLabel;
    handleCopyLink: () => Promise<void>;
    handleInviteKeyDown: (event: React.KeyboardEvent<HTMLElement>) => Promise<void>;
    isAdmin: boolean;
    isConnected: boolean;
    isEditingTitle: boolean;
    isSpectator: boolean;
    leaveRoom: () => void;
    newTitle: string;
    openRename: () => void;
    roomState: RoomState | null;
    saveRename: () => void;
    setNewTitle: (title: string) => void;
    spectatorHint: NavbarIconLabel | null;
    toggleSpectator: () => void;
}

/**
 * Binds the bar to the live room and owns its local UI state.
 *
 * Copying the invite link, renaming the room and flipping the spectator role
 * all leave the component with rendering only.
 *
 * @param colorMode - The scheme currently applied, used to label its toggle.
 * @returns The room snapshot, the derived labels and the handlers to bind.
 */
export const useNavbar = (colorMode: ColorMode): NavbarModel => {
    const {
        currentUserId,
        isAdmin,
        isConnected,
        leaveRoom,
        roomState,
        toggleSpectator,
        updateRoomTitle,
    } = useSocket();
    const { t } = useTranslation();
    const { message } = AntApp.useApp();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    const currentUser = roomState?.participants.find((p) => p.id === currentUserId);

    const handleCopyLink = async (): Promise<void> => {
        if (!roomState) {
            return;
        }
        const copied = await copyText(buildInviteLink(roomState.id));

        if (copied) {
            message.success(t('nav.copy.success'));
            return;
        }

        message.error(t('nav.copy.error'));
    };

    const handleInviteKeyDown = async (event: React.KeyboardEvent<HTMLElement>): Promise<void> => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        await handleCopyLink();
    };

    const openRename = (): void => {
        if (!isAdmin || !roomState) {
            return;
        }
        setNewTitle(roomState.title);
        setIsEditingTitle(true);
    };

    const closeRename = (): void => setIsEditingTitle(false);

    const saveRename = (): void => {
        if (newTitle.trim()) {
            updateRoomTitle(newTitle.trim());
        }
        closeRename();
    };

    return {
        closeRename,
        colorModeToggle: getColorModeToggle(colorMode, t),
        handleCopyLink,
        handleInviteKeyDown,
        isAdmin,
        isConnected,
        isEditingTitle,
        isSpectator: Boolean(currentUser?.isSpectator),
        leaveRoom,
        newTitle,
        openRename,
        roomState,
        saveRename,
        setNewTitle,
        spectatorHint: getSpectatorHint(currentUser, t),
        toggleSpectator,
    };
};
