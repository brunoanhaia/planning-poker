import { Participant } from '@planitpoker/shared';
import { MenuProps } from 'antd';
import React from 'react';

import { Translate } from '../../i18n/i18n-context';

/** Keys of the roster action menu, each pairing with one socket command. */
export const PARTICIPANT_MENU_ACTIONS: readonly string[] = [
    'kick',
    'toggle-co-admin',
    'toggle-role',
    'transfer-host',
];

/** One administrative action that can be taken on a participant. */
export type ParticipantMenuAction = 'kick' | 'toggle-co-admin' | 'toggle-role' | 'transfer-host';

/**
 * Narrows a menu key reported by Ant Design back to a roster action.
 *
 * @param key - The key of the clicked menu item.
 * @returns `true` when the key belongs to the roster action menu.
 */
export const isParticipantMenuAction = (key: React.Key): key is ParticipantMenuAction =>
    typeof key === 'string' && PARTICIPANT_MENU_ACTIONS.includes(key);

/** Arguments of {@link buildParticipantMenuItems}. */
export interface BuildParticipantMenuItemsArgs {
    /** `true` when the current user may hand over the primary host role. */
    canTransferHost: boolean;
    /** Participant the actions are offered for. */
    participant: Participant;
    /** Translator of the active language. */
    t: Translate;
}

/** Actions every administrator may take on a participant. */
const rosterActions = (participant: Participant, t: Translate): NonNullable<MenuProps['items']> => [
    {
        key: 'toggle-role',
        label: participant.isSpectator
            ? t('participants.menu.makeVoter')
            : t('participants.menu.makeSpectator'),
    },
    {
        key: 'toggle-co-admin',
        label: participant.isAdmin ? t('participants.menu.demote') : t('participants.menu.promote'),
    },
];

/**
 * Builds the management menu of a single roster row.
 *
 * Toggling a role and promoting a co-administrator are always offered; handing
 * over the primary host is restricted to the host, and kicking is kept visually
 * apart as the destructive option.
 *
 * @param args - Whether the host role can be transferred, the target
 *   participant and the active translator.
 * @returns The menu items in display order.
 */
export const buildParticipantMenuItems = ({
    canTransferHost,
    participant,
    t,
}: BuildParticipantMenuItemsArgs): MenuProps['items'] => [
    ...rosterActions(participant, t),
    ...(canTransferHost
        ? [{ key: 'transfer-host', label: t('participants.menu.transfer') }]
        : ([] as NonNullable<MenuProps['items']>)),
    { type: 'divider' },
    { danger: true, key: 'kick', label: t('participants.menu.kick') },
];
