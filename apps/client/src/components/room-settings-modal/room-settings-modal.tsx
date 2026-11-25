import { DECK_TYPES, DeckType, PRESET_DECKS } from '@planitpoker/shared';
import { Button, Divider, Flex, Input, Modal, Popconfirm, Select, Switch, Typography } from 'antd';
import React, { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { deckLabelKey } from '../../i18n/dictionary';
import { useTranslation } from '../../i18n/use-translation';
import {
    CustomDeckError,
    parseCustomDeck,
    translateCustomDeckError,
} from '../../utils/custom-deck';

/** Fallback cards offered when a custom deck parses to nothing usable. */
const FALLBACK_CUSTOM_DECK: (number | string)[] = [1, 2, 3, 5, 8];

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
    const { t } = useTranslation();

    const [titleDraft, setTitleDraft] = useState<null | string>(null);
    const [deckTypeDraft, setDeckTypeDraft] = useState<null | DeckType>(null);
    const [customDeckDraft, setCustomDeckDraft] = useState<null | string>(null);
    const [customDeckError, setCustomDeckError] = useState<CustomDeckError | null>(null);

    if (!roomState || !isAdmin) {
        return null;
    }

    // The fields fall back to the live room, so a value changed elsewhere — a
    // room renamed from the navbar, a deck switched by another administrator —
    // is picked up instead of being overwritten by a draft from an earlier
    // room. Only an actual edit enters the drafts.
    const title = titleDraft ?? roomState.title;
    const deckType = deckTypeDraft ?? roomState.deckType;
    const customDeck =
        customDeckDraft ?? roomState.customDeck?.join(', ') ?? FALLBACK_CUSTOM_DECK.join(', ');

    const handleSave = () => {
        // Validate before dispatching anything: a rejected deck must not apply
        // the title change on the way out and leave the dialog half-applied.
        const parsedCustomDeck = deckType === 'custom' ? parseCustomDeck(customDeck) : null;
        if (parsedCustomDeck?.error) {
            setCustomDeckError(parsedCustomDeck.error);
            return;
        }

        if (title.trim() && title.trim() !== roomState.title) {
            updateRoomTitle(title.trim());
        }

        if (parsedCustomDeck) {
            const { cards } = parsedCustomDeck;
            const hasSameCards =
                cards.length === roomState.customDeck?.length &&
                cards.every((card, index) => card === roomState.customDeck?.[index]);
            if (deckType !== roomState.deckType || !hasSameCards) {
                changeDeck('custom', cards);
            }
        } else if (deckType !== roomState.deckType) {
            changeDeck(deckType);
        }

        // Applying discards the drafts, so the fields fall back to the live room
        // instead of keeping a value the server may have rejected — or that
        // another administrator changed in the meantime.
        setTitleDraft(null);
        setDeckTypeDraft(null);
        setCustomDeckDraft(null);
        setCustomDeckError(null);
        onClose();
    };

    const handleEndSession = () => {
        endSession();
        onClose();
    };

    return (
        <Modal
            footer={
                <Flex gap={8} justify="end">
                    <Button onClick={onClose}>{t('common.cancel')}</Button>
                    <Button onClick={handleSave} type="primary">
                        {t('settings.apply')}
                    </Button>
                </Flex>
            }
            onCancel={onClose}
            open={open}
            title={t('settings.title')}
        >
            <Flex gap={12} vertical>
                <Typography.Text type="secondary">{t('settings.description')}</Typography.Text>

                <div>
                    <label htmlFor="room-settings-title">{t('nav.roomTitle')}</label>
                    <Input
                        id="room-settings-title"
                        onChange={(event) => setTitleDraft(event.target.value)}
                        value={title}
                    />
                </div>

                <div>
                    <label htmlFor="room-settings-deck">{t('settings.deck')}</label>
                    <Select<DeckType>
                        id="room-settings-deck"
                        onChange={(value) => {
                            setDeckTypeDraft(value);
                            setCustomDeckError(null);
                        }}
                        options={DECK_TYPES.map((option) => ({
                            label: t(deckLabelKey(option)),
                            value: option,
                        }))}
                        style={{ width: '100%' }}
                        value={deckType}
                    />
                </div>

                {deckType === 'custom' ? (
                    <div>
                        <label htmlFor="room-settings-custom-deck">
                            {t('settings.customCards')}
                        </label>
                        <Input
                            aria-describedby={
                                customDeckError ? 'room-settings-custom-deck-error' : undefined
                            }
                            aria-invalid={Boolean(customDeckError)}
                            id="room-settings-custom-deck"
                            onChange={(event) => {
                                setCustomDeckDraft(event.target.value);
                                setCustomDeckError(null);
                            }}
                            placeholder={t('settings.customCards.placeholder')}
                            value={customDeck}
                        />
                        {customDeckError && (
                            <Typography.Text
                                id="room-settings-custom-deck-error"
                                role="alert"
                                type="danger"
                            >
                                {translateCustomDeckError(customDeckError, t)}
                            </Typography.Text>
                        )}
                    </div>
                ) : (
                    <Typography.Text type="secondary">
                        {t('settings.preview', { cards: PRESET_DECKS[deckType].join('  ·  ') })}
                    </Typography.Text>
                )}

                <Divider style={{ margin: 0 }} />

                <Flex align="center" gap={8} justify="space-between" wrap>
                    <Flex gap={2} vertical>
                        <Typography.Text>{t('settings.autoReveal')}</Typography.Text>
                        <Typography.Text type="secondary">
                            {t('settings.autoReveal.hint')}
                        </Typography.Text>
                    </Flex>
                    <Switch
                        aria-label={t('settings.autoReveal')}
                        checked={roomState.autoReveal}
                        onChange={toggleAutoReveal}
                    />
                </Flex>

                <Flex align="center" gap={8} justify="space-between" wrap>
                    <Flex gap={2} vertical>
                        <Typography.Text>{t('settings.lock')}</Typography.Text>
                        <Typography.Text type="secondary">
                            {t('settings.lock.hint')}
                        </Typography.Text>
                    </Flex>
                    <Switch
                        aria-label={t('settings.lock')}
                        checked={roomState.isLocked}
                        onChange={toggleLockRoom}
                    />
                </Flex>

                <Divider style={{ margin: 0 }} />

                {!roomState.isEnded && (
                    <Popconfirm
                        onConfirm={handleEndSession}
                        okButtonProps={{ danger: true }}
                        okText={t('settings.end.ok')}
                        title={t('settings.end.confirm')}
                    >
                        <Button danger>{t('settings.end')}</Button>
                    </Popconfirm>
                )}
            </Flex>
        </Modal>
    );
};
