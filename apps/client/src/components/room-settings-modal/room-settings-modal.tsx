import { DECK_TYPES, DECK_TYPE_LABELS, DeckType, PRESET_DECKS } from '@planitpoker/shared';
import { Button, Divider, Flex, Input, Modal, Select, Space, Switch, Typography } from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';

/** Fallback cards offered when a custom deck parses to nothing usable. */
const FALLBACK_CUSTOM_DECK: (number | string)[] = [1, 2, 3, 5, 8];

/** Parses the comma separated custom deck into numbers where possible. */
const parseCustomDeck = (raw: string): (number | string)[] => {
    const parsed = raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => (Number.isNaN(Number(entry)) ? entry : Number(entry)));

    return parsed.length > 0 ? parsed : FALLBACK_CUSTOM_DECK;
};

/** Confirmation copy for the destructive session end. */
const END_SESSION_CONFIRMATION = 'Are you sure you want to end this planning estimation session?';

export interface RoomSettingsModalProps {
    /** Closes the modal without applying anything. */
    onClose: () => void;
    /** Whether the modal is visible. */
    open: boolean;
}

/**
 * Admin-only room configuration: title, deck, auto-reveal and room lock.
 *
 * Switches use `Form.Item` so each one is labelled and reachable by keyboard,
 * and the form stacks so a long deck preview never overlaps the controls.
 */
export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({ onClose, open }) => {
    const {
        changeDeck,
        endSession,
        isAdmin,
        roomState,
        toggleAutoReveal,
        toggleLockRoom,
        updateRoomTitle,
    } = useSocket();

    const [title, setTitle] = useState(roomState?.title || '');
    const [deckType, setDeckType] = useState<DeckType>(roomState?.deckType || 'fibonacci');
    const [customDeck, setCustomDeck] = useState(
        () => roomState?.customDeck?.join(', ') ?? FALLBACK_CUSTOM_DECK.join(', ')
    );

    if (!roomState || !isAdmin) {
        return null;
    }

    const handleSave = () => {
        if (title.trim() && title.trim() !== roomState.title) {
            updateRoomTitle(title.trim());
        }

        if (deckType === 'custom') {
            changeDeck('custom', parseCustomDeck(customDeck));
        } else {
            changeDeck(deckType);
        }
        onClose();
    };

    const handleEndSession = () => {
        if (!window.confirm(END_SESSION_CONFIRMATION)) {
            return;
        }
        endSession();
        onClose();
    };

    return (
        <Modal
            footer={
                <Flex gap={8} justify="end">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} type="primary">
                        Apply Settings
                    </Button>
                </Flex>
            }
            onCancel={onClose}
            open={open}
            title="Room &amp; Session Settings"
        >
            <Flex gap={12} vertical>
                <Typography.Text type="secondary">
                    Configure room settings, deck rules, and session status.
                </Typography.Text>

                <div>
                    <label htmlFor="room-settings-title">Room / Sprint Title</label>
                    <Input
                        id="room-settings-title"
                        onChange={(event) => setTitle(event.target.value)}
                        value={title}
                    />
                </div>

                <div>
                    <label htmlFor="room-settings-deck">Estimation Deck Type</label>
                    <Select<DeckType>
                        id="room-settings-deck"
                        onChange={setDeckType}
                        options={DECK_TYPES.map((option) => ({
                            label: DECK_TYPE_LABELS[option],
                            value: option,
                        }))}
                        style={{ width: '100%' }}
                        value={deckType}
                    />
                </div>

                {deckType === 'custom' ? (
                    <div>
                        <label htmlFor="room-settings-custom-deck">
                            Comma-Separated Custom Cards
                        </label>
                        <Input
                            id="room-settings-custom-deck"
                            onChange={(event) => setCustomDeck(event.target.value)}
                            placeholder="e.g. 1, 2, 3, 5, 8, 10, ?, ☕"
                            value={customDeck}
                        />
                    </div>
                ) : (
                    <Typography.Text type="secondary">
                        {`Selected cards preview: ${PRESET_DECKS[deckType].join('  ·  ')}`}
                    </Typography.Text>
                )}

                <Divider style={{ margin: 0 }} />

                <Flex align="center" gap={8} justify="space-between" wrap>
                    <Flex gap={2} vertical>
                        <Typography.Text>Auto-Reveal Votes</Typography.Text>
                        <Typography.Text type="secondary">
                            Automatically flip cards when everyone has voted
                        </Typography.Text>
                    </Flex>
                    <Switch
                        aria-label="Auto-Reveal Votes"
                        checked={roomState.autoReveal}
                        onChange={toggleAutoReveal}
                    />
                </Flex>

                <Flex align="center" gap={8} justify="space-between" wrap>
                    <Flex gap={2} vertical>
                        <Typography.Text>Lock Room</Typography.Text>
                        <Typography.Text type="secondary">
                            Prevent new participants from joining
                        </Typography.Text>
                    </Flex>
                    <Switch
                        aria-label="Lock Room"
                        checked={roomState.isLocked}
                        onChange={toggleLockRoom}
                    />
                </Flex>

                <Divider style={{ margin: 0 }} />

                {!roomState.isEnded && (
                    <Space>
                        <Button danger onClick={handleEndSession}>
                            End Planning Session
                        </Button>
                    </Space>
                )}
            </Flex>
        </Modal>
    );
};
